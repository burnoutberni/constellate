/**
 * Event Search and Filtering
 * Advanced search capabilities for events
 */


import { Hono } from 'hono'
import { z, ZodError } from 'zod'
import type { Prisma } from '@prisma/client'
import { prisma } from './lib/prisma.js'
import { lenientRateLimit } from './middleware/rateLimit.js'
import { buildVisibilityWhere } from './lib/eventVisibility.js'
import { normalizeTags } from './lib/tags.js'

const app = new Hono()

// Custom error class for user not found
class UserNotFoundError extends Error {
    constructor(username: string) {
        super(`User not found: ${username}`)
        this.name = 'UserNotFoundError'
    }
}

// Apply rate limiting to all search endpoints
app.use('*', lenientRateLimit)


// Search validation schema
const SearchSchema = z.object({
    q: z.string().max(200).optional(), // Search query with length limit
    location: z.string().max(200).optional(), // Location filter
    startDate: z.string().datetime().optional(), // Start date filter
    endDate: z.string().datetime().optional(), // End date filter
    status: z.enum(['EventScheduled', 'EventCancelled', 'EventPostponed']).optional(),
    mode: z.enum(['OfflineEventAttendanceMode', 'OnlineEventAttendanceMode', 'MixedEventAttendanceMode']).optional(),
    username: z.string().max(200).optional(), // Filter by organizer
    tags: z.string().optional(), // Comma-separated tags
    page: z.string().optional(),
    limit: z.string().optional(),
})

const buildSearchWhereClause = async (params: z.infer<typeof SearchSchema>): Promise<Prisma.EventWhereInput> => {
    const where: Record<string, unknown> = {}

    if (params.q) {
        where.OR = [
            { title: { contains: params.q, mode: 'insensitive' } },
            { summary: { contains: params.q, mode: 'insensitive' } },
        ]
    }

    if (params.location) {
        where.location = { contains: params.location, mode: 'insensitive' }
    }

    if (params.startDate || params.endDate) {
        where.startTime = {} as { gte?: Date; lte?: Date }
        if (params.startDate) {
            (where.startTime as { gte: Date }).gte = new Date(params.startDate)
        }
        if (params.endDate) {
            (where.startTime as { lte: Date }).lte = new Date(params.endDate)
        }
    }

    if (params.status) {
        where.eventStatus = params.status
    }

    if (params.mode) {
        where.eventAttendanceMode = params.mode
    }

    if (params.username) {
        const user = await prisma.user.findUnique({
            where: { username: params.username },
        })
        if (!user) {
            throw new UserNotFoundError(params.username)
        }
        where.userId = user.id
    }

    if (params.tags) {
        const tagList = normalizeTags(params.tags.split(','))
        if (tagList.length > 0) {
            where.tags = {
                some: {
                    tag: {
                        in: tagList,
                    },
                },
            }
        }
    }

    return where as Prisma.EventWhereInput
}

// Search events
app.get('/', async (c) => {
    try {
        const params = SearchSchema.parse({
            q: c.req.query('q'),
            location: c.req.query('location'),
            startDate: c.req.query('startDate'),
            endDate: c.req.query('endDate'),
            status: c.req.query('status'),
            mode: c.req.query('mode'),
            username: c.req.query('username'),
            tags: c.req.query('tags'),
            page: c.req.query('page'),
            limit: c.req.query('limit'),
        })

        const page = parseInt(params.page || '1')
        const limit = Math.min(parseInt(params.limit || '20'), 100)
        const skip = (page - 1) * limit

        let where: Prisma.EventWhereInput
        try {
            where = await buildSearchWhereClause(params)
        } catch (error) {
            // Handle user not found error
            if (error instanceof UserNotFoundError) {
                return c.json({
                    events: [],
                    pagination: {
                        page,
                        limit,
                        total: 0,
                        pages: 0,
                    },
                })
            }
            throw error
        }

        // Execute search
        const userId = c.get('userId') as string | undefined
        let visibilityFilter: Prisma.EventWhereInput
        if (userId) {
            const following = await prisma.following.findMany({
                where: { userId, accepted: true },
                select: { actorUrl: true },
            })
            const followedActorUrls = following.map(f => f.actorUrl)
            visibilityFilter = buildVisibilityWhere({ userId, followedActorUrls })
        } else {
            visibilityFilter = { visibility: 'PUBLIC' }
        }

        const hasFilters = Object.keys(where).length > 0
        const combinedWhere = hasFilters ? { AND: [where, visibilityFilter] } : visibilityFilter

        const [events, total] = await Promise.all([
            prisma.event.findMany({
                where: combinedWhere,
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
                    tags: true,
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
            }),
            prisma.event.count({ where: combinedWhere }),
        ])

        return c.json({
            events,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
            filters: {
                q: params.q,
                location: params.location,
                startDate: params.startDate,
                endDate: params.endDate,
                status: params.status,
                mode: params.mode,
                username: params.username,
                tags: params.tags,
            },
        })
    } catch (error) {
        if (error instanceof ZodError) {
            return c.json({ error: 'Invalid search parameters', details: error.issues }, 400 as const)
        }
        console.error('Error searching events:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Get upcoming events
app.get('/upcoming', async (c) => {
    try {
        const limit = Math.min(parseInt(c.req.query('limit') || '10'), 50)

        const events = await prisma.event.findMany({
            where: {
                startTime: {
                    gte: new Date(),
                },
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
                _count: {
                    select: {
                        attendance: true,
                        likes: true,
                        comments: true,
                    },
                },
            },
            orderBy: { startTime: 'asc' },
            take: limit,
        })

        return c.json({ events })
    } catch (error) {
        console.error('Error getting upcoming events:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Get popular events (by attendance + likes)
app.get('/popular', async (c) => {
    try {
        const limit = Math.min(parseInt(c.req.query('limit') || '10'), 50)

        // Get events with counts
        const events = await prisma.event.findMany({
            where: {
                startTime: {
                    gte: new Date(),
                },
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
                _count: {
                    select: {
                        attendance: true,
                        likes: true,
                        comments: true,
                    },
                },
            },
            take: 100, // Get more to sort
        })

        // Sort by popularity (attendance + likes)
        const sorted = events
            .map((event) => ({
                ...event,
                popularity: event._count.attendance + event._count.likes,
            }))
            .sort((a, b) => b.popularity - a.popularity)
            .slice(0, limit)

        return c.json({ events: sorted })
    } catch (error) {
        console.error('Error getting popular events:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

export default app
