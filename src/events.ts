/**
 * Event Management
 * CRUD operations for events with ActivityPub federation
 */

import { Hono, Context } from 'hono'
import { z } from 'zod'
import { buildCreateEventActivity, buildUpdateEventActivity, buildDeleteEventActivity } from './services/ActivityBuilder.js'
import { deliverToFollowers, deliverActivity } from './services/ActivityDelivery.js'
import { getBaseUrl } from './lib/activitypubHelpers.js'
import { requireAuth } from './middleware/auth.js'
import { prisma } from './lib/prisma.js'

declare module 'hono' {
    interface ContextVariableMap {
        userId: string
    }
}
const app = new Hono()

// Event validation schema
const EventSchema = z.object({
    title: z.string().min(1).max(200),
    summary: z.string().optional(),
    location: z.string().optional(),
    headerImage: z.string().url().optional(),
    url: z.string().url().optional(),
    startTime: z.string().datetime(),
    endTime: z.string().datetime().optional(),
    duration: z.string().optional(),
    eventStatus: z.enum(['EventScheduled', 'EventCancelled', 'EventPostponed']).optional(),
    eventAttendanceMode: z.enum(['OfflineEventAttendanceMode', 'OnlineEventAttendanceMode', 'MixedEventAttendanceMode']).optional(),
    maximumAttendeeCapacity: z.number().int().positive().optional(),
})

// Create event
app.post('/', async (c) => {
    try {
        // Get userId from context (set by authMiddleware)
        const userId = c.get('userId') as string | undefined
        if (!userId) {
            return c.json({ error: 'Unauthorized' }, 401)
        }

        const body = await c.req.json()
        const validatedData = EventSchema.parse(body)

        const user = await prisma.user.findUnique({
            where: { id: userId },
        })

        if (!user || user.isRemote) {
            return c.json({ error: 'User not found or is remote' }, 404)
        }

        const baseUrl = getBaseUrl()
        const actorUrl = `${baseUrl}/users/${user.username}`

        // Create event
        const event = await prisma.event.create({
            data: {
                ...validatedData,
                startTime: new Date(validatedData.startTime),
                endTime: validatedData.endTime ? new Date(validatedData.endTime) : null,
                userId,
                attributedTo: actorUrl,
            },
            include: {
                user: true,
            },
        })

        // Build and deliver Create activity
        // Ensure event object includes user property for activity builder
        const activity = buildCreateEventActivity({ ...event, user }, userId)
        
        // Use deliverActivity with proper addressing to reach all recipients
        const { getPublicAddressing } = await import('./lib/audience.js')
        const addressing = {
            to: activity.to || [],
            cc: activity.cc || [],
            bcc: [],
        }
        await deliverActivity(activity, addressing, userId)

        // Broadcast real-time update
        const { broadcast, BroadcastEvents } = await import('./realtime.js')
        await broadcast({
            type: BroadcastEvents.EVENT_CREATED,
            data: {
                event: {
                    id: event.id,
                    title: event.title,
                    summary: event.summary,
                    location: event.location,
                    url: event.url,
                    startTime: event.startTime.toISOString(),
                    endTime: event.endTime?.toISOString(),
                    eventStatus: event.eventStatus,
                    user: {
                        id: user.id,
                        username: user.username,
                        name: user.name,
                        displayColor: user.displayColor,
                        profileImage: user.profileImage,
                    },
                    _count: {
                        attendance: 0,
                        likes: 0,
                        comments: 0,
                    },
                },
            },
        })

        return c.json(event, 201)
    } catch (error) {
        if (error instanceof z.ZodError) {
            return c.json({ error: 'Validation failed', details: error.errors }, 400)
        }
        console.error('Error creating event:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// List events
app.get('/', async (c) => {
    try {
        // Optional authentication - get userId from context if available
        const userId = c.get('userId') as string | undefined
        const page = parseInt(c.req.query('page') || '1')
        const limit = parseInt(c.req.query('limit') || '20')
        const skip = (page - 1) * limit

        // Get events from followed users + own events
        let events
        if (userId) {
            const following = await prisma.following.findMany({
                where: { userId, accepted: true },
                select: { actorUrl: true },
            })

            const followedActorUrls = following.map(f => f.actorUrl)
            const baseUrl = getBaseUrl()
            const userActorUrl = `${baseUrl}/users/${userId}`

            events = await prisma.event.findMany({
                where: {
                    OR: [
                        { attributedTo: { in: [...followedActorUrls, userActorUrl] } },
                        { userId },
                    ],
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            name: true,
                            displayColor: true,
                            profileImage: true,
                        },
                    },
                    attendance: {
                        select: {
                            status: true,
                            userId: true,
                        },
                    },
                    likes: {
                        select: {
                            userId: true,
                        },
                    },
                    _count: {
                        select: {
                            attendance: true,
                            likes: true,
                            comments: true,
                        },
                    },
                },
                orderBy: { startTime: 'asc' },
                skip,
                take: limit,
            })
        } else {
            // Public events only
            events = await prisma.event.findMany({
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            name: true,
                            displayColor: true,
                            profileImage: true,
                        },
                    },
                    _count: {
                        select: {
                            attendance: true,
                            likes: true,
                            comments: true,
                        },
                    },
                },
                orderBy: { startTime: 'asc' },
                skip,
                take: limit,
            })
        }

        // For events without user (remote events), populate from cached remote users
        const eventsWithUsers = await Promise.all(
            events.map(async (event) => {
                if (!event.user && event.attributedTo) {
                    // Find cached remote user by attributedTo
                    const remoteUser = await prisma.user.findFirst({
                        where: { externalActorUrl: event.attributedTo },
                        select: {
                            id: true,
                            username: true,
                            name: true,
                            displayColor: true,
                            profileImage: true,
                        },
                    })
                    return { ...event, user: remoteUser }
                }
                return event
            })
        )

        const total = await prisma.event.count()

        return c.json({
            events: eventsWithUsers,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        })
    } catch (error) {
        console.error('Error listing events:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Get event by username and eventId (Mastodon-style URL)
app.get('/by-user/:username/:eventId', async (c) => {
    try {
        const { username, eventId } = c.req.param()

        // Check if it's a remote user (contains @domain)
        const isRemote = username.includes('@')

        // Find the user first
        const user = await prisma.user.findFirst({
            where: {
                username,
                isRemote,
            },
        })

        if (!user) {
            return c.json({ error: 'User not found' }, 404)
        }

        // Find event by eventId and user
        const event = await prisma.event.findFirst({
            where: {
                id: eventId,
                ...(isRemote
                    ? { attributedTo: user.externalActorUrl || undefined }
                    : { userId: user.id }),
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        name: true,
                        displayColor: true,
                        profileImage: true,
                        externalActorUrl: true,
                        isRemote: true,
                    },
                },
                attendance: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                name: true,
                                profileImage: true,
                                isRemote: true,
                            },
                        },
                    },
                },
                likes: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                name: true,
                                profileImage: true,
                                isRemote: true,
                            },
                        },
                    },
                },
                comments: {
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
                        replies: {
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
                        },
                    },
                    where: {
                        inReplyToId: null, // Top-level comments only
                    },
                    orderBy: { createdAt: 'desc' },
                },
                _count: {
                    select: {
                        attendance: true,
                        likes: true,
                        comments: true,
                    },
                },
            },
        })

        if (!event) {
            return c.json({ error: 'Event not found' }, 404)
        }

        // If it's a remote event, fetch fresh data from the remote server and cache it
        if (isRemote && event.externalId) {
            try {
                const remoteResponse = await fetch(event.externalId, {
                    headers: {
                        Accept: 'application/activity+json',
                    },
                })

                if (remoteResponse.ok) {
                    const remoteEvent: any = await remoteResponse.json()

                    // Cache attendance from remote event
                    if (remoteEvent.replies?.items) {
                        for (const reply of remoteEvent.replies.items) {
                            if (reply.type === 'Accept' || reply.type === 'TentativeAccept' || reply.type === 'Reject') {
                                const actorUrl = reply.actor

                                // Find or cache the remote user
                                let attendeeUser = await prisma.user.findFirst({
                                    where: { externalActorUrl: actorUrl },
                                })

                                if (!attendeeUser) {
                                    // Fetch and cache the remote user
                                    const { cacheRemoteUser, fetchActor } = await import('./lib/activitypubHelpers.js')
                                    const actor = await fetchActor(actorUrl)
                                    if (actor) {
                                        attendeeUser = await cacheRemoteUser(actor)
                                    }
                                }

                                if (attendeeUser) {
                                    // Determine status
                                    let status = 'attending'
                                    if (reply.type === 'TentativeAccept') status = 'maybe'
                                    if (reply.type === 'Reject') status = 'not_attending'

                                    // Cache attendance
                                    await prisma.eventAttendance.upsert({
                                        where: {
                                            eventId_userId: {
                                                userId: attendeeUser.id,
                                                eventId: event.id,
                                            },
                                        },
                                        update: { status },
                                        create: {
                                            userId: attendeeUser.id,
                                            eventId: event.id,
                                            status,
                                        },
                                    })
                                }
                            } else if (reply.type === 'Note') {
                                // Cache comment
                                const actorUrl = reply.attributedTo
                                const content = reply.content

                                // Find or cache the remote user
                                let authorUser = await prisma.user.findFirst({
                                    where: { externalActorUrl: actorUrl },
                                })

                                if (!authorUser) {
                                    const { cacheRemoteUser, fetchActor } = await import('./lib/activitypubHelpers.js')
                                    const actor = await fetchActor(actorUrl)
                                    if (actor) {
                                        authorUser = await cacheRemoteUser(actor)
                                    }
                                }

                                if (authorUser) {
                                    await prisma.comment.upsert({
                                        where: { externalId: reply.id },
                                        update: {
                                            content,
                                        },
                                        create: {
                                            externalId: reply.id,
                                            content,
                                            eventId: event.id,
                                            authorId: authorUser.id,
                                        },
                                    })
                                }
                            }
                        }
                    }

                    // Cache likes from remote event
                    if (remoteEvent.likes?.items) {
                        for (const like of remoteEvent.likes.items) {
                            const actorUrl = like.actor || like

                            let likerUser = await prisma.user.findFirst({
                                where: { externalActorUrl: actorUrl },
                            })

                            if (!likerUser) {
                                const { cacheRemoteUser, fetchActor } = await import('./lib/activitypubHelpers.js')
                                const actor = await fetchActor(actorUrl)
                                if (actor) {
                                    likerUser = await cacheRemoteUser(actor)
                                }
                            }

                            if (likerUser) {
                                await prisma.eventLike.upsert({
                                    where: {
                                        eventId_userId: {
                                            userId: likerUser.id,
                                            eventId: event.id,
                                        },
                                    },
                                    update: {},
                                    create: {
                                        userId: likerUser.id,
                                        eventId: event.id,
                                    },
                                })
                            }
                        }
                    }

                    // Update event URL if present in remote event
                    if (remoteEvent.url && remoteEvent.url !== event.url) {
                        await prisma.event.update({
                            where: { id: event.id },
                            data: { url: remoteEvent.url },
                        })
                    }

                    console.log(`✅ Cached attendance and likes for remote event ${event.id}`)
                }
            } catch (error) {
                console.error('Error fetching remote event details:', error)
                // Continue with cached data
            }

            // Re-fetch event with updated attendance and likes
            const updatedEvent = await prisma.event.findFirst({
                where: { id: event.id },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            name: true,
                            displayColor: true,
                            profileImage: true,
                            externalActorUrl: true,
                            isRemote: true,
                        },
                    },
                    attendance: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true,
                                    name: true,
                                    profileImage: true,
                                    isRemote: true,
                                },
                            },
                        },
                    },
                    likes: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true,
                                    name: true,
                                    profileImage: true,
                                    isRemote: true,
                                },
                            },
                        },
                    },
                    comments: {
                        include: {
                            author: {
                                select: {
                                    id: true,
                                    username: true,
                                    name: true,
                                    profileImage: true,
                                    isRemote: true,
                                },
                            },
                            replies: {
                                include: {
                                    author: {
                                        select: {
                                            id: true,
                                            username: true,
                                            name: true,
                                            profileImage: true,
                                            isRemote: true,
                                        },
                                    },
                                },
                            },
                        },
                        where: {
                            inReplyToId: null,
                        },
                        orderBy: { createdAt: 'desc' },
                    },
                    _count: {
                        select: {
                            attendance: true,
                            likes: true,
                            comments: true,
                        },
                    },
                },
            })

            if (updatedEvent) {
                // Populate user if still null
                if (!updatedEvent.user) {
                    const eventWithUser = {
                        ...updatedEvent,
                        user: {
                            id: user.id,
                            username: user.username,
                            name: user.name,
                            displayColor: user.displayColor,
                            profileImage: user.profileImage,
                            externalActorUrl: user.externalActorUrl,
                            isRemote: user.isRemote,
                        },
                    }
                    return c.json(eventWithUser)
                }
                return c.json(updatedEvent)
            }
        }

        // If event has no user (remote event), populate from the user we found earlier
        if (!event.user && isRemote) {
            const eventWithUser = {
                ...event,
                user: {
                    id: user.id,
                    username: user.username,
                    name: user.name,
                    displayColor: user.displayColor,
                    profileImage: user.profileImage,
                    externalActorUrl: user.externalActorUrl,
                    isRemote: user.isRemote,
                },
            }
            return c.json(eventWithUser)
        }

        return c.json(event)
    } catch (error) {
        console.error('Error getting event by username:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Get single event
app.get('/:id', async (c) => {
    try {
        const { id } = c.req.param()

        const event = await prisma.event.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        name: true,
                        displayColor: true,
                        profileImage: true,
                        externalActorUrl: true,
                    },
                },
                attendance: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                name: true,
                                profileImage: true,
                            },
                        },
                    },
                },
                likes: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                name: true,
                                profileImage: true,
                            },
                        },
                    },
                },
                comments: {
                    include: {
                        author: {
                            select: {
                                id: true,
                                username: true,
                                name: true,
                                profileImage: true,
                            },
                        },
                        replies: {
                            include: {
                                author: {
                                    select: {
                                        id: true,
                                        username: true,
                                        name: true,
                                        profileImage: true,
                                    },
                                },
                            },
                        },
                    },
                    where: {
                        inReplyToId: null, // Top-level comments only
                    },
                    orderBy: { createdAt: 'desc' },
                },
                _count: {
                    select: {
                        attendance: true,
                        likes: true,
                        comments: true,
                    },
                },
            },
        })

        if (!event) {
            return c.json({ error: 'Event not found' }, 404)
        }

        return c.json(event)
    } catch (error) {
        console.error('Error getting event:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Update event
app.put('/:id', async (c) => {
    try {
        const { id } = c.req.param()
        const userId = requireAuth(c)

        const body = await c.req.json()
        const validatedData = EventSchema.partial().parse(body)

        // Check ownership
        const existingEvent = await prisma.event.findUnique({
            where: { id },
            include: { user: true },
        })

        if (!existingEvent) {
            return c.json({ error: 'Event not found' }, 404)
        }

        if (existingEvent.userId !== userId) {
            return c.json({ error: 'Forbidden' }, 403)
        }

        // Update event
        const event = await prisma.event.update({
            where: { id },
            data: {
                ...validatedData,
                startTime: validatedData.startTime ? new Date(validatedData.startTime) : undefined,
                endTime: validatedData.endTime ? new Date(validatedData.endTime) : undefined,
            },
            include: {
                user: true,
            },
        })

        // Build and deliver Update activity
        // Ensure event object includes user property for activity builder
        const activity = buildUpdateEventActivity({ ...event, user: event.user }, userId)
        await deliverToFollowers(activity, (event.user as { id: string } | undefined)?.id ?? userId)

        return c.json(event)
    } catch (error) {
        if (error instanceof z.ZodError) {
            return c.json({ error: 'Validation failed', details: error.errors }, 400)
        }
        console.error('Error updating event:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Delete event
app.delete('/:id', async (c) => {
    try {
        const { id } = c.req.param()
        const userId = requireAuth(c)

        // Check ownership
        const event = await prisma.event.findUnique({
            where: { id },
        })

        if (!event) {
            return c.json({ error: 'Event not found' }, 404)
        }

        if (event.userId !== userId) {
            return c.json({ error: 'Forbidden' }, 403)
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
        })

        if (!user) {
            return c.json({ error: 'User not found' }, 404)
        }

        // Build Delete activity before deleting
        const activity = buildDeleteEventActivity(id, user)

        // Get event externalId for broadcast
        const eventExternalId = event.externalId || `${getBaseUrl()}/events/${id}`

        // Delete event (cascades to related records)
        await prisma.event.delete({
            where: { id },
        })

        // Deliver Delete activity to followers
        await deliverToFollowers(activity, userId)

        // Broadcast real-time update
        const { broadcast, BroadcastEvents } = await import('./realtime.js')
        await broadcast({
            type: BroadcastEvents.EVENT_DELETED,
            data: {
                eventId: id,
                externalId: eventExternalId,
            },
        })

        return c.json({ success: true })
    } catch (error) {
        console.error('Error deleting event:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

export default app
