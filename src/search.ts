/**
 * Event Search and Filtering
 * Advanced search capabilities for events
 */

import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const app = new Hono()
const prisma = new PrismaClient()

// Search validation schema
const SearchSchema = z.object({
    q: z.string().optional(), // Search query
    location: z.string().optional(), // Location filter
    startDate: z.string().datetime().optional(), // Start date filter
    endDate: z.string().datetime().optional(), // End date filter
    status: z.enum(['EventScheduled', 'EventCancelled', 'EventPostponed']).optional(),
    mode: z.enum(['OfflineEventAttendanceMode', 'OnlineEventAttendanceMode', 'MixedEventAttendanceMode']).optional(),
    username: z.string().optional(), // Filter by organizer
    page: z.string().optional(),
    limit: z.string().optional(),
})

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
            page: c.req.query('page'),
            limit: c.req.query('limit'),
        })

        const page = parseInt(params.page || '1')
        const limit = Math.min(parseInt(params.limit || '20'), 100)
        const skip = (page - 1) * limit

        // Build where clause
        const where: any = {}

        // Text search in title and summary
        if (params.q) {
            where.OR = [
                { title: { contains: params.q, mode: 'insensitive' } },
                { summary: { contains: params.q, mode: 'insensitive' } },
            ]
        }

        // Location filter
        if (params.location) {
            where.location = { contains: params.location, mode: 'insensitive' }
        }

        // Date range filter
        if (params.startDate || params.endDate) {
            where.startTime = {}
            if (params.startDate) {
                where.startTime.gte = new Date(params.startDate)
            }
            if (params.endDate) {
                where.startTime.lte = new Date(params.endDate)
            }
        }

        // Status filter
        if (params.status) {
            where.eventStatus = params.status
        }

        // Attendance mode filter
        if (params.mode) {
            where.eventAttendanceMode = params.mode
        }

        // Organizer filter
        if (params.username) {
            const user = await prisma.user.findUnique({
                where: { username: params.username },
            })
            if (user) {
                where.userId = user.id
            } else {
                // No results if user not found
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
        }

        // Execute search
        const [events, total] = await Promise.all([
            prisma.event.findMany({
                where,
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
            }),
            prisma.event.count({ where }),
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
            },
        })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return c.json({ error: 'Invalid search parameters', details: error.errors }, 400)
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
