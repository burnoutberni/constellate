/**
 * Federation Handlers
 * Process incoming ActivityPub activities
 */

import {
    ActivityType,
    ObjectType,
    AttendanceStatus,
} from './constants/activitypub.js'
import {

    cacheRemoteUser,
    fetchActor,
    getBaseUrl,
    fetchRemoteFollowerCount,
} from './lib/activitypubHelpers.js'
import { buildAcceptActivity } from './services/ActivityBuilder.js'
import { deliverToInbox } from './services/ActivityDelivery.js'
import {
    broadcast,
    broadcastToUser,
    BroadcastEvents,
} from './realtime.js'
import { prisma } from './lib/prisma.js'
import type {
    Activity,
    FollowActivity,
    AcceptActivity,
    CreateActivity,
    UpdateActivity,
    DeleteActivity,
    LikeActivity,
    UndoActivity,
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
                await handleAnnounce(activity)
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
        console.error('Error handling activity:', error)
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
function extractEventProperties(event: ActivityPubEvent | Record<string, unknown>) {
    const eventObj = event as Record<string, unknown>
    const eventId = typeof eventObj.id === 'string' ? eventObj.id : ''
    const eventName = typeof eventObj.name === 'string' ? eventObj.name : ''
    const eventSummary = typeof eventObj.summary === 'string' ? eventObj.summary : null
    const eventContent = typeof eventObj.content === 'string' ? eventObj.content : null
    const eventLocation = eventObj.location
    const eventStartTime = typeof eventObj.startTime === 'string' ? eventObj.startTime : ''
    const eventEndTime = typeof eventObj.endTime === 'string' ? eventObj.endTime : null
    const eventDuration = typeof eventObj.duration === 'string' ? eventObj.duration : null
    const eventUrl = typeof eventObj.url === 'string' ? eventObj.url : null
    const eventStatus = eventObj.eventStatus
    const eventAttendanceMode = eventObj.eventAttendanceMode
    const eventMaxCapacity = typeof eventObj.maximumAttendeeCapacity === 'number' ? eventObj.maximumAttendeeCapacity : null
    const eventAttachment = Array.isArray(eventObj.attachment) ? eventObj.attachment : null
    const attachmentUrl = eventAttachment && eventAttachment[0] && typeof eventAttachment[0] === 'object' && eventAttachment[0] !== null && 'url' in eventAttachment[0]
        ? eventAttachment[0].url as string
        : null

    let locationValue: string | null
    if (typeof eventLocation === 'string') {
        locationValue = eventLocation
    } else if (eventLocation && typeof eventLocation === 'object' && 'name' in eventLocation && typeof eventLocation.name === 'string') {
        locationValue = eventLocation.name
    } else {
        locationValue = null
    }

    return {
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
    }
}

/**
 * Handle Create Event
 */
async function handleCreateEvent(activity: CreateActivity, event: ActivityPubEvent | Record<string, unknown>): Promise<void> {
    const actorUrl = activity.actor

    // Cache remote user
    const actor = await fetchActor(actorUrl)
    if (!actor) {
        console.log('Failed to fetch actor')
        return
    }

    const actorPerson = actor as unknown as Person
    const remoteUser = await cacheRemoteUser(actorPerson)

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
        attributedTo: actorUrl,
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
 */
async function handleDelete(activity: DeleteActivity): Promise<void> {
    const object = activity.object
    let objectId: string
    if (typeof object === 'string') {
        objectId = object
    } else if (typeof object === 'object' && object !== null && 'id' in object && typeof object.id === 'string') {
        objectId = object.id
    } else {
        objectId = ''
    }
    const formerType = typeof object === 'object' && object !== null && 'formerType' in object && typeof object.formerType === 'string'
        ? object.formerType
        : null

    // Handle comment deletion (Note/Tombstone)
    if (formerType === ObjectType.NOTE || objectId.includes('/comments/')) {
        const comment = await prisma.comment.findFirst({
            where: {
                OR: [
                    { externalId: objectId },
                    { id: objectId.split('/').pop() },
                ],
            },
            include: {
                event: true,
            },
        })

        if (comment) {
            await prisma.comment.delete({
                where: { id: comment.id },
            })

            // Broadcast update
            await broadcast({
                type: BroadcastEvents.COMMENT_DELETED,
                data: {
                    eventId: comment.eventId,
                    commentId: comment.id,
                },
            })

            console.log(`✅ Deleted remote comment: ${objectId}`)
            return
        }
    }

    // Try to delete event
    const deletedEvents = await prisma.event.findMany({
        where: { externalId: objectId },
    })

    if (deletedEvents.length > 0) {
        const eventIds = deletedEvents.map(e => e.id)

        // Delete events
        await prisma.event.deleteMany({
            where: { externalId: objectId },
        })

        // Broadcast update for each deleted event
        for (const eventId of eventIds) {
            await broadcast({
                type: BroadcastEvents.EVENT_DELETED,
                data: {
                    eventId,
                    externalId: objectId,
                },
            })
        }

        console.log(`✅ Deleted ${deletedEvents.length} remote event(s): ${objectId}`)
    } else {
        console.log(`⚠️  No event found to delete: ${objectId}`)
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
async function handleAnnounce(activity: Activity | Record<string, unknown>): Promise<void> {
    // Announce handling for shares/boosts can be implemented here
    const actorUrl = (typeof activity === 'object' && activity !== null && 'actor' in activity && typeof activity.actor === 'string')
        ? activity.actor
        : 'unknown'
    console.log(`Received Announce from ${actorUrl}`)
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
    let actorUrl: string
    if (typeof activity === 'object' && activity !== null && 'actor' in activity && typeof activity.actor === 'string') {
        actorUrl = activity.actor
    } else {
        actorUrl = ''
    }
    const object = (typeof activity === 'object' && activity !== null && 'object' in activity)
        ? activity.object
        : null

    const actor = await fetchActor(actorUrl)
    if (!actor) return

    const actorPerson = actor as unknown as Person
    const remoteUser = await cacheRemoteUser(actorPerson)

    // Check if this is a Reject for a Follow activity
    // The object could be a Follow activity object or a string URL
    const isFollowReject = typeof object === 'object' && object !== null && 'type' in object && object.type === ActivityType.FOLLOW

    if (isFollowReject) {
        const followActivity = object as Record<string, unknown>
        const handled = await handleFollowReject(actorUrl, followActivity, remoteUser)
        if (handled) {
            return
        }
    }

    // Otherwise, treat as event attendance rejection
    let objectUrl: string
    if (typeof object === 'string') {
        objectUrl = object
    } else if (typeof object === 'object' && object !== null && 'id' in object && typeof object.id === 'string') {
        objectUrl = object.id
    } else {
        objectUrl = ''
    }
    const event = await prisma.event.findFirst({
        where: {
            OR: [
                { externalId: objectUrl },
                { id: objectUrl.split('/').pop() },
            ],
        },
    })

    if (!event) return

    const activityId = (typeof activity === 'object' && activity !== null && 'id' in activity && typeof activity.id === 'string')
        ? activity.id
        : null

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

    // Broadcast update
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
