/**
 * Federation Handlers
 * Process incoming ActivityPub activities
 */

import {
    ActivityType,
    ObjectType,
    AttendanceStatus,
    ContentType,
} from './constants/activitypub.js'
import {
    cacheRemoteUser,
    fetchActor,
    getBaseUrl,
    fetchRemoteFollowerCount,
} from './lib/activitypubHelpers.js'
import { safeFetch } from './lib/ssrfProtection.js'
import { buildAcceptActivity } from './services/ActivityBuilder.js'
import { deliverToInbox } from './services/ActivityDelivery.js'
import {
    broadcast,
    broadcastToUser,
    BroadcastEvents,
} from './realtime.js'
import { prisma } from './lib/prisma.js'
import { trackInstance } from './lib/instanceHelpers.js'
import type { Prisma, Event, User } from '@prisma/client'
import type {
    Activity,
    FollowActivity,
    AcceptActivity,
    CreateActivity,
    UpdateActivity,
    DeleteActivity,
    LikeActivity,
    UndoActivity,
    AnnounceActivity,
    Person,
    Event as ActivityPubEvent,
    Note as ActivityPubNote,
} from './lib/activitypubSchemas.js'

/**
 * Main activity handler - routes to specific handlers
 * Uses atomic upsert to prevent race conditions in activity deduplication
 */
export async function handleActivity(activity: Activity): Promise<void> {
    try {
        // Use upsert with unique constraint to atomically check and mark as processed
        // This prevents race conditions where multiple requests process the same activity
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 30) // 30 days TTL

        try {
            // Try to create the processed activity record
            // If it already exists (unique constraint violation), this will fail
            await prisma.processedActivity.create({
                data: {
                    activityId: activity.id,
                    expiresAt,
                },
            })
        } catch (error: unknown) {
            // If the activity already exists (P2002 = unique constraint violation), skip processing
            if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
                console.log(`Activity already processed: ${activity.id}`)
                return
            }
            // Re-throw other errors
            throw error
        }

        // Route to specific handler
        switch (activity.type) {
            case ActivityType.FOLLOW:
                await handleFollow(activity as FollowActivity)
                break
            case ActivityType.ACCEPT:
                await handleAccept(activity as AcceptActivity)
                break
            case ActivityType.CREATE:
                await handleCreate(activity as CreateActivity)
                break
            case ActivityType.UPDATE:
                await handleUpdate(activity as UpdateActivity)
                break
            case ActivityType.DELETE:
                await handleDelete(activity as DeleteActivity)
                break
            case ActivityType.LIKE:
                await handleLike(activity as LikeActivity)
                break
            case ActivityType.UNDO:
                await handleUndo(activity as UndoActivity)
                break
            case ActivityType.ANNOUNCE:
            await handleAnnounce(activity as AnnounceActivity)
                break
            case ActivityType.TENTATIVE_ACCEPT:
                await handleTentativeAccept(activity)
                break
            case ActivityType.REJECT:
                await handleReject(activity)
                break
            default:
                console.log(`Unhandled activity type: ${activity.type}`)
        }
    } catch (error) {
        // Structured error logging for federation issues
        console.error('[Federation] Error handling activity:', {
            timestamp: new Date().toISOString(),
            activityId: activity.id,
            activityType: activity.type,
            actor: activity.actor,
            error: {
                message: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
            },
        })
        // If activity processing failed, we should still keep it marked as processed
        // to prevent infinite retry loops. The activity was accepted (202), so we
        // don't want to reprocess it even if handling failed.
    }
}

/**
 * Handle Follow activity
 */
async function handleFollow(activity: FollowActivity): Promise<void> {
    const actorUrl = activity.actor
    const objectUrl = activity.object

    // Parse target username from object URL
    const baseUrl = getBaseUrl()
    if (!objectUrl.startsWith(baseUrl)) {
        console.log('Follow target is not local')
        return
    }

    const username = objectUrl.split('/').pop()
    const targetUser = await prisma.user.findUnique({
        where: { username, isRemote: false },
    })

    if (!targetUser) {
        console.log('Target user not found')
        return
    }

    // Fetch and cache remote actor
    const actor = await fetchActor(actorUrl)
    if (!actor) {
        console.log('Failed to fetch actor')
        return
    }

    const actorPerson = actor as unknown as Person
    const remoteUser = await cacheRemoteUser(actorPerson)

    // Track instance
    await trackInstance(actorUrl)

    // Check if user auto-accepts followers
    const shouldAutoAccept = (targetUser as unknown as { autoAcceptFollowers?: boolean }).autoAcceptFollowers ?? true

    // Create or update follower record
    await prisma.follower.upsert({
        where: {
            userId_actorUrl: {
                userId: targetUser.id,
                actorUrl,
            },
        },
        update: {
            accepted: shouldAutoAccept,
        },
        create: {
            userId: targetUser.id,
            actorUrl,
            username: remoteUser.username,
            inboxUrl: actorPerson.inbox,
            sharedInboxUrl: actorPerson.endpoints?.sharedInbox || null,
            iconUrl: actorPerson.icon?.url || null,
            accepted: shouldAutoAccept,
        },
    })

    // Calculate current follower count (target user is local, so we can calculate directly)
    const followerCount = await prisma.follower.count({
        where: {
            userId: targetUser.id,
            accepted: true,
        },
    })

    // Broadcast FOLLOWER_ADDED to the target user's clients
    // This notifies Bob that Alice is following him
    await broadcastToUser(targetUser.id, {
        type: BroadcastEvents.FOLLOWER_ADDED,
        data: {
            username: targetUser.username,
            follower: {
                username: remoteUser.username,
                actorUrl,
                accepted: shouldAutoAccept,
            },
            followerCount,
        },
    })

    // Send Accept activity only if auto-accepting
    if (shouldAutoAccept) {
        const acceptActivity = buildAcceptActivity(targetUser, activity)
        const inboxUrl = actorPerson.endpoints?.sharedInbox || actorPerson.inbox
        await deliverToInbox(acceptActivity, inboxUrl, targetUser)
        console.log(`✅ Auto-accepted follow from ${actorUrl}`)
    } else {
        console.log(`⏳ Follow request from ${actorUrl} pending approval`)
    }
}

/**
 * Handle Accept activity (for our Follow requests)
 */
async function handleAccept(activity: AcceptActivity): Promise<void> {
    const actorUrl = activity.actor
    const object = activity.object

    console.log(`[handleAccept] Received Accept activity:`)
    console.log(`  - actor: ${actorUrl}`)
    console.log(`  - object type: ${typeof object}`)
    console.log(`  - object: ${JSON.stringify(object, null, 2).substring(0, 500)}`)

    // Handle Follow Accept FIRST - object must be an object with type FOLLOW
    // This must be checked before Event Accept because Follow activities also have an 'id' field
    if (typeof object === 'object' && object.type === ActivityType.FOLLOW) {
        console.log(`[handleAccept] Processing Follow Accept: actor=${actorUrl}, object.type=${object.type}`)
        await handleAcceptFollow(activity, object)
        return
    }

    // Handle Event Accept (Attendance) - object can be a string (event URL) or object
    if (typeof object === 'string' || (typeof object === 'object' && (object.type === ObjectType.EVENT || object.id))) {
        console.log(`[handleAccept] Routing to handleAcceptEvent`)
        await handleAcceptEvent(activity, object)
        return
    }

    console.log(`[handleAccept] Unhandled Accept object: ${typeof object === 'string' ? object : object?.type || 'unknown'}`)
    console.log(`[handleAccept] Full object: ${JSON.stringify(object, null, 2)}`)
}

async function handleAcceptEvent(activity: AcceptActivity, object: string | ActivityPubEvent | Record<string, unknown>): Promise<void> {
    const actorUrl = activity.actor
    let objectUrl: string
    if (typeof object === 'string') {
        objectUrl = object
    } else if (typeof object === 'object' && object !== null && 'id' in object) {
        objectUrl = object.id as string
    } else {
        objectUrl = ''
    }

    const actor = await fetchActor(actorUrl)
    if (!actor) return

    const actorPerson = actor as unknown as Person
    const remoteUser = await cacheRemoteUser(actorPerson)

    const event = await prisma.event.findFirst({
        where: {
            OR: [
                { externalId: objectUrl },
                { id: objectUrl.split('/').pop() },
            ],
        },
    })

    if (!event) return

    await prisma.eventAttendance.upsert({
        where: {
            eventId_userId: {
                eventId: event.id,
                userId: remoteUser.id,
            },
        },
        update: {
            status: AttendanceStatus.ATTENDING,
        },
        create: {
            eventId: event.id,
            userId: remoteUser.id,
            status: AttendanceStatus.ATTENDING,
            externalId: activity.id,
        },
    })

    // Broadcast update (don't filter by userId - send to all clients)
    await broadcast({
        type: BroadcastEvents.ATTENDANCE_UPDATED,
        data: {
            eventId: event.id,
            userId: remoteUser.id,
            status: AttendanceStatus.ATTENDING,
            user: {
                id: remoteUser.id,
                username: remoteUser.username,
                name: remoteUser.name,
                profileImage: remoteUser.profileImage,
                isRemote: true,
            },
        },
        // Don't set userId filter - send to all clients viewing this event
    })

    console.log(`✅ Attending from ${actorUrl}`)
}

async function handleAcceptFollow(activity: AcceptActivity, followActivity: FollowActivity | Record<string, unknown>): Promise<void> {
    const actorUrl = activity.actor

    const followerUrl = (typeof followActivity === 'object' && followActivity !== null && 'actor' in followActivity) 
        ? followActivity.actor as string 
        : ''
    const baseUrl = getBaseUrl()

    console.log(`[handleAcceptFollow] Processing Accept activity:`)
    console.log(`  - activity.actor (accepter): ${actorUrl}`)
    console.log(`  - followActivity.actor (follower): ${followerUrl}`)
    console.log(`  - baseUrl: ${baseUrl}`)

    // Check if the follower is local
    if (!followerUrl.startsWith(baseUrl)) {
        console.log(`[handleAcceptFollow] Follower is not local: ${followerUrl} does not start with ${baseUrl}`)
        return
    }

    const username = followerUrl.split('/').pop()
    console.log(`[handleAcceptFollow] Looking up local user: ${username}`)

    const localUser = await prisma.user.findUnique({
        where: { username, isRemote: false },
    })

    if (!localUser) {
        console.log(`[handleAcceptFollow] Local user not found: ${username}`)
        return
    }

    console.log(`[handleAcceptFollow] Found local user: ${localUser.id}`)
    console.log(`[handleAcceptFollow] Updating Following record: userId=${localUser.id}, actorUrl=${actorUrl}`)

    // Update following record
    const result = await prisma.following.updateMany({
        where: {
            userId: localUser.id,
            actorUrl,
        },
        data: {
            accepted: true,
        },
    })

    console.log(`[handleAcceptFollow] Updated ${result.count} Following record(s)`)

    // Get the target user (the one being followed) to get their username
    const targetUser = await prisma.user.findFirst({
        where: {
            externalActorUrl: actorUrl,
            isRemote: true,
        },
        select: {
            username: true,
        },
    })

    // Fetch remote follower count from the remote server
    let remoteFollowerCount: number | null = null
    try {
        remoteFollowerCount = await fetchRemoteFollowerCount(actorUrl)
        console.log(`[handleAcceptFollow] Fetched remote follower count: ${remoteFollowerCount}`)
    } catch (error) {
        console.error(`[handleAcceptFollow] Failed to fetch remote follower count:`, error)
    }

    // Broadcast SSE event to notify the follower's clients
    const targetUsername = targetUser?.username || actorUrl.split('/').pop() || 'unknown'
    await broadcastToUser(localUser.id, {
        type: BroadcastEvents.FOLLOW_ACCEPTED,
        data: {
            username: targetUsername,
            actorUrl,
            isAccepted: true,
            followerCount: remoteFollowerCount,
        },
    })

    console.log(`✅ Follow accepted by ${actorUrl}`)
}

/**
 * Handle Create activity
 */
async function handleCreate(activity: CreateActivity): Promise<void> {
    const object = activity.object

    if (!object || !object.type) {
        console.log('Create activity missing object')
        return
    }

    switch (object.type) {
        case ObjectType.EVENT:
            await handleCreateEvent(activity, object)
            break
        case ObjectType.NOTE:
            await handleCreateNote(activity, object)
            break
        default:
            console.log(`Unhandled Create object type: ${object.type}`)
    }
}

/**
 * Extract event properties from ActivityPub event object
 */
function getLocationValue(eventLocation: unknown): string | null {
    if (typeof eventLocation === 'string') {
        return eventLocation
    }
    if (eventLocation && typeof eventLocation === 'object' && 'name' in eventLocation && typeof eventLocation.name === 'string') {
        return eventLocation.name
    }
    return null
}

function getAttachmentUrl(attachment: unknown): string | null {
    if (Array.isArray(attachment) && attachment[0] && typeof attachment[0] === 'object' && attachment[0] !== null && 'url' in attachment[0]) {
        return attachment[0].url as string
    }
    return null
}

function extractEventProperties(event: ActivityPubEvent | Record<string, unknown>) {
    const eventObj = event as Record<string, unknown>

    const getString = (val: unknown) => typeof val === 'string' ? val : null
    const getNumber = (val: unknown) => typeof val === 'number' ? val : null

    return {
        eventId: getString(eventObj.id) || '',
        eventName: getString(eventObj.name) || '',
        eventSummary: getString(eventObj.summary),
        eventContent: getString(eventObj.content),
        locationValue: getLocationValue(eventObj.location),
        eventStartTime: getString(eventObj.startTime) || '',
        eventEndTime: getString(eventObj.endTime),
        eventDuration: getString(eventObj.duration),
        eventUrl: getString(eventObj.url),
        eventStatus: eventObj.eventStatus,
        eventAttendanceMode: eventObj.eventAttendanceMode,
        eventMaxCapacity: getNumber(eventObj.maximumAttendeeCapacity),
        attachmentUrl: getAttachmentUrl(eventObj.attachment),
        attributedTo: getString(eventObj.attributedTo),
    }
}

async function findEventByReference(reference: string) {
    const eventIdCandidate = reference.split('/').pop()
    const conditions: Prisma.EventWhereInput[] = [
        { externalId: reference },
    ]
    if (eventIdCandidate) {
        conditions.push({ id: eventIdCandidate })
    }

    return prisma.event.findFirst({
        where: {
            OR: conditions,
        },
    })
}

async function upsertRemoteEventFromObject(event: ActivityPubEvent | Record<string, unknown>) {
    const {
        eventId,
        eventName,
        eventSummary,
        eventContent,
        locationValue,
        eventStartTime,
        eventEndTime,
        eventDuration,
        eventUrl,
        eventStatus,
        eventAttendanceMode,
        eventMaxCapacity,
        attachmentUrl,
        attributedTo,
    } = extractEventProperties(event)

    if (!eventId || !eventName || !eventStartTime) {
        return null
    }

    const eventData = {
        title: eventName,
        summary: eventSummary || eventContent || null,
        location: locationValue,
        startTime: new Date(eventStartTime),
        endTime: eventEndTime ? new Date(eventEndTime) : null,
        duration: eventDuration || null,
        url: eventUrl || null,
        eventStatus: eventStatus as string | null,
        eventAttendanceMode: eventAttendanceMode as string | null,
        maximumAttendeeCapacity: eventMaxCapacity,
        headerImage: attachmentUrl,
        attributedTo: attributedTo,
    }

    return prisma.event.upsert({
        where: { externalId: eventId },
        update: eventData,
        create: {
            ...eventData,
            externalId: eventId,
            userId: null,
        },
    })
}

// Maximum response size limit (10MB)
const MAX_RESPONSE_SIZE = 10 * 1024 * 1024

async function fetchAndParseRemoteEvent(url: string) {
    const response = await safeFetch(
        url,
        {
            headers: {
                Accept: ContentType.ACTIVITY_JSON,
            },
        },
        10000 // 10 second timeout
    )

    // Check content-length header if available
    const contentLength = response.headers.get('content-length')
    if (contentLength) {
        const size = parseInt(contentLength, 10)
        if (!Number.isNaN(size) && size > MAX_RESPONSE_SIZE) {
            console.error('Response too large:', size, 'bytes')
            return null
        }
    }

    if (!response.ok) {
        return null
    }

    const text = await response.text()
    if (text.length > MAX_RESPONSE_SIZE) {
        console.error('Response body too large:', text.length, 'bytes')
        return null
    }
    try {
        return JSON.parse(text) as Record<string, unknown>
    } catch (parseError) {
        console.error('Error parsing JSON response:', parseError)
        return null
    }
}


async function resolveEventFromString(objectUrl: string) {
    const existing = await findEventByReference(objectUrl)
    if (existing) {
        return existing
    }

    try {
        const payload = await fetchAndParseRemoteEvent(objectUrl)
        if (payload) {
            return upsertRemoteEventFromObject(payload)
        }
    } catch (error) {
        console.error('Error fetching announced event object:', error)
    }

    return null
}

async function resolveSharedEventTarget(object: string | Record<string, unknown> | undefined) {
    if (!object) {
        return null
    }

    if (typeof object === 'string') {
        return resolveEventFromString(object)
    }

    if (typeof object === 'object') {
        return upsertRemoteEventFromObject(object)
    }

    return null
}

async function getActorInfo(actorUrl: string) {
    const actor = await fetchActor(actorUrl)
    if (!actor) {
        console.log('Failed to fetch actor')
        return null
    }
    const remoteUser = await cacheRemoteUser(actor as unknown as Person)
    await trackInstance(actorUrl)
    return remoteUser
}

async function broadcastRemoteEventCreation(createdEvent: Event, remoteUser: User) {
    await broadcast({
        type: BroadcastEvents.EVENT_CREATED,
        data: {
            event: {
                id: createdEvent.id,
                title: createdEvent.title,
                summary: createdEvent.summary,
                location: createdEvent.location,
                url: createdEvent.url,
                startTime: createdEvent.startTime.toISOString(),
                endTime: createdEvent.endTime?.toISOString(),
                eventStatus: createdEvent.eventStatus,
                user: {
                    id: remoteUser.id,
                    username: remoteUser.username,
                    name: remoteUser.name,
                    displayColor: remoteUser.displayColor,
                    profileImage: remoteUser.profileImage,
                    isRemote: true,
                },
                _count: {
                    attendance: 0,
                    likes: 0,
                    comments: 0,
                },
            },
        },
    })
}

/**
 * Handle Create Event
 */
async function handleCreateEvent(activity: CreateActivity, event: ActivityPubEvent | Record<string, unknown>): Promise<void> {
    const remoteUser = await getActorInfo(activity.actor)
    if (!remoteUser) return

    // Extract event properties
    const {
        eventId,
        eventName,
        eventSummary,
        eventContent,
        locationValue,
        eventStartTime,
        eventEndTime,
        eventDuration,
        eventUrl,
        eventStatus,
        eventAttendanceMode,
        eventMaxCapacity,
        attachmentUrl,
        attributedTo,
    } = extractEventProperties(event)

    // Create event in database
    const eventData = {
        title: eventName,
        summary: eventSummary || eventContent || null,
        location: locationValue,
        startTime: new Date(eventStartTime),
        endTime: eventEndTime ? new Date(eventEndTime) : null,
        duration: eventDuration || null,
        url: eventUrl || null,
        eventStatus: eventStatus as string | null,
        eventAttendanceMode: eventAttendanceMode as string | null,
        maximumAttendeeCapacity: eventMaxCapacity,
        headerImage: attachmentUrl,
        attributedTo: attributedTo || activity.actor,
    }

    const createdEvent = await prisma.event.upsert({
        where: { externalId: eventId },
        update: eventData,
        create: {
            ...eventData,
            externalId: eventId,
            userId: null, // Remote event
        },
    })

    // Broadcast real-time update
    await broadcastRemoteEventCreation(createdEvent, remoteUser)

    console.log(`✅ Cached remote event: ${eventName}`)
}

/**
 * Handle Create Note (comment)
 */
async function handleCreateNote(activity: CreateActivity, note: ActivityPubNote | Record<string, unknown>): Promise<void> {
    const actorUrl = activity.actor

    // Cache remote user
    const actor = await fetchActor(actorUrl)
    if (!actor) return

    const actorPerson = actor as unknown as Person
    const remoteUser = await cacheRemoteUser(actorPerson)

    // Type guard for note properties
    const noteObj = note as Record<string, unknown>
    const inReplyTo = typeof noteObj.inReplyTo === 'string' ? noteObj.inReplyTo : null
    if (!inReplyTo) return

    const noteId = typeof noteObj.id === 'string' ? noteObj.id : ''
    const noteContent = typeof noteObj.content === 'string' ? noteObj.content : ''

    // Check if it's replying to an event
    const event = await prisma.event.findFirst({
        where: {
            OR: [
                { externalId: inReplyTo },
                { id: inReplyTo.split('/').pop() },
            ],
        },
    })

    if (!event) {
        console.log('Event not found for comment')
        return
    }

    // Create comment
    const comment = await prisma.comment.create({
        data: {
            externalId: noteId,
            content: noteContent,
            eventId: event.id,
            authorId: remoteUser.id,
        },
        include: {
            author: {
                select: {
                    id: true,
                    username: true,
                    name: true,
                    profileImage: true,
                    displayColor: true,
                    isRemote: true,
                },
            },
        },
    })

    // Broadcast update
    const commentWithAuthor = comment as typeof comment & { author: NonNullable<typeof comment.author> }
    const broadcastData = {
        eventId: event.id,
        comment: {
            id: commentWithAuthor.id,
            content: commentWithAuthor.content,
            createdAt: commentWithAuthor.createdAt.toISOString(),
            author: {
                id: commentWithAuthor.author.id,
                username: commentWithAuthor.author.username,
                name: commentWithAuthor.author.name,
                displayColor: commentWithAuthor.author.displayColor,
            },
        },
    }
    console.log(`📡 Broadcasting comment:added for event ${event.id}`)
    await broadcast({
        type: BroadcastEvents.COMMENT_ADDED,
        data: broadcastData,
    })

    console.log(`✅ Created comment from ${actorUrl}`)
}

/**
 * Handle Update activity
 * 
 * Processes incoming Update activities from remote instances. Currently supports:
 * - Event updates: Changes to event details (title, time, location, status, etc.)
 * - Profile updates: Changes to user profile (name, bio, avatar, display color)
 * 
 * Updates are applied to locally cached copies of remote objects. Only the fields
 * present in the update are modified; missing fields are set to null/undefined.
 * 
 * @param activity - The Update activity containing the updated object
 */
async function handleUpdate(activity: UpdateActivity): Promise<void> {
    const object = activity.object

    if (!object || !object.type) return

    switch (object.type) {
        case ObjectType.EVENT:
            await handleUpdateEvent(object)
            break
        case ObjectType.PERSON:
            await handleUpdatePerson(object)
            break
        default:
            console.log(`Unhandled Update object type: ${object.type}`)
    }
}

/**
 * Handle Update Event
 * 
 * Updates a locally cached remote event with new data. Only events that already
 * exist in the database are updated; Update activities do not create new events.
 * 
 * Fields are updated to match the incoming activity, with null/missing fields
 * clearing the existing values. This ensures the local copy stays synchronized
 * with the authoritative copy on the remote instance.
 * 
 * @param event - The updated event object from the Update activity
 */
async function handleUpdateEvent(event: ActivityPubEvent | Record<string, unknown>): Promise<void> {
    const eventObj = event as Record<string, unknown>
    const eventId = typeof eventObj.id === 'string' ? eventObj.id : ''
    const eventName = typeof eventObj.name === 'string' ? eventObj.name : ''
    const eventSummary = typeof eventObj.summary === 'string' ? eventObj.summary : null
    const eventStartTime = typeof eventObj.startTime === 'string' ? eventObj.startTime : ''
    const eventEndTime = typeof eventObj.endTime === 'string' ? eventObj.endTime : null
    const eventStatus = eventObj.eventStatus
    const eventLocation = eventObj.location
    let locationValue: string | null
    if (typeof eventLocation === 'string') {
        locationValue = eventLocation
    } else if (eventLocation && typeof eventLocation === 'object' && 'name' in eventLocation && typeof eventLocation.name === 'string') {
        locationValue = eventLocation.name
    } else {
        locationValue = null
    }

    await prisma.event.updateMany({
        where: { externalId: eventId },
        data: {
            title: eventName,
            summary: eventSummary || null,
            location: locationValue,
            startTime: new Date(eventStartTime),
            endTime: eventEndTime ? new Date(eventEndTime) : null,
            eventStatus: eventStatus as string | null,
        },
    })

    console.log(`✅ Updated remote event: ${eventName}`)
}

/**
 * Handle Update Person (profile)
 * 
 * Updates a locally cached remote user profile with new data. This keeps the
 * local copy of remote users synchronized when they change their profile details.
 * 
 * Typical profile updates include:
 * - Display name changes
 * - Bio/summary updates  
 * - Avatar or header image changes
 * - Display color preferences
 * 
 * @param person - The updated Person object from the Update activity
 */
async function handleUpdatePerson(person: Person | Record<string, unknown>): Promise<void> {
    const personObj = person as Person
    const personId = personObj.id
    const personName = personObj.name || undefined
    const personSummary = personObj.summary || undefined
    const personDisplayColor = personObj.displayColor || undefined
    const personIconUrl = personObj.icon?.url || undefined
    const personImageUrl = personObj.image?.url || undefined
    const personPreferredUsername = personObj.preferredUsername

    await prisma.user.updateMany({
        where: { externalActorUrl: personId },
        data: {
            name: personName,
            bio: personSummary,
            displayColor: personDisplayColor,
            profileImage: personIconUrl,
            headerImage: personImageUrl,
        },
    })

    console.log(`✅ Updated remote user profile: ${personPreferredUsername}`)
}

/**
 * Handle Delete activity
 * 
 * Processes incoming Delete activities from remote instances. Removes the specified
 * object from the local cache. Currently supports:
 * - Event deletion: Removes cached remote events (cascades to likes, comments, attendance)
 * - Comment deletion: Removes cached remote comments
 * 
 * Delete activities can use either a Tombstone object (with formerType indicating what
 * was deleted) or a plain string/object ID. The object ID is used to find and delete
 * the corresponding local cached copy.
 * 
 * Real-time broadcasts notify connected clients of the deletion so UIs can update.
 * 
 * @param activity - The Delete activity containing the object to be deleted
 */
function getObjectId(object: DeleteActivity['object']): string {
    if (typeof object === 'string') {
        return object
    }
    if (typeof object === 'object' && object !== null && 'id' in object && typeof object.id === 'string') {
        return object.id
    }
    return ''
}

function getFormerType(object: DeleteActivity['object']): string | null {
    if (typeof object === 'object' && object !== null && 'formerType' in object && typeof object.formerType === 'string') {
        return object.formerType
    }
    return null
}

async function handleDeleteComment(objectId: string): Promise<boolean> {
    const comment = await prisma.comment.findFirst({
        where: {
            OR: [{ externalId: objectId }, { id: objectId.split('/').pop() }],
        },
        include: { event: true },
    })

    if (!comment) return false

    await prisma.comment.delete({ where: { id: comment.id } })

    await broadcast({
        type: BroadcastEvents.COMMENT_DELETED,
        data: { eventId: comment.eventId, commentId: comment.id },
    })

    console.log(`✅ Deleted remote comment: ${objectId}`)
    return true
}

async function handleDeleteEvent(objectId: string): Promise<boolean> {
    const deletedEvents = await prisma.event.findMany({ where: { externalId: objectId } })

    if (deletedEvents.length === 0) {
        return false
    }

    const eventIds = deletedEvents.map(e => e.id)
    await prisma.event.deleteMany({ where: { externalId: objectId } })

    for (const eventId of eventIds) {
        await broadcast({
            type: BroadcastEvents.EVENT_DELETED,
            data: { eventId, externalId: objectId },
        })
    }

    console.log(`✅ Deleted ${deletedEvents.length} remote event(s): ${objectId}`)
    return true
}

async function handleDelete(activity: DeleteActivity): Promise<void> {
    const object = activity.object
    const objectId = getObjectId(object)
    if (!objectId) return
    
    const formerType = getFormerType(object)

    if (formerType === ObjectType.NOTE || objectId.includes('/comments/')) {
        if (await handleDeleteComment(objectId)) {
            return
        }
    }

    if (!(await handleDeleteEvent(objectId))) {
        console.log(`⚠️  No event or comment found to delete: ${objectId}`)
    }
}

/**
 * Handle Like activity
 */
async function handleLike(activity: LikeActivity): Promise<void> {
    const actorUrl = activity.actor
    const objectUrl = activity.object

    // Cache remote user
    const actor = await fetchActor(actorUrl)
    if (!actor) return

    const remoteUser = await cacheRemoteUser(actor as unknown as Person)

    // Find event
    const event = await prisma.event.findFirst({
        where: {
            OR: [
                { externalId: objectUrl },
                { id: objectUrl.split('/').pop() },
            ],
        },
    })

    if (!event) return

    // Create like
    await prisma.eventLike.upsert({
        where: {
            eventId_userId: {
                eventId: event.id,
                userId: remoteUser.id,
            },
        },
        update: {},
        create: {
            eventId: event.id,
            userId: remoteUser.id,
            externalId: activity.id,
        },
    })

    // Broadcast update
    await broadcast({
        type: BroadcastEvents.LIKE_ADDED,
        data: {
            eventId: event.id,
            userId: remoteUser.id,
        },
    })

    console.log(`✅ Liked event from ${actorUrl}`)
}

/**
 * Handle Undo activity
 * 
 * Processes incoming Undo activities to reverse previous actions. The Undo activity
 * wraps the original activity being undone. Currently supports:
 * 
 * - Undo Like: Removes a like from an event
 * - Undo Follow: Removes a follower relationship
 * - Undo Accept/TentativeAccept/Reject: Removes attendance status (used when user
 *   changes RSVP or decides not to attend)
 * 
 * The wrapped activity object must include its type and enough information to
 * identify what is being undone. String URLs are not supported; the full activity
 * object must be provided.
 * 
 * Real-time broadcasts notify connected clients of the reversal so UIs can update.
 * 
 * @param activity - The Undo activity containing the original activity to be undone
 */
async function handleUndo(activity: UndoActivity): Promise<void> {
    const object = activity.object

    if (!object) return
    
    // Only process object activities, not string URLs
    if (typeof object === 'string') {
        return
    }
    
    if (typeof object !== 'object' || object === null || !('type' in object)) {
        return
    }
    
    const objectType = typeof object.type === 'string' ? object.type : null
    if (!objectType) return

    // Type guard: ensure object is a Record for the handlers
    const objectRecord = object as Record<string, unknown>

    switch (objectType) {
        case ActivityType.LIKE:
            await handleUndoLike(activity, objectRecord)
            break
        case ActivityType.FOLLOW:
            await handleUndoFollow(activity, objectRecord)
            break
        case ActivityType.ACCEPT:
        case ActivityType.TENTATIVE_ACCEPT:
        case ActivityType.REJECT:
            await handleUndoAttendance(activity, objectRecord)
            break
        default:
            console.log(`Unhandled Undo object type: ${objectType}`)
    }
}

/**
 * Handle Undo Like
 * 
 * Removes a like that was previously added by a Like activity. The user who
 * performed the original like is identified by the activity actor, and the
 * event is identified by the object URL in the wrapped Like activity.
 * 
 * @param activity - The Undo activity
 * @param likeActivity - The wrapped Like activity being undone
 */
async function handleUndoLike(activity: UndoActivity, likeActivity: LikeActivity | Record<string, unknown>): Promise<void> {
    const actorUrl = activity.actor
    let objectUrl: string
    if (typeof likeActivity === 'object' && likeActivity !== null && 'object' in likeActivity) {
        objectUrl = typeof likeActivity.object === 'string' ? likeActivity.object : ''
    } else {
        objectUrl = ''
    }

    const remoteUser = await prisma.user.findUnique({
        where: { externalActorUrl: actorUrl },
    })

    if (!remoteUser) return

    const event = await prisma.event.findFirst({
        where: {
            OR: [
                { externalId: objectUrl },
                { id: objectUrl.split('/').pop() },
            ],
        },
    })

    if (!event) return

    await prisma.eventLike.deleteMany({
        where: {
            eventId: event.id,
            userId: remoteUser.id,
        },
    })

    // Broadcast update
    await broadcast({
        type: BroadcastEvents.LIKE_REMOVED,
        data: {
            eventId: event.id,
            userId: remoteUser.id,
        },
    })

    console.log(`✅ Unliked event from ${actorUrl}`)
}

/**
 * Handle Undo Follow
 * 
 * Removes a follower relationship that was previously established by a Follow activity.
 * The follower is identified by the activity actor, and the target user is identified
 * by the object URL in the wrapped Follow activity.
 * 
 * Only processes unfollows targeting local users. Remote-to-remote unfollows are ignored.
 * Broadcasts a FOLLOWER_REMOVED event to the target user's connected clients.
 * 
 * @param activity - The Undo activity
 * @param followActivity - The wrapped Follow activity being undone
 */
async function handleUndoFollow(activity: UndoActivity, followActivity: FollowActivity | Record<string, unknown>): Promise<void> {
    const actorUrl = activity.actor
    let objectUrl: string
    if (typeof followActivity === 'object' && followActivity !== null && 'object' in followActivity) {
        objectUrl = typeof followActivity.object === 'string' ? followActivity.object : ''
    } else {
        objectUrl = ''
    }

    const baseUrl = getBaseUrl()
    if (!objectUrl || !objectUrl.startsWith(baseUrl)) return

    const username = objectUrl.split('/').pop()
    const targetUser = await prisma.user.findUnique({
        where: { username, isRemote: false },
    })

    if (!targetUser) return

    await prisma.follower.deleteMany({
        where: {
            userId: targetUser.id,
            actorUrl,
        },
    })

    // Calculate current follower count (target user is local, so we can calculate directly)
    const followerCount = await prisma.follower.count({
        where: {
            userId: targetUser.id,
            accepted: true,
        },
    })

    // Broadcast FOLLOWER_REMOVED to the target user's clients (Bob)
    // This notifies Bob that Alice unfollowed him
    await broadcastToUser(targetUser.id, {
        type: BroadcastEvents.FOLLOWER_REMOVED,
        data: {
            username: targetUser.username,
            follower: {
                actorUrl,
            },
            followerCount,
        },
    })

    console.log(`✅ Unfollowed by ${actorUrl}`)
}

/**
 * Handle Undo Attendance
 * 
 * Removes an attendance record (RSVP) that was previously created by an Accept,
 * TentativeAccept, or Reject activity. Used when users change their mind about
 * attending an event or want to remove their RSVP entirely.
 * 
 * The attendee is identified by the activity actor, and the event is identified
 * by the object URL in the wrapped attendance activity.
 * 
 * Broadcasts an ATTENDANCE_REMOVED event to update connected clients' attendance lists.
 * 
 * @param activity - The Undo activity
 * @param attendanceActivity - The wrapped Accept/TentativeAccept/Reject activity being undone
 */
async function handleUndoAttendance(activity: UndoActivity | Record<string, unknown>, attendanceActivity: AcceptActivity | Record<string, unknown>): Promise<void> {
    let actorUrl: string
    if (typeof activity === 'object' && activity !== null && 'actor' in activity && typeof activity.actor === 'string') {
        actorUrl = activity.actor
    } else {
        actorUrl = ''
    }
    let objectUrl: string
    if (typeof attendanceActivity === 'object' && attendanceActivity !== null && 'object' in attendanceActivity) {
        objectUrl = typeof attendanceActivity.object === 'string' ? attendanceActivity.object : ''
    } else {
        objectUrl = ''
    }

    const remoteUser = await prisma.user.findUnique({
        where: { externalActorUrl: actorUrl },
    })

    if (!remoteUser) return

    const event = await prisma.event.findFirst({
        where: {
            OR: [
                { externalId: objectUrl },
                { id: objectUrl.split('/').pop() },
            ],
        },
    })

    if (!event) return

    await prisma.eventAttendance.deleteMany({
        where: {
            eventId: event.id,
            userId: remoteUser.id,
        },
    })

    // Broadcast update
    await broadcast({
        type: BroadcastEvents.ATTENDANCE_REMOVED,
        data: {
            eventId: event.id,
            userId: remoteUser.id,
            user: {
                id: remoteUser.id,
                username: remoteUser.username,
                name: remoteUser.name,
                profileImage: remoteUser.profileImage,
                isRemote: true,
            },
        },
    })

    console.log(`✅ Removed attendance from ${actorUrl}`)
}

/**
 * Handle Announce activity (for "maybe" attendance or shares)
 */
async function handleAnnounce(activity: AnnounceActivity): Promise<void> {
    const actorUrl = activity.actor
    const object = activity.object

    if (!object) {
        console.log('Announce missing object')
        return
    }

    const actor = await fetchActor(actorUrl)
    if (!actor) {
        console.log('Failed to fetch announcer actor')
        return
    }

    const remoteUser = await cacheRemoteUser(actor as unknown as Person)
    const originalEvent = await resolveSharedEventTarget(object)

    if (!originalEvent) {
        console.log(`Announce original event not found: ${typeof object === 'string' ? object : 'inline object'}`)
        return
    }

    const duplicateConditions: Prisma.EventWhereInput[] = []
    if (activity.id) {
        duplicateConditions.push({ externalId: activity.id })
    }
    duplicateConditions.push({
        userId: remoteUser.id,
        sharedEventId: originalEvent.id,
    })

    const existingShare = await prisma.event.findFirst({
        where: {
            OR: duplicateConditions,
        },
    })

    if (existingShare) {
        console.log('Announce already processed for this user and event')
        return
    }

    const share = await prisma.event.create({
        data: {
            title: originalEvent.title,
            summary: originalEvent.summary,
            location: originalEvent.location,
            headerImage: originalEvent.headerImage,
            url: originalEvent.url,
            startTime: originalEvent.startTime,
            endTime: originalEvent.endTime,
            duration: originalEvent.duration,
            eventStatus: originalEvent.eventStatus,
            eventAttendanceMode: originalEvent.eventAttendanceMode,
            maximumAttendeeCapacity: originalEvent.maximumAttendeeCapacity,
            visibility: 'PUBLIC',
            userId: remoteUser.id,
            attributedTo: actorUrl,
            sharedEventId: originalEvent.id,
            externalId: activity.id,
        },
    })

    await broadcast({
        type: BroadcastEvents.EVENT_SHARED,
        data: {
            share: {
                id: share.id,
                originalEventId: originalEvent.id,
                userId: remoteUser.id,
            },
        },
    })

    console.log(`✅ Processed Announce from ${actorUrl} for event ${originalEvent.id}`)
}

/**
 * Handle TentativeAccept activity (maybe attending)
 */
async function handleTentativeAccept(activity: Activity | Record<string, unknown>): Promise<void> {
    let actorUrl: string
    if (typeof activity === 'object' && activity !== null && 'actor' in activity && typeof activity.actor === 'string') {
        actorUrl = activity.actor
    } else {
        actorUrl = ''
    }
    let objectUrl: string
    if (typeof activity === 'object' && activity !== null && 'object' in activity) {
        objectUrl = typeof activity.object === 'string' ? activity.object : ''
    } else {
        objectUrl = ''
    }
    const activityId = (typeof activity === 'object' && activity !== null && 'id' in activity && typeof activity.id === 'string')
        ? activity.id
        : null

    const actor = await fetchActor(actorUrl)
    if (!actor) return

    const actorPerson = actor as unknown as Person
    const remoteUser = await cacheRemoteUser(actorPerson)

    const event = await prisma.event.findFirst({
        where: {
            OR: [
                { externalId: objectUrl },
                { id: objectUrl.split('/').pop() },
            ],
        },
    })

    if (!event) return

    await prisma.eventAttendance.upsert({
        where: {
            eventId_userId: {
                eventId: event.id,
                userId: remoteUser.id,
            },
        },
        update: {
            status: AttendanceStatus.MAYBE,
        },
        create: {
            eventId: event.id,
            userId: remoteUser.id,
            status: AttendanceStatus.MAYBE,
            externalId: activityId,
        },
    })

    // Broadcast update
    await broadcast({
        type: BroadcastEvents.ATTENDANCE_UPDATED,
        data: {
            eventId: event.id,
            userId: remoteUser.id,
            status: AttendanceStatus.MAYBE,
            user: {
                id: remoteUser.id,
                username: remoteUser.username,
                name: remoteUser.name,
                profileImage: remoteUser.profileImage,
                isRemote: true,
            },
        },
    })

    console.log(`✅ Maybe attending from ${actorUrl}`)
}

/**
 * Handle Reject for a Follow activity
 */
async function handleFollowReject(
    actorUrl: string,
    followActivity: Record<string, unknown>,
    remoteUser: { username: string }
): Promise<boolean> {
    const baseUrl = getBaseUrl()
    const followerUrl = (typeof followActivity.actor === 'string') ? followActivity.actor : ''

    // Check if the follower is local
    if (!followerUrl || !followerUrl.startsWith(baseUrl)) {
        return false
    }

    const username = followerUrl.split('/').pop()
    const localUser = await prisma.user.findUnique({
        where: { username, isRemote: false },
    })

    if (!localUser) {
        return false
    }

    // Update Following record to mark as rejected
    // We could delete it, but keeping it with accepted: false allows tracking
    await prisma.following.updateMany({
        where: {
            userId: localUser.id,
            actorUrl,
        },
        data: {
            accepted: false, // Explicitly rejected
        },
    })

    // Broadcast FOLLOW_REJECTED to the follower's clients
    await broadcastToUser(localUser.id, {
        type: BroadcastEvents.FOLLOW_REJECTED,
        data: {
            username: remoteUser.username,
            actorUrl,
            isAccepted: false,
        },
    })

    console.log(`❌ Follow request rejected by ${actorUrl}`)
    return true
}

/**
 * Handle Reject activity (not attending or follow rejection)
 */
async function handleReject(activity: Activity | Record<string, unknown>): Promise<void> {
    const actorUrl = extractActorUrl(activity)
    const object = extractObject(activity)

    const actor = await fetchActor(actorUrl)
    if (!actor) return

    const actorPerson = actor as unknown as Person
    const remoteUser = await cacheRemoteUser(actorPerson)

    if (isFollowRejectObject(object)) {
        const followActivity = object as Record<string, unknown>
        const handled = await handleFollowReject(actorUrl, followActivity, remoteUser)
        if (handled) return
    }

    const objectUrl = resolveObjectUrl(object)
    const event = await findEventByObjectUrl(objectUrl)
    if (!event) return

    const activityId = getActivityId(activity)

    await prisma.eventAttendance.upsert({
        where: {
            eventId_userId: {
                eventId: event.id,
                userId: remoteUser.id,
            },
        },
        update: {
            status: AttendanceStatus.NOT_ATTENDING,
        },
        create: {
            eventId: event.id,
            userId: remoteUser.id,
            status: AttendanceStatus.NOT_ATTENDING,
            externalId: activityId,
        },
    })

    await broadcast({
        type: BroadcastEvents.ATTENDANCE_UPDATED,
        data: {
            eventId: event.id,
            userId: remoteUser.id,
            status: AttendanceStatus.NOT_ATTENDING,
            user: {
                id: remoteUser.id,
                username: remoteUser.username,
                name: remoteUser.name,
                profileImage: remoteUser.profileImage,
                isRemote: true,
            },
        },
    })

    console.log(`✅ Not attending from ${actorUrl}`)
}

function extractActorUrl(activity: Activity | Record<string, unknown>) {
    if (typeof activity === 'object' && activity !== null && 'actor' in activity && typeof activity.actor === 'string') {
        return activity.actor
    }
    return ''
}

function extractObject(activity: Activity | Record<string, unknown>) {
    return typeof activity === 'object' && activity !== null && 'object' in activity ? activity.object : null
}

function isFollowRejectObject(object: unknown) {
    return typeof object === 'object' && object !== null && 'type' in object && (object as { type?: unknown }).type === ActivityType.FOLLOW
}

function resolveObjectUrl(object: unknown) {
    if (typeof object === 'string') return object
    if (typeof object === 'object' && object !== null && 'id' in object && typeof (object as { id?: unknown }).id === 'string') {
        return (object as { id: string }).id
    }
    return ''
}

async function findEventByObjectUrl(objectUrl: string) {
    return prisma.event.findFirst({
        where: {
            OR: [
                { externalId: objectUrl },
                { id: objectUrl.split('/').pop() },
            ],
        },
    })
}

function getActivityId(activity: Activity | Record<string, unknown>) {
    if (typeof activity === 'object' && activity !== null && 'id' in activity && typeof activity.id === 'string') {
        return activity.id
    }
    return null
}
