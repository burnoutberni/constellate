/**
 * Federation Handlers
 * Process incoming ActivityPub activities
 */

import { PrismaClient } from '@prisma/client'
import {
    ActivityType,
    ObjectType,
    AttendanceStatus,
} from './constants/activitypub.js'
import {
    isActivityProcessed,
    markActivityProcessed,
    cacheRemoteUser,
    fetchActor,
    getBaseUrl,
} from './lib/activitypubHelpers.js'
import { buildAcceptActivity } from './services/ActivityBuilder.js'
import { deliverToInbox } from './services/ActivityDelivery.js'
import {
    broadcast,
    BroadcastEvents,
} from './realtime.js'

const prisma = new PrismaClient()

/**
 * Main activity handler - routes to specific handlers
 */
export async function handleActivity(activity: any): Promise<void> {
    try {
        // Check if already processed
        if (await isActivityProcessed(activity.id)) {
            console.log(`Activity already processed: ${activity.id}`)
            return
        }

        // Mark as processed
        await markActivityProcessed(activity.id)

        // Route to specific handler
        switch (activity.type) {
            case ActivityType.FOLLOW:
                await handleFollow(activity)
                break
            case ActivityType.ACCEPT:
                await handleAccept(activity)
                break
            case ActivityType.CREATE:
                await handleCreate(activity)
                break
            case ActivityType.UPDATE:
                await handleUpdate(activity)
                break
            case ActivityType.DELETE:
                await handleDelete(activity)
                break
            case ActivityType.LIKE:
                await handleLike(activity)
                break
            case ActivityType.UNDO:
                await handleUndo(activity)
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
    }
}

/**
 * Handle Follow activity
 */
async function handleFollow(activity: any): Promise<void> {
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

    const remoteUser = await cacheRemoteUser(actor)

    // Create or update follower record
    await prisma.follower.upsert({
        where: {
            userId_actorUrl: {
                userId: targetUser.id,
                actorUrl,
            },
        },
        update: {
            accepted: true,
        },
        create: {
            userId: targetUser.id,
            actorUrl,
            username: remoteUser.username,
            inboxUrl: actor.inbox,
            sharedInboxUrl: actor.endpoints?.sharedInbox || null,
            iconUrl: actor.icon?.url || null,
            accepted: true,
        },
    })

    // Send Accept activity
    const acceptActivity = buildAcceptActivity(targetUser, activity)
    const inboxUrl = actor.endpoints?.sharedInbox || actor.inbox
    await deliverToInbox(acceptActivity, inboxUrl, targetUser)

    console.log(`✅ Accepted follow from ${actorUrl}`)
}

/**
 * Handle Accept activity (for our Follow requests)
 */
async function handleAccept(activity: any): Promise<void> {
    const actorUrl = activity.actor
    const object = activity.object

    // Handle Event Accept (Attendance) - object can be a string (event URL) or object
    if (typeof object === 'string' || (typeof object === 'object' && (object.type === ObjectType.EVENT || object.id))) {
        await handleAcceptEvent(activity, object)
        return
    }

    // Handle Follow Accept - object must be an object with type FOLLOW
    if (typeof object === 'object' && object.type === ActivityType.FOLLOW) {
        await handleAcceptFollow(activity, object)
        return
    }

    console.log(`Unhandled Accept object: ${typeof object === 'string' ? object : object?.type || 'unknown'}`)
}

async function handleAcceptEvent(activity: any, object: any): Promise<void> {
    const actorUrl = activity.actor
    const objectUrl = typeof object === 'string' ? object : object.id

    const actor = await fetchActor(actorUrl)
    if (!actor) return

    const remoteUser = await cacheRemoteUser(actor)

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

async function handleAcceptFollow(activity: any, followActivity: any): Promise<void> {
    const actorUrl = activity.actor

    const followerUrl = followActivity.actor
    const baseUrl = getBaseUrl()

    // Check if the follower is local
    if (!followerUrl.startsWith(baseUrl)) {
        console.log('Follower is not local')
        return
    }

    const username = followerUrl.split('/').pop()
    const localUser = await prisma.user.findUnique({
        where: { username, isRemote: false },
    })

    if (!localUser) {
        console.log('Local user not found')
        return
    }

    // Update following record
    await prisma.following.updateMany({
        where: {
            userId: localUser.id,
            actorUrl,
        },
        data: {
            accepted: true,
        },
    })

    console.log(`✅ Follow accepted by ${actorUrl}`)
}

/**
 * Handle Create activity
 */
async function handleCreate(activity: any): Promise<void> {
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
 * Handle Create Event
 */
async function handleCreateEvent(activity: any, event: any): Promise<void> {
    const actorUrl = activity.actor

    // Cache remote user
    const actor = await fetchActor(actorUrl)
    if (!actor) {
        console.log('Failed to fetch actor')
        return
    }

    const remoteUser = await cacheRemoteUser(actor)

    // Create event in database
    const createdEvent = await prisma.event.upsert({
        where: { externalId: event.id },
        update: {
            title: event.name,
            summary: event.summary || event.content || null,
            location: typeof event.location === 'string' ? event.location : event.location?.name || null,
            startTime: new Date(event.startTime),
            endTime: event.endTime ? new Date(event.endTime) : null,
            duration: event.duration || null,
            url: event.url || null,
            eventStatus: event.eventStatus || null,
            eventAttendanceMode: event.eventAttendanceMode || null,
            maximumAttendeeCapacity: event.maximumAttendeeCapacity || null,
            headerImage: event.attachment?.[0]?.url || null,
            attributedTo: actorUrl,
        },
        create: {
            externalId: event.id,
            title: event.name,
            summary: event.summary || event.content || null,
            location: typeof event.location === 'string' ? event.location : event.location?.name || null,
            startTime: new Date(event.startTime),
            endTime: event.endTime ? new Date(event.endTime) : null,
            duration: event.duration || null,
            url: event.url || null,
            eventStatus: event.eventStatus || null,
            eventAttendanceMode: event.eventAttendanceMode || null,
            maximumAttendeeCapacity: event.maximumAttendeeCapacity || null,
            headerImage: event.attachment?.[0]?.url || null,
            attributedTo: actorUrl,
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

    console.log(`✅ Cached remote event: ${event.name}`)
}

/**
 * Handle Create Note (comment)
 */
async function handleCreateNote(activity: any, note: any): Promise<void> {
    const actorUrl = activity.actor

    // Cache remote user
    const actor = await fetchActor(actorUrl)
    if (!actor) return

    const remoteUser = await cacheRemoteUser(actor)

    // Find the event this comment is for
    const inReplyTo = note.inReplyTo
    if (!inReplyTo) return

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
            externalId: note.id,
            content: note.content,
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
    const broadcastData = {
        eventId: event.id,
        comment: {
            id: comment.id,
            content: comment.content,
            createdAt: comment.createdAt.toISOString(),
            author: {
                id: comment.author.id,
                username: comment.author.username,
                name: comment.author.name,
                displayColor: comment.author.displayColor,
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
async function handleUpdate(activity: any): Promise<void> {
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
async function handleUpdateEvent(event: any): Promise<void> {
    await prisma.event.updateMany({
        where: { externalId: event.id },
        data: {
            title: event.name,
            summary: event.summary || null,
            location: typeof event.location === 'string' ? event.location : event.location?.name || null,
            startTime: new Date(event.startTime),
            endTime: event.endTime ? new Date(event.endTime) : null,
            eventStatus: event.eventStatus || null,
        },
    })

    console.log(`✅ Updated remote event: ${event.name}`)
}

/**
 * Handle Update Person (profile)
 */
async function handleUpdatePerson(person: any): Promise<void> {
    await prisma.user.updateMany({
        where: { externalActorUrl: person.id },
        data: {
            name: person.name || null,
            bio: person.summary || null,
            displayColor: person.displayColor || null,
            profileImage: person.icon?.url || null,
            headerImage: person.image?.url || null,
        },
    })

    console.log(`✅ Updated remote user profile: ${person.preferredUsername}`)
}

/**
 * Handle Delete activity
 */
async function handleDelete(activity: any): Promise<void> {
    const object = activity.object
    const objectId = typeof object === 'string' ? object : object.id
    const formerType = typeof object === 'object' ? object.formerType : null

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
async function handleLike(activity: any): Promise<void> {
    const actorUrl = activity.actor
    const objectUrl = activity.object

    // Cache remote user
    const actor = await fetchActor(actorUrl)
    if (!actor) return

    const remoteUser = await cacheRemoteUser(actor)

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
async function handleUndo(activity: any): Promise<void> {
    const object = activity.object

    if (!object || !object.type) return

    switch (object.type) {
        case ActivityType.LIKE:
            await handleUndoLike(activity, object)
            break
        case ActivityType.FOLLOW:
            await handleUndoFollow(activity, object)
            break
        case ActivityType.ACCEPT:
        case ActivityType.TENTATIVE_ACCEPT:
        case ActivityType.REJECT:
            await handleUndoAttendance(activity, object)
            break
        default:
            console.log(`Unhandled Undo object type: ${object.type}`)
    }
}

/**
 * Handle Undo Like
 */
async function handleUndoLike(activity: any, likeActivity: any): Promise<void> {
    const actorUrl = activity.actor
    const objectUrl = likeActivity.object

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
async function handleUndoFollow(activity: any, followActivity: any): Promise<void> {
    const actorUrl = activity.actor
    const objectUrl = followActivity.object

    const baseUrl = getBaseUrl()
    if (!objectUrl.startsWith(baseUrl)) return

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

    console.log(`✅ Unfollowed by ${actorUrl}`)
}

/**
 * Handle Undo Attendance
 */
async function handleUndoAttendance(activity: any, attendanceActivity: any): Promise<void> {
    const actorUrl = activity.actor
    const objectUrl = attendanceActivity.object

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
async function handleAnnounce(activity: any): Promise<void> {
    // Announce handling for shares/boosts can be implemented here
    console.log(`Received Announce from ${activity.actor}`)
}

/**
 * Handle "maybe" attendance
 */
async function handleMaybeAttendance(activity: any): Promise<void> {
    const actorUrl = activity.actor
    const objectUrl = activity.object

    const actor = await fetchActor(actorUrl)
    if (!actor) return

    const remoteUser = await cacheRemoteUser(actor)

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
            externalId: activity.id,
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
 * Handle TentativeAccept activity (attending)
 */
async function handleTentativeAccept(activity: any): Promise<void> {
    const actorUrl = activity.actor
    const objectUrl = activity.object

    const actor = await fetchActor(actorUrl)
    if (!actor) return

    const remoteUser = await cacheRemoteUser(actor)

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
            externalId: activity.id,
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
 * Handle Reject activity (not attending)
 */
async function handleReject(activity: any): Promise<void> {
    const actorUrl = activity.actor
    const objectUrl = activity.object

    const actor = await fetchActor(actorUrl)
    if (!actor) return

    const remoteUser = await cacheRemoteUser(actor)

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
            status: AttendanceStatus.NOT_ATTENDING,
        },
        create: {
            eventId: event.id,
            userId: remoteUser.id,
            status: AttendanceStatus.NOT_ATTENDING,
            externalId: activity.id,
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
