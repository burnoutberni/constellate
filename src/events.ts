/**
 * Event Management
 * CRUD operations for events with ActivityPub federation
 */

import type { Prisma } from '@prisma/client'
import { Hono } from 'hono'
import { z, ZodError } from 'zod'
import {
    buildCreateEventActivity,
    buildUpdateEventActivity,
    buildDeleteEventActivity,
    buildAnnounceEventActivity,
} from './services/ActivityBuilder.js'
import { deliverActivity } from './services/ActivityDelivery.js'
import { getBaseUrl } from './lib/activitypubHelpers.js'
import { requireAuth } from './middleware/auth.js'
import { moderateRateLimit, lenientRateLimit } from './middleware/rateLimit.js'
import { prisma } from './lib/prisma.js'
import { sanitizeText } from './lib/sanitization.js'
import { normalizeTags } from './lib/tags.js'
import type { Person } from './lib/activitypubSchemas.js'
import { buildVisibilityWhere, canUserViewEvent } from './lib/eventVisibility.js'
import { handleError } from './lib/errors.js'
import { config } from './config.js'
import type { Event } from '@prisma/client'
import { RECURRENCE_PATTERNS, validateRecurrenceInput } from './lib/recurrence.js'
import {
    calculateTrendingScore,
    clampTrendingLimit,
    clampTrendingWindowDays,
    DEFAULT_TRENDING_WINDOW_DAYS,
    DAY_IN_MS,
} from './lib/trending.js'

declare module 'hono' {
    interface ContextVariableMap {
        userId: string
    }
}
const app = new Hono()

const commentUserSelect = {
    id: true,
    username: true,
    name: true,
    profileImage: true,
    displayColor: true,
    isRemote: true,
} as const

const commentMentionInclude = {
    mentions: {
        include: {
            mentionedUser: {
                select: commentUserSelect,
            },
        },
    },
} as const

const eventUserSummarySelect = {
    id: true,
    username: true,
    name: true,
    displayColor: true,
    profileImage: true,
    isRemote: true,
} as const

const eventBaseInclude = {
    user: {
        select: eventUserSummarySelect,
    },
    tags: true,
    _count: {
        select: {
            attendance: true,
            likes: true,
            comments: true,
        },
    },
} as const

const authenticatedEventExtras = {
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
} as const

function buildEventInclude(userId?: string) {
    if (userId) {
        return {
            ...eventBaseInclude,
            ...authenticatedEventExtras,
        }
    }
    return eventBaseInclude
}

async function hydrateEventUsers<T extends { user: unknown; attributedTo: string | null }>(
    events: T[]
): Promise<T[]> {
    return Promise.all(
        events.map(async (event) => {
            if (!event.user && event.attributedTo) {
                const remoteUser = await prisma.user.findFirst({
                    where: { externalActorUrl: event.attributedTo },
                    select: eventUserSummarySelect,
                })
                if (remoteUser) {
                    return { ...event, user: remoteUser }
                }
            }
            return event
        })
    )
}

function buildCountMap(records: Array<{ eventId: string }>) {
    return records.reduce<Record<string, number>>((acc, record) => {
        acc[record.eventId] = (acc[record.eventId] ?? 0) + 1
        return acc
    }, {})
}

export function normalizeRecipients(value?: string | string[]): string[] {
    if (!value) {
        return []
    }
    if (Array.isArray(value)) {
        return value
    }
    return [value]
}

export function buildAddressingFromActivity(activity: { to?: string | string[]; cc?: string | string[] }) {
    const toArray = normalizeRecipients(activity.to)
    const ccArray = normalizeRecipients(activity.cc)

    return {
        to: toArray,
        cc: ccArray,
        bcc: [] as string[],
    }
}

export function getBroadcastTarget(visibility: Event['visibility'] | null | undefined, ownerId: string) {
    if (!visibility || visibility === 'PUBLIC' || visibility === 'FOLLOWERS') {
        return undefined
    }
    return ownerId
}

const RecurrencePatternEnum = z.enum(RECURRENCE_PATTERNS)

// Event validation schema
const VisibilitySchema = z.enum(['PUBLIC', 'FOLLOWERS', 'PRIVATE', 'UNLISTED'])

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
    visibility: VisibilitySchema.optional(),
    recurrencePattern: RecurrencePatternEnum.optional().nullable(),
    recurrenceEndDate: z.string().datetime().optional().nullable(),
    tags: z.array(z.string().min(1).max(50)).optional(), // Array of tag strings
})

// Create event
app.post('/', moderateRateLimit, async (c) => {
    try {
        // Get userId from context (set by authMiddleware)
        const userId = c.get('userId') as string | undefined
        if (!userId) {
            return c.json({ error: 'Unauthorized' }, 401)
        }

        const body = await c.req.json()
        const validatedData = EventSchema.parse(body)
        const { visibility: requestedVisibility } = validatedData
        const visibility = requestedVisibility ?? 'PUBLIC'

        const startTime = new Date(validatedData.startTime)
        const endTime = validatedData.endTime ? new Date(validatedData.endTime) : null
        const recurrencePattern = validatedData.recurrencePattern ?? null
        const recurrenceEndDate = validatedData.recurrenceEndDate
            ? new Date(validatedData.recurrenceEndDate)
            : null

        validateRecurrenceInput(startTime, recurrencePattern, recurrenceEndDate)

        const user = await prisma.user.findUnique({
            where: { id: userId },
        })

        if (!user || user.isRemote) {
            return c.json({ error: 'User not found or is remote' }, 404)
        }

        const baseUrl = getBaseUrl()
        const actorUrl = `${baseUrl}/users/${user.username}`

        // Extract tags from validated data
        const { tags } = validatedData

        // Normalize tags and only create if there are valid tags after normalization
        let tagsToCreate: Array<{ tag: string }> | undefined = undefined
        if (tags && Array.isArray(tags) && tags.length > 0) {
            try {
                const normalizedTags = normalizeTags(tags)
                if (normalizedTags && normalizedTags.length > 0) {
                    tagsToCreate = normalizedTags.map(tag => ({ tag }))
                }
            } catch (error) {
                console.error('Error normalizing tags:', error)
                // Return validation error when tag normalization fails
                return c.json({ 
                    error: 'VALIDATION_ERROR', 
                    message: 'Failed to process tags: ensure tags are valid strings',
                    details: config.isDevelopment ? { originalError: String(error) } : undefined
                }, 400)
            }
        }

        // Create event with sanitized input
        const event = await prisma.event.create({
            data: {
                title: sanitizeText(validatedData.title),
                summary: validatedData.summary ? sanitizeText(validatedData.summary) : null,
                location: validatedData.location ? sanitizeText(validatedData.location) : null,
                headerImage: validatedData.headerImage || null,
                url: validatedData.url || null,
                startTime,
                endTime,
                duration: validatedData.duration || null,
                eventStatus: validatedData.eventStatus || null,
                eventAttendanceMode: validatedData.eventAttendanceMode || null,
                maximumAttendeeCapacity: validatedData.maximumAttendeeCapacity || null,
                userId,
                attributedTo: actorUrl,
                visibility,
                recurrencePattern,
                recurrenceEndDate,
                ...(tagsToCreate && tagsToCreate.length > 0 ? {
                    tags: {
                        create: tagsToCreate,
                    },
                } : {}),
            },
            include: {
                user: true,
                tags: true,
            },
        })

        // Build and deliver Create activity
        // Ensure event object includes user property for activity builder
        const activity = buildCreateEventActivity({ ...event, user }, userId)

        const addressing = buildAddressingFromActivity(activity)
        await deliverActivity(activity, addressing, userId)

        // Broadcast real-time update
        const { broadcast, BroadcastEvents } = await import('./realtime.js')
        const broadcastPayload = {
            event: {
                id: event.id,
                title: event.title,
                summary: event.summary,
                location: event.location,
                url: event.url,
                startTime: event.startTime.toISOString(),
                endTime: event.endTime?.toISOString(),
                eventStatus: event.eventStatus,
                visibility: event.visibility,
                recurrencePattern: event.recurrencePattern,
                recurrenceEndDate: event.recurrenceEndDate?.toISOString(),
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
        }
        const broadcastTarget = getBroadcastTarget(event.visibility, userId)
        await broadcast({
            type: BroadcastEvents.EVENT_CREATED,
            data: broadcastPayload,
            ...(broadcastTarget ? { targetUserId: broadcastTarget } : {}),
        })

        return c.json(event, 201)
    } catch (error) {
        console.error('Error creating event:', error)
        return handleError(error, c)
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

        const rangeStartParam = c.req.query('rangeStart')
        const rangeEndParam = c.req.query('rangeEnd')
        let rangeStartDate: Date | undefined
        let rangeEndDate: Date | undefined

        if (rangeStartParam) {
            const parsed = new Date(rangeStartParam)
            if (!Number.isNaN(parsed.getTime())) {
                rangeStartDate = parsed
            }
        }

        if (rangeEndParam) {
            const parsed = new Date(rangeEndParam)
            if (!Number.isNaN(parsed.getTime())) {
                rangeEndDate = parsed
            }
        }

        let rangeFilter: Prisma.EventWhereInput | undefined
        if (rangeStartDate && rangeEndDate) {
            rangeFilter = {
                OR: [
                    {
                        startTime: {
                            gte: rangeStartDate,
                            lte: rangeEndDate,
                        },
                    },
                    {
                        AND: [
                            { recurrencePattern: { not: null } },
                            { startTime: { lte: rangeEndDate } },
                            { recurrenceEndDate: { gte: rangeStartDate } },
                        ],
                    },
                ],
            }
        }

        let followedActorUrls: string[] = []
        if (userId) {
            const following = await prisma.following.findMany({
                where: { userId, accepted: true },
                select: { actorUrl: true },
            })
            followedActorUrls = following.map(f => f.actorUrl)
        }

        // Build visibility filter
        const visibilityWhere = userId
            ? buildVisibilityWhere({ userId, followedActorUrls })
            : { visibility: 'PUBLIC' as const }

        // Combine visibility, sharedEventId, and range filters
        const filters: Prisma.EventWhereInput[] = [
            visibilityWhere,
            { sharedEventId: null },
        ]
        if (rangeFilter) {
            filters.push(rangeFilter)
        }
        const where = filters.length === 1 ? filters[0] : { AND: filters }

        const events = await prisma.event.findMany({
            where,
            include: buildEventInclude(userId),
            orderBy: { startTime: 'asc' },
            skip,
            take: limit,
        })

        const eventsWithUsers = await hydrateEventUsers(events)

        const total = await prisma.event.count({ where })

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

app.get('/trending', lenientRateLimit, async (c) => {
    try {
        const userId = c.get('userId') as string | undefined
        const limitParam = Number.parseInt(c.req.query('limit') ?? '')
        const windowParam = Number.parseInt(c.req.query('windowDays') ?? '')

        const limit = clampTrendingLimit(limitParam)
        const windowDays = clampTrendingWindowDays(windowParam || DEFAULT_TRENDING_WINDOW_DAYS)

        const now = new Date()
        const windowStart = new Date(now.getTime() - windowDays * DAY_IN_MS)

        let followedActorUrls: string[] = []
        if (userId) {
            const following = await prisma.following.findMany({
                where: { userId, accepted: true },
                select: { actorUrl: true },
            })
            followedActorUrls = following.map(f => f.actorUrl)
        }

        const visibilityWhere = userId
            ? buildVisibilityWhere({ userId, followedActorUrls })
            : { visibility: 'PUBLIC' as const }

        const filters: Prisma.EventWhereInput[] = [
            visibilityWhere,
            { sharedEventId: null },
            {
                OR: [
                    { startTime: { gte: windowStart } },
                    { updatedAt: { gte: windowStart } },
                ],
            },
        ]
        const where = filters.length === 1 ? filters[0] : { AND: filters }

        const candidateLimit = Math.min(limit * 3, 100)
        const candidateEvents = await prisma.event.findMany({
            where,
            include: buildEventInclude(userId),
            orderBy: [
                { updatedAt: 'desc' },
                { startTime: 'asc' },
            ],
            take: candidateLimit,
        })

        const hydratedEvents = await hydrateEventUsers(candidateEvents)
        const eventIds = hydratedEvents.map((event) => event.id)

        if (eventIds.length === 0) {
            return c.json({
                events: [],
                windowDays,
                generatedAt: now.toISOString(),
            })
        }

        const [likes, comments, attendance] = await Promise.all([
            prisma.eventLike.findMany({
                where: {
                    eventId: { in: eventIds },
                    createdAt: { gte: windowStart },
                },
                select: { eventId: true },
            }),
            prisma.comment.findMany({
                where: {
                    eventId: { in: eventIds },
                    createdAt: { gte: windowStart },
                },
                select: { eventId: true },
            }),
            prisma.eventAttendance.findMany({
                where: {
                    eventId: { in: eventIds },
                    createdAt: { gte: windowStart },
                },
                select: { eventId: true },
            }),
        ])

        const likeCountMap = buildCountMap(likes)
        const commentCountMap = buildCountMap(comments)
        const attendanceCountMap = buildCountMap(attendance)

        const scoredEvents = hydratedEvents
            .map((event) => {
                const metrics = {
                    likes: likeCountMap[event.id] ?? 0,
                    comments: commentCountMap[event.id] ?? 0,
                    attendance: attendanceCountMap[event.id] ?? 0,
                }
                const engagementTotal = metrics.likes + metrics.comments + metrics.attendance
                const score = calculateTrendingScore({
                    metrics,
                    event,
                    windowDays,
                    now,
                })
                return {
                    event,
                    metrics,
                    engagementTotal,
                    score,
                }
            })
            .filter(({ engagementTotal, score }) => engagementTotal > 0 && score > 0)
            .sort((a, b) => {
                if (b.score !== a.score) {
                    return b.score - a.score
                }
                if (b.metrics.likes !== a.metrics.likes) {
                    return b.metrics.likes - a.metrics.likes
                }
                return a.event.startTime.getTime() - b.event.startTime.getTime()
            })
            .slice(0, limit)

        const events = scoredEvents.map(({ event, metrics, score }, index) => ({
            ...event,
            trendingScore: score,
            trendingRank: index + 1,
            trendingMetrics: metrics,
        }))

        return c.json({
            events,
            windowDays,
            generatedAt: now.toISOString(),
        })
    } catch (error) {
        console.error('Error fetching trending events:', error)
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
                tags: true,
                sharedEvent: {
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
                            select: commentUserSelect,
                        },
                        ...commentMentionInclude,
                        replies: {
                            include: {
                                author: {
                                    select: commentUserSelect,
                                },
                                ...commentMentionInclude,
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

        const viewerId = c.get('userId') as string | undefined
        const canView = await canUserViewEvent(event, viewerId)
        if (!canView) {
            return c.json({ error: 'Forbidden' }, 403)
        }

        // Check if viewer has shared the original event
        const originalEvent = event.sharedEvent ?? event
        let userHasShared = false
        if (viewerId) {
            const existingShare = await prisma.event.findFirst({
                where: {
                    userId: viewerId,
                    sharedEventId: originalEvent.id,
                },
                select: { id: true },
            })
            userHasShared = !!existingShare
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
                    const remoteEvent = await remoteResponse.json() as Record<string, unknown>

                    // Cache attendance from remote event
                    if (remoteEvent && typeof remoteEvent === 'object' && 'replies' in remoteEvent) {
                        const replies = remoteEvent.replies as { items?: unknown[] } | undefined
                        if (replies?.items) {
                            for (const reply of replies.items) {
                                const replyObj = reply as Record<string, unknown>
                                const replyType = replyObj.type
                                if (replyType === 'Accept' || replyType === 'TentativeAccept' || replyType === 'Reject') {
                                    const actorUrl = replyObj.actor as string | undefined

                                    // Find or cache the remote user
                                    let attendeeUser = await prisma.user.findFirst({
                                        where: { externalActorUrl: actorUrl },
                                    })

                                    if (!attendeeUser) {
                                        // Fetch and cache the remote user
                                        const { cacheRemoteUser, fetchActor } = await import('./lib/activitypubHelpers.js')
                                        const actor = actorUrl ? await fetchActor(actorUrl) : null
                                        if (actor) {
                                            attendeeUser = await cacheRemoteUser(actor as unknown as Person)
                                        }
                                    }

                                    if (attendeeUser) {
                                        // Determine status
                                        let status = 'attending'
                                        if (replyType === 'TentativeAccept') status = 'maybe'
                                        if (replyType === 'Reject') status = 'not_attending'

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
                                } else if (replyType === 'Note') {
                                    // Cache comment
                                    const actorUrl = replyObj.attributedTo as string | undefined
                                    const content = replyObj.content as string | undefined

                                    if (!actorUrl || !content) continue

                                    // Find or cache the remote user
                                    let authorUser = await prisma.user.findFirst({
                                        where: { externalActorUrl: actorUrl },
                                    })

                                    if (!authorUser) {
                                        const { cacheRemoteUser, fetchActor } = await import('./lib/activitypubHelpers.js')
                                        const actor = await fetchActor(actorUrl)
                                        if (actor) {
                                            authorUser = await cacheRemoteUser(actor as unknown as Person)
                                        }
                                    }

                                    if (authorUser && content && replyObj.id) {
                                        await prisma.comment.upsert({
                                            where: { externalId: replyObj.id as string },
                                            update: {
                                                content,
                                            },
                                            create: {
                                                externalId: replyObj.id as string,
                                                content,
                                                eventId: event.id,
                                                authorId: authorUser.id,
                                            },
                                        })
                                    }
                                }
                            }
                        }
                    }

                    // Cache likes from remote event
                    const likes = remoteEvent.likes as { items?: unknown[] } | undefined
                    if (likes?.items) {
                        for (const like of likes.items) {
                            const likeObj = like as Record<string, unknown> | string
                            let actorUrl: string | undefined
                            if (typeof likeObj === 'object' && likeObj !== null && 'actor' in likeObj) {
                                actorUrl = likeObj.actor as string
                            } else if (typeof likeObj === 'string') {
                                actorUrl = likeObj
                            }

                            let likerUser = await prisma.user.findFirst({
                                where: { externalActorUrl: actorUrl },
                            })

                            if (!likerUser && actorUrl) {
                                const { cacheRemoteUser, fetchActor } = await import('./lib/activitypubHelpers.js')
                                const actor = await fetchActor(actorUrl)
                                if (actor) {
                                    likerUser = await cacheRemoteUser(actor as unknown as Person)
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
                    const remoteUrl = remoteEvent.url as string | undefined
                    if (remoteUrl && remoteUrl !== event.url) {
                        await prisma.event.update({
                            where: { id: event.id },
                            data: { url: remoteUrl },
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
                                select: commentUserSelect,
                            },
                            ...commentMentionInclude,
                            replies: {
                                include: {
                                    author: {
                                        select: commentUserSelect,
                                    },
                                    ...commentMentionInclude,
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
                        userHasShared,
                    }
                    return c.json(eventWithUser)
                }
                return c.json({ ...updatedEvent, userHasShared })
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
                userHasShared,
            }
            return c.json(eventWithUser)
        }

        return c.json({ ...event, userHasShared })
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
                tags: true,
                sharedEvent: {
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
                            select: commentUserSelect,
                        },
                        ...commentMentionInclude,
                        replies: {
                            include: {
                                author: {
                                    select: commentUserSelect,
                                },
                                ...commentMentionInclude,
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

        const viewerId = c.get('userId') as string | undefined
        const canView = await canUserViewEvent(event, viewerId)
        if (!canView) {
            return c.json({ error: 'Forbidden' }, 403)
        }

        // Check if viewer has shared the original event
        const originalEvent = event.sharedEvent ?? event
        let userHasShared = false
        if (viewerId) {
            const existingShare = await prisma.event.findFirst({
                where: {
                    userId: viewerId,
                    sharedEventId: originalEvent.id,
                },
                select: { id: true },
            })
            userHasShared = !!existingShare
        }

        return c.json({ ...event, userHasShared })
    } catch (error) {
        console.error('Error getting event:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Share (repost) event
app.post('/:id/share', moderateRateLimit, async (c) => {
    try {
        const { id } = c.req.param()
        const userId = requireAuth(c)

        const shareUser = await prisma.user.findUnique({
            where: { id: userId },
        })

        if (!shareUser || shareUser.isRemote) {
            return c.json({ error: 'User not found or is remote' }, 404)
        }

        const includeShareRelations = {
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
            sharedEvent: {
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
                },
            },
        }

        const event = await prisma.event.findUnique({
            where: { id },
            include: includeShareRelations,
        })

        if (!event) {
            return c.json({ error: 'Event not found' }, 404)
        }

        const originalEvent = event.sharedEvent ?? event

        // Check if user can view the original event (this already enforces visibility rules)
        const canViewOriginal = await canUserViewEvent(originalEvent, userId)
        if (!canViewOriginal) {
            return c.json({ error: 'Forbidden' }, 403)
        }

        // Explicitly check visibility for sharing - only PUBLIC events can be shared
        // This is a business rule separate from viewing permissions
        if (originalEvent.visibility !== 'PUBLIC') {
            return c.json({ error: 'Only public events can be shared' }, 403 as const)
        }

        const duplicateShare = await prisma.event.findFirst({
            where: {
                userId,
                sharedEventId: originalEvent.id,
            },
            include: includeShareRelations,
        })

        if (duplicateShare) {
            return c.json({ share: duplicateShare, alreadyShared: true })
        }

        const baseUrl = getBaseUrl()
        const originalActorUrl = originalEvent.attributedTo
            ?? (originalEvent.user ? `${baseUrl}/users/${originalEvent.user.username}` : undefined)
        const originalEventUrl = originalEvent.externalId || `${baseUrl}/events/${originalEvent.id}`

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
                userId,
                attributedTo: `${baseUrl}/users/${shareUser.username}`,
                sharedEventId: originalEvent.id,
            },
            include: includeShareRelations,
        })

        const announceActivity = buildAnnounceEventActivity(
            shareUser,
            originalEventUrl,
            originalEvent.visibility,
            originalActorUrl
        )
        const addressing = buildAddressingFromActivity(announceActivity)
        await deliverActivity(announceActivity, addressing, userId)

        const { broadcast, BroadcastEvents } = await import('./realtime.js')
        await broadcast({
            type: BroadcastEvents.EVENT_SHARED,
            data: {
                share: {
                    id: share.id,
                    originalEventId: originalEvent.id,
                    userId,
                },
            },
        })

        return c.json({ share, alreadyShared: false }, 201)
    } catch (error) {
        console.error('Error sharing event:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Update event
app.put('/:id', moderateRateLimit, async (c) => {
    try {
        const { id } = c.req.param()
        const userId = requireAuth(c)

        const body = await c.req.json()
        const validatedData = EventSchema.partial().parse(body)
        const { visibility: requestedVisibility } = validatedData

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

        const nextStartTime = validatedData.startTime
            ? new Date(validatedData.startTime)
            : existingEvent.startTime
        const nextRecurrencePattern =
            validatedData.recurrencePattern !== undefined
                ? (validatedData.recurrencePattern || null)
                : existingEvent.recurrencePattern
        let nextRecurrenceEndDate: Date | null
        if (validatedData.recurrenceEndDate !== undefined) {
            nextRecurrenceEndDate = validatedData.recurrenceEndDate
                ? new Date(validatedData.recurrenceEndDate)
                : null
        } else {
            nextRecurrenceEndDate = existingEvent.recurrenceEndDate
        }

        validateRecurrenceInput(nextStartTime, nextRecurrencePattern, nextRecurrenceEndDate)

        // Extract tags from validated data
        const { tags } = validatedData
        let normalizedTags: string[] | undefined

        // Update event with sanitized input
        const updateData: Record<string, unknown> = {
            ...(validatedData.title !== undefined && { title: sanitizeText(validatedData.title) }),
            ...(validatedData.summary !== undefined && { summary: validatedData.summary ? sanitizeText(validatedData.summary) : null }),
            ...(validatedData.location !== undefined && { location: validatedData.location ? sanitizeText(validatedData.location) : null }),
            ...(validatedData.headerImage !== undefined && { headerImage: validatedData.headerImage ? validatedData.headerImage : null }),
            ...(validatedData.url !== undefined && { url: validatedData.url ? validatedData.url : null }),
            ...(validatedData.startTime !== undefined && { startTime: new Date(validatedData.startTime) }),
            ...(validatedData.endTime !== undefined && { endTime: validatedData.endTime ? new Date(validatedData.endTime) : null }),
            ...(validatedData.duration !== undefined && { duration: validatedData.duration ? validatedData.duration : null }),
            ...(validatedData.eventStatus !== undefined && { eventStatus: validatedData.eventStatus ? validatedData.eventStatus : null }),
            ...(validatedData.eventAttendanceMode !== undefined && { eventAttendanceMode: validatedData.eventAttendanceMode ? validatedData.eventAttendanceMode : null }),
            ...(validatedData.maximumAttendeeCapacity !== undefined && { maximumAttendeeCapacity: validatedData.maximumAttendeeCapacity ? validatedData.maximumAttendeeCapacity : null }),
            ...(requestedVisibility !== undefined && { visibility: requestedVisibility }),
        }

        if (validatedData.recurrencePattern !== undefined) {
            updateData.recurrencePattern = nextRecurrencePattern
        }
        if (validatedData.recurrenceEndDate !== undefined) {
            updateData.recurrenceEndDate = nextRecurrenceEndDate
        }

        // Update tags if provided
        if (tags !== undefined) {
            try {
                normalizedTags = Array.isArray(tags) && tags.length > 0 ? normalizeTags(tags) : []
            } catch (error) {
                console.error('Error normalizing tags in update:', error)
                // Return validation error when tag normalization fails (consistent with create)
                return c.json({ 
                    error: 'VALIDATION_ERROR', 
                    message: 'Failed to process tags: ensure tags are valid strings',
                    details: config.isDevelopment ? { originalError: String(error) } : undefined
                }, 400)
            }
        }

        const event = await prisma.$transaction(async (tx) => {
            // If updateData is empty (only tags being updated), explicitly update updatedAt
            // to trigger the timestamp update
            let finalUpdateData = updateData
            if (Object.keys(updateData).length === 0) {
                finalUpdateData = { updatedAt: new Date() }
            }
            
            const updatedEvent = await tx.event.update({
                where: { id },
                data: finalUpdateData,
                include: {
                    user: true,
                    tags: true,
                },
            })

            if (normalizedTags === undefined) {
                return updatedEvent
            }

            await tx.eventTag.deleteMany({
                where: { eventId: id },
            })

            if (normalizedTags.length > 0) {
                await tx.eventTag.createMany({
                    data: normalizedTags.map(tag => ({
                        eventId: id,
                        tag,
                    })),
                })
            }

            const refreshedEvent = await tx.event.findUnique({
                where: { id },
                include: {
                    user: true,
                    tags: true,
                },
            })

            return refreshedEvent ?? updatedEvent
        })

        if (!event) {
            console.error('Failed to retrieve updated event after transaction', { eventId: id, userId })
            return c.json({ error: 'Internal server error' }, 500)
        }

        // Build and deliver Update activity
        // Ensure event object includes user property for activity builder
        if (!event.user) {
            throw new Error('Event missing user data - data integrity issue')
        }
        const activity = buildUpdateEventActivity({ ...event, user: event.user }, userId)
        const addressing = buildAddressingFromActivity(activity)
        await deliverActivity(activity, addressing, userId)

        const { broadcast, BroadcastEvents } = await import('./realtime.js')
        const broadcastTarget = getBroadcastTarget(event.visibility, userId)
        
        // These fields should always exist on an event from the database
        if (!event.startTime || !event.createdAt || !event.updatedAt) {
            throw new Error('Event missing required timestamp fields')
        }
        
        await broadcast({
            type: BroadcastEvents.EVENT_UPDATED,
            data: {
                event: {
                    ...event,
                    startTime: event.startTime.toISOString(),
                    endTime: event.endTime?.toISOString(),
                    createdAt: event.createdAt.toISOString(),
                    updatedAt: event.updatedAt.toISOString(),
                },
            },
            ...(broadcastTarget ? { targetUserId: broadcastTarget } : {}),
        })

        return c.json(event)
    } catch (error) {
        if (error instanceof ZodError) {
            return c.json({ error: 'Validation failed', details: error.issues }, 400 as const)
        }
        console.error('Error updating event:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Delete event
app.delete('/:id', moderateRateLimit, async (c) => {
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
        const activity = buildDeleteEventActivity(id, user, event.visibility)

        // Get event externalId for broadcast
        const eventExternalId = event.externalId || `${getBaseUrl()}/events/${id}`

        // Delete event (cascades to related records)
        await prisma.event.delete({
            where: { id },
        })

        const addressing = buildAddressingFromActivity(activity)
        await deliverActivity(activity, addressing, userId)

        // Broadcast real-time update
        const { broadcast, BroadcastEvents } = await import('./realtime.js')
        const broadcastTarget = getBroadcastTarget(event.visibility, userId)
        await broadcast({
            type: BroadcastEvents.EVENT_DELETED,
            data: {
                eventId: id,
                externalId: eventExternalId,
            },
            ...(broadcastTarget ? { targetUserId: broadcastTarget } : {}),
        })

        return c.json({ success: true })
    } catch (error) {
        console.error('Error deleting event:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

export default app
