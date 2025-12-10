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

// Geographic constants for nearby search
// KM_PER_DEGREE is approximately 111 km per degree of latitude
// Note: This is an approximation. The actual value varies slightly from equator to poles
// due to Earth's oblate spheroid shape (~110.574 km at equator, ~111.694 km at poles).
// For longitude, the distance per degree varies by latitude and is adjusted using cosine
const KM_PER_DEGREE = 111 // Approximate kilometers per degree of latitude
const MIN_COS_LAT_THRESHOLD = 0.01 // Minimum cosine threshold to prevent division by zero near poles

// Search batching constants
const SMALL_LIMIT_THRESHOLD = 10 // Threshold for small vs large limits
const SMALL_LIMIT_MULTIPLIER = 3 // Multiplier for small limits (fetch more to account for filtering)
const LARGE_LIMIT_MULTIPLIER = 1.5 // Multiplier for large limits
const MAX_SEARCH_BATCH_SIZE = 500 // Maximum batch size for search queries

const DATE_RANGE_PRESETS = ['today', 'tomorrow', 'this_weekend', 'next_7_days', 'next_30_days'] as const
type DateRangePreset = typeof DATE_RANGE_PRESETS[number]

const startOfDay = (input: Date) => {
    const date = new Date(input)
    date.setHours(0, 0, 0, 0)
    return date
}

const endOfDay = (input: Date) => {
    const date = new Date(input)
    date.setHours(23, 59, 59, 999)
    return date
}

const addDays = (input: Date, days: number) => {
    const date = new Date(input)
    date.setDate(date.getDate() + days)
    return date
}

const resolveDateRangeBounds = (preset: DateRangePreset): { start?: Date; end?: Date } => {
    const now = new Date()
    switch (preset) {
        case 'today': {
            return {
                start: startOfDay(now),
                end: endOfDay(now),
            }
        }
        case 'tomorrow': {
            const tomorrow = addDays(now, 1)
            return {
                start: startOfDay(tomorrow),
                end: endOfDay(tomorrow),
            }
        }
        case 'this_weekend': {
            const day = now.getDay()
            // Special case: if today is Sunday (day = 0), return just today
            // since Saturday has already passed
            if (day === 0) {
                return {
                    start: startOfDay(now),
                    end: endOfDay(now),
                }
            }
            // When today is Saturday (day = 6), daysUntilSaturday = 0, so the weekend
            // spans from today (Saturday) through Sunday, which is the intended behavior.
            const daysUntilSaturday = (6 - day + 7) % 7
            const saturday = addDays(now, daysUntilSaturday)
            const sunday = addDays(saturday, 1)
            return {
                start: startOfDay(saturday),
                end: endOfDay(sunday),
            }
        }
        case 'next_7_days': {
            return {
                start: startOfDay(now),
                end: endOfDay(addDays(now, 6)),
            }
        }
        case 'next_30_days': {
            return {
                start: startOfDay(now),
                end: endOfDay(addDays(now, 29)),
            }
        }
        default:
            return {}
    }
}

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
    dateRange: z.enum(DATE_RANGE_PRESETS).optional(), // Date range presets
    status: z.enum(['EventScheduled', 'EventCancelled', 'EventPostponed']).optional(),
    mode: z.enum(['OfflineEventAttendanceMode', 'OnlineEventAttendanceMode', 'MixedEventAttendanceMode']).optional(),
    username: z.string().max(200).optional(), // Filter by organizer
    tags: z.string().optional(), // Comma-separated tags
    categories: z.string().optional(), // Alias for tags
    page: z.string().optional(),
    limit: z.string().optional(),
    sort: z.enum(['date', 'popularity', 'trending']).optional().default('date'), // Sort option
})

const NearbySearchSchema = z.object({
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    radiusKm: z.coerce.number().min(1).max(500).optional().default(25),
    limit: z.coerce.number().min(1).max(100).optional().default(25),
})

const toRadians = (value: number) => (value * Math.PI) / 180

const haversineDistanceKm = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
) => {
    const R = 6371 // km
    const dLat = toRadians(lat2 - lat1)
    const dLon = toRadians(lon2 - lon1)
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) *
            Math.cos(toRadians(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
}

export const buildSearchWhereClause = async (params: z.infer<typeof SearchSchema>): Promise<Prisma.EventWhereInput> => {
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

    const presetBounds = params.dateRange ? resolveDateRangeBounds(params.dateRange) : undefined
    const explicitStart = params.startDate ? new Date(params.startDate) : undefined
    const explicitEnd = params.endDate ? new Date(params.endDate) : undefined
    const startBound = explicitStart ?? presetBounds?.start
    const endBound = explicitEnd ?? presetBounds?.end

    if (startBound || endBound) {
        where.startTime = {} as { gte?: Date; lte?: Date }
        if (startBound) {
            (where.startTime as { gte?: Date }).gte = startBound
        }
        if (endBound) {
            (where.startTime as { lte?: Date }).lte = endBound
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

    const inputTags = params.tags && params.tags.trim() ? normalizeTags(params.tags.split(',')) : []
    const inputCategories = params.categories && params.categories.trim()
        ? normalizeTags(params.categories.split(','))
        : []
    const combinedTags = Array.from(new Set([...inputTags, ...inputCategories]))

    if (combinedTags.length > 0) {
        where.tags = {
            some: {
                tag: {
                    in: combinedTags,
                },
            },
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
            dateRange: c.req.query('dateRange'),
            status: c.req.query('status'),
            mode: c.req.query('mode'),
            username: c.req.query('username'),
            tags: c.req.query('tags'),
            categories: c.req.query('categories'),
            page: c.req.query('page'),
            limit: c.req.query('limit'),
            sort: c.req.query('sort'),
        })

        const page = parseInt(params.page || '1')
        const limit = Math.min(parseInt(params.limit || '20'), 100)
        const skip = (page - 1) * limit
        const sortOption = params.sort || 'date'

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

        // Determine orderBy based on sort option
        let orderBy: Prisma.EventOrderByWithRelationInput
        if (sortOption === 'popularity') {
            // For popularity sorting, fetch all matching events and sort by computed popularity
            // Popularity formula: attendance * 2 + likes
            // We fetch all matching events to ensure correct sorting across the entire dataset
            
            // Fetch all matching events with their counts
            const allEvents = await prisma.event.findMany({
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
            })

            // Get accurate counts using groupBy for better performance
            const eventIds = allEvents.map(e => e.id)
            const [attendanceCounts, likesCounts] = await Promise.all([
                prisma.eventAttendance.groupBy({
                    by: ['eventId'],
                    where: { eventId: { in: eventIds } },
                    _count: { eventId: true },
                }),
                prisma.eventLike.groupBy({
                    by: ['eventId'],
                    where: { eventId: { in: eventIds } },
                    _count: { eventId: true },
                }),
            ])

            const attendanceMap = new Map(attendanceCounts.map(a => [a.eventId, a._count.eventId]))
            const likesMap = new Map(likesCounts.map(l => [l.eventId, l._count.eventId]))

            // Sort by popularity (attendance * 2 + likes) and paginate
            const sortedEvents = allEvents
                .map((event) => {
                    const attendance = attendanceMap.get(event.id) ?? (typeof event._count?.attendance === 'number' ? event._count.attendance : 0)
                    const likes = likesMap.get(event.id) ?? (typeof event._count?.likes === 'number' ? event._count.likes : 0)
                    return {
                        ...event,
                        _count: {
                            attendance,
                            likes,
                            comments: typeof event._count?.comments === 'number' ? event._count.comments : 0,
                        },
                        popularity: attendance * 2 + likes,
                    }
                })
                .sort((a, b) => b.popularity - a.popularity)
                .slice(skip, skip + limit)
                .map(({ popularity: _popularity, ...event }) => event)

            const total = allEvents.length

            return c.json({
                events: sortedEvents,
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
                    dateRange: params.dateRange,
                    status: params.status,
                    mode: params.mode,
                    username: params.username,
                    tags: params.tags,
                    categories: params.categories,
                    sort: sortOption,
                },
            })
        } else if (sortOption === 'trending') {
            // For trending, we'll use date sorting as a fallback since trending requires
            // complex calculation that's better handled by the /trending endpoint
            // For now, fall back to date sorting
            orderBy = { startTime: 'asc' }
        } else {
            // Default: sort by date
            orderBy = { startTime: 'asc' }
        }

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
                orderBy,
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
                dateRange: params.dateRange,
                status: params.status,
                mode: params.mode,
                username: params.username,
                tags: params.tags,
                categories: params.categories,
                sort: sortOption,
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

        // Apply visibility filter
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

        const events = await prisma.event.findMany({
            where: {
                AND: [
                    {
                        startTime: {
                            gte: new Date(),
                        },
                    },
                    visibilityFilter,
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

        // Ensure _count is explicitly included in response
        const eventsWithCounts = events.map((event) => ({
            ...event,
            _count: event._count ?? { attendance: 0, likes: 0, comments: 0 },
        }))

        return c.json({ events: eventsWithCounts })
    } catch (error) {
        console.error('Error getting upcoming events:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Get popular events (by attendance + likes)
app.get('/popular', async (c) => {
    try {
        const limit = Math.min(parseInt(c.req.query('limit') || '10'), 50)

        // Apply visibility filter
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

        // Fetch events - we'll sort in memory, so fetch more than the limit
        const events = await prisma.event.findMany({
            where: {
                AND: [
                    {
                        startTime: {
                            gte: new Date(),
                        },
                    },
                    visibilityFilter,
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
                _count: {
                    select: {
                        attendance: true,
                        likes: true,
                        comments: true,
                    },
                },
            },
            take: Math.max(limit * 10, 100),
        })

        // Manually count attendance and likes to ensure accuracy
        // Prisma's _count may not reflect nested creates immediately in some cases
        const eventIds = events.map(e => e.id)
        const [attendanceCounts, likesCounts] = await Promise.all([
            prisma.eventAttendance.groupBy({
                by: ['eventId'],
                where: { eventId: { in: eventIds } },
                _count: { eventId: true },
            }),
            prisma.eventLike.groupBy({
                by: ['eventId'],
                where: { eventId: { in: eventIds } },
                _count: { eventId: true },
            }),
        ])

        const attendanceMap = new Map(attendanceCounts.map(a => [a.eventId, a._count.eventId]))
        const likesMap = new Map(likesCounts.map(l => [l.eventId, l._count.eventId]))

        // Sort by popularity (attendance + likes)
        const sorted = events
            .map((event) => {
                // Use attendanceMap and likesMap as the source of truth
                // Only fall back to event._count if the map doesn't have the value
                // and validate that _count values are actually numbers
                const attendanceFromMap = attendanceMap.get(event.id)
                const likesFromMap = likesMap.get(event.id)
                
                const attendanceCount = attendanceFromMap ?? 
                    (typeof event._count?.attendance === 'number' ? event._count.attendance : 0)
                const likesCount = likesFromMap ?? 
                    (typeof event._count?.likes === 'number' ? event._count.likes : 0)
                const commentsCount = typeof event._count?.comments === 'number' ? event._count.comments : 0
                
                const popularity = attendanceCount + likesCount
                return {
                    ...event,
                    _count: {
                        attendance: attendanceCount,
                        likes: likesCount,
                        comments: commentsCount,
                    },
                    popularity,
                }
            })
            .sort((a, b) => b.popularity - a.popularity)
            .slice(0, limit)
            .map(({ popularity: _popularity, ...event }) => event)

        return c.json({ events: sorted })
    } catch (error) {
        console.error('Error getting popular events:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

app.get('/nearby', async (c) => {
    try {
        const params = NearbySearchSchema.parse({
            latitude: c.req.query('latitude'),
            longitude: c.req.query('longitude'),
            radiusKm: c.req.query('radiusKm'),
            limit: c.req.query('limit'),
        })

        const radiusKm = params.radiusKm
        const requestedLimit = params.limit

        // Reject searches at extreme latitudes where the calculation breaks down
        // Beyond ±85°, longitude calculations become unreliable due to convergence of meridians near the poles
        if (Math.abs(params.latitude) > 85) {
            return c.json({ 
                error: 'Searches beyond ±85° latitude are not supported near the poles. Please use a latitude between -85° and 85°.' 
            }, 400)
        }

        const latDelta = radiusKm / KM_PER_DEGREE
        const cosLat = Math.cos(toRadians(params.latitude))
        // Clamp cosLat to prevent division by extremely small values near poles
        const lonDelta = radiusKm / (KM_PER_DEGREE * Math.max(Math.abs(cosLat), MIN_COS_LAT_THRESHOLD))

        const latMin = Math.max(-90, params.latitude - latDelta)
        const latMax = Math.min(90, params.latitude + latDelta)
        const lonMin = params.longitude - lonDelta
        const lonMax = params.longitude + lonDelta

        // If the radius spans more than 180° of longitude at this latitude, reject the search
        if (lonDelta > 180) {
            return c.json({ 
                error: 'Search radius is too large for this location. Please use a smaller radius.' 
            }, 400)
        }

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

        const baseInclude = {
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
        }

        // Fetch more events than requested to account for Haversine filtering
        // Use a multiplier that scales better for smaller limits
        const multiplier = requestedLimit <= SMALL_LIMIT_THRESHOLD ? SMALL_LIMIT_MULTIPLIER : LARGE_LIMIT_MULTIPLIER
        const searchBatchSize = Math.min(Math.ceil(requestedLimit * multiplier), MAX_SEARCH_BATCH_SIZE)

        // Handle longitude wrapping and antimeridian crossing
        // If the bounding box crosses the antimeridian (±180°), split into two ranges using OR
        // Example: center at 179° with radius 5° gives lonMax=184°, so we query [174°, 180°] OR [-180°, -176°]
        let boundingWhere: Prisma.EventWhereInput
        
        if (lonMax > 180) {
            // Crossing from east: range extends past 180° to the west
            // Query: [lonMin, 180°] (eastern part) OR [-180°, lonMax-360°] (western part)
            const westernLonMax = lonMax - 360 // Normalize to -180-180 range
            boundingWhere = {
                AND: [
                    { locationLatitude: { gte: latMin, lte: latMax } },
                    {
                        OR: [
                            {
                                locationLongitude: {
                                    gte: Math.max(-180, lonMin),
                                    lte: 180,
                                },
                            },
                            {
                                locationLongitude: {
                                    gte: -180,
                                    lte: westernLonMax,
                                },
                            },
                        ],
                    },
                ],
            }
        } else if (lonMin < -180) {
            // Range crosses antimeridian: convert lonMin to equivalent eastern longitude
            // Example: lonMin = -185 → easternLonMin = 175
            const easternLonMin = lonMin + 360
            boundingWhere = {
                AND: [
                    { locationLatitude: { gte: latMin, lte: latMax } },
                    {
                        OR: [
                            {
                                locationLongitude: {
                                    gte: easternLonMin,
                                    lte: 180,
                                },
                            },
                            {
                                locationLongitude: {
                                    gte: -180,
                                    lte: Math.min(180, lonMax),
                                },
                            },
                        ],
                    },
                ],
            }
        } else {
            // Normal case: no antimeridian crossing, simple range query
            boundingWhere = {
                locationLatitude: {
                    gte: latMin,
                    lte: latMax,
                },
                locationLongitude: {
                    gte: lonMin,
                    lte: lonMax,
                },
            }
        }

        const combinedWhere: Prisma.EventWhereInput = {
            AND: [
                visibilityFilter,
                { sharedEventId: null },
                { startTime: { gte: new Date() } },
                boundingWhere,
            ],
        }

        const events = await prisma.event.findMany({
            where: combinedWhere,
            include: baseInclude,
            orderBy: { startTime: 'asc' },
            take: searchBatchSize,
        })

        const results = events
            .map((event) => {
                if (event.locationLatitude === null || event.locationLongitude === null) {
                    return null
                }
                const distanceKm = haversineDistanceKm(
                    params.latitude,
                    params.longitude,
                    event.locationLatitude,
                    event.locationLongitude,
                )
                return distanceKm <= radiusKm
                    ? {
                        ...event,
                        distanceKm,
                    }
                    : null
            })
            .filter((event): event is typeof events[0] & { distanceKm: number } => event !== null)
            .sort((a, b) => a.distanceKm - b.distanceKm)
            .slice(0, requestedLimit)

        return c.json({
            origin: {
                latitude: params.latitude,
                longitude: params.longitude,
                radiusKm,
            },
            events: results,
        })
    } catch (error) {
        if (error instanceof ZodError) {
            return c.json({ error: 'Invalid nearby search parameters', details: error.issues }, 400 as const)
        }
        console.error('Error searching nearby events:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Get platform statistics
app.get('/stats', async (c) => {
    try {
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

        const now = new Date()

        // Get total events count (respecting visibility)
        const totalEvents = await prisma.event.count({
            where: visibilityFilter,
        })

        // Get upcoming events count (events with startTime in the future)
        const upcomingEvents = await prisma.event.count({
            where: {
                AND: [
                    visibilityFilter,
                    {
                        startTime: {
                            gte: now,
                        },
                    },
                ],
            },
        })

        // Get today's events count
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
        const todayEvents = await prisma.event.count({
            where: {
                AND: [
                    visibilityFilter,
                    {
                        startTime: {
                            gte: todayStart,
                            lte: todayEnd,
                        },
                    },
                ],
            },
        })

        return c.json({
            totalEvents,
            upcomingEvents,
            todayEvents,
        })
    } catch (error) {
        console.error('Error getting platform statistics:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

export default app
