/**
 * User and Event Search with Remote Account Resolution
 * Handles searching for local content and resolving remote accounts
 */

import { Hono } from 'hono'
import { z, ZodError } from 'zod'
import { resolveWebFinger, fetchActor, cacheRemoteUser, getBaseUrl } from './lib/activitypubHelpers.js'
import type { Person } from './lib/activitypubSchemas.js'
import { prisma } from './lib/prisma.js'
import { lenientRateLimit } from './middleware/rateLimit.js'

const app = new Hono()

// Apply rate limiting to prevent abuse
app.use('*', lenientRateLimit)


// Search validation schema
const SearchQuerySchema = z.object({
    q: z.string().min(1).max(200), // Add length limit
    limit: z.string().optional(),
})

// Resolve account schema
const ResolveAccountSchema = z.object({
    handle: z.string().min(1).max(300), // Add length limit for full handles
})

/**
 * Parse a handle into username and domain
 * Supports multiple formats:
 * - @username@domain
 * - username@domain
 * - https://domain/users/username
 * - http://domain/users/username
 * - domain/@username
 */
function parseHandle(input: string): { username: string; domain: string } | null {
    try {
        // Try URL format first
        if (input.startsWith('http://') || input.startsWith('https://')) {
            const url = new URL(input)
            const pathParts = url.pathname.split('/').filter(Boolean)

            // Look for /users/username pattern
            const userIndex = pathParts.indexOf('users')
            if (userIndex !== -1 && pathParts[userIndex + 1]) {
                return {
                    username: pathParts[userIndex + 1],
                    domain: url.hostname,
                }
            }

            // Look for /@username pattern
            if (pathParts.length > 0 && pathParts[0].startsWith('@')) {
                return {
                    username: pathParts[0].slice(1),
                    domain: url.hostname,
                }
            }

            // Try last path segment as username
            if (pathParts.length > 0) {
                return {
                    username: pathParts[pathParts.length - 1],
                    domain: url.hostname,
                }
            }

            return null
        }

        // Check for domain/@username format (e.g., app2.local/@bob)
        if (input.includes('/') && input.includes('@')) {
            const slashIndex = input.indexOf('/')
            const domain = input.substring(0, slashIndex)
            const pathPart = input.substring(slashIndex + 1)

            if (pathPart.startsWith('@')) {
                return {
                    username: pathPart.slice(1),
                    domain,
                }
            }
        }

        // Remove leading @ if present
        const normalized = input.startsWith('@') ? input.slice(1) : input

        // Check for @domain format
        const parts = normalized.split('@')
        if (parts.length === 2 && parts[0] && parts[1]) {
            return {
                username: parts[0],
                domain: parts[1],
            }
        }

        return null
    } catch (error) {
        console.error('Error parsing handle:', error)
        return null
    }
}

/**
 * Check if a handle is for a local user
 */
function isLocalHandle(domain: string): boolean {
    const baseUrl = getBaseUrl()
    const localDomain = new URL(baseUrl).hostname
    return domain === localDomain
}

/**
 * Search for users and events
 * GET /api/user-search?q=query&limit=10
 */
app.get('/', async (c) => {
    try {
        const params = SearchQuerySchema.parse({
            q: c.req.query('q'),
            limit: c.req.query('limit'),
        })

        const query = params.q
        const limit = Math.min(parseInt(params.limit || '10'), 50)

        // Search local users
        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { username: { contains: query } },
                    { name: { contains: query } },
                ],
            },
            select: {
                id: true,
                username: true,
                name: true,
                profileImage: true,
                displayColor: true,
                isRemote: true,
                externalActorUrl: true,
            },
            take: limit,
        })

        // Search local events
        const events = await prisma.event.findMany({
            where: {
                OR: [
                    { title: { contains: query } },
                    { summary: { contains: query } },
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
                    },
                },
            },
            take: limit,
            orderBy: { startTime: 'asc' },
        })

        // Check if query looks like a remote handle
        const parsedHandle = parseHandle(query)
        let remoteAccountSuggestion = null

        if (parsedHandle && !isLocalHandle(parsedHandle.domain)) {
            // Check if we already have this remote user cached
            const cachedRemoteUser = await prisma.user.findFirst({
                where: {
                    username: `${parsedHandle.username}@${parsedHandle.domain}`,
                    isRemote: true,
                },
                select: {
                    id: true,
                    username: true,
                    name: true,
                    profileImage: true,
                    displayColor: true,
                    isRemote: true,
                    externalActorUrl: true,
                },
            })

            if (cachedRemoteUser) {
                // Add to users list if not already there
                if (!users.find(u => u.id === cachedRemoteUser.id)) {
                    users.unshift(cachedRemoteUser)
                }
            } else {
                // Suggest resolving this remote account
                remoteAccountSuggestion = {
                    handle: `@${parsedHandle.username}@${parsedHandle.domain}`,
                    username: parsedHandle.username,
                    domain: parsedHandle.domain,
                }
            }
        }

        return c.json({
            users,
            events,
            remoteAccountSuggestion,
        })
    } catch (error) {
        if (error instanceof ZodError) {
            return c.json({ error: 'Invalid search parameters', details: error.issues }, 400 as const)
        }
        console.error('Error searching:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

/**
 * Resolve and cache a remote account
 * POST /api/user-search/resolve
 * Body: { handle: "@user@domain" }
 */
app.post('/resolve', async (c) => {
    try {
        const body = await c.req.json()
        const params = ResolveAccountSchema.parse(body)

        const parsedHandle = parseHandle(params.handle)

        if (!parsedHandle) {
            return c.json({ error: 'Invalid handle format' }, 400)
        }

        // Check if it's a local user
        if (isLocalHandle(parsedHandle.domain)) {
            const localUser = await prisma.user.findUnique({
                where: { username: parsedHandle.username, isRemote: false },
                select: {
                    id: true,
                    username: true,
                    name: true,
                    profileImage: true,
                    displayColor: true,
                    isRemote: true,
                    externalActorUrl: true,
                },
            })

            if (localUser) {
                return c.json({ user: localUser })
            } else {
                return c.json({ error: 'Local user not found' }, 404)
            }
        }

        // Check if already cached
        const cachedUser = await prisma.user.findFirst({
            where: {
                username: `${parsedHandle.username}@${parsedHandle.domain}`,
                isRemote: true,
            },
            select: {
                id: true,
                username: true,
                name: true,
                profileImage: true,
                displayColor: true,
                isRemote: true,
                externalActorUrl: true,
            },
        })

        if (cachedUser) {
            return c.json({ user: cachedUser })
        }

        // Resolve via WebFinger
        const resource = `acct:${parsedHandle.username}@${parsedHandle.domain}`
        const actorUrl = await resolveWebFinger(resource)

        if (!actorUrl) {
            return c.json({ error: 'Failed to resolve account via WebFinger' }, 404)
        }

        // Fetch actor
        const actor = await fetchActor(actorUrl)

        if (!actor) {
            return c.json({ error: 'Failed to fetch actor' }, 404)
        }

        // Cache remote user
        const remoteUser = await cacheRemoteUser(actor as unknown as Person)

        return c.json({
            user: {
                id: remoteUser.id,
                username: remoteUser.username,
                name: remoteUser.name,
                profileImage: remoteUser.profileImage,
                displayColor: remoteUser.displayColor,
                isRemote: remoteUser.isRemote,
                externalActorUrl: remoteUser.externalActorUrl,
            },
        })
    } catch (error) {
        if (error instanceof ZodError) {
            return c.json({ error: 'Invalid request body', details: error.issues }, 400 as const)
        }
        console.error('Error resolving account:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

/**
 * Get user profile with events
 * GET /api/user-search/profile/:username
 * Username can be:
 * - Local: "alice"
 * - Remote: "bob@app2.local"
 */
// Get followers list
app.get('/profile/:username/followers', async (c) => {
    try {
        // Decode username in case it's URL encoded
        const username = decodeURIComponent(c.req.param('username'))
        const limit = parseInt(c.req.query('limit') || '50')

        // Check if it's a remote user (contains @domain)
        const isRemote = username.includes('@')

        const user = await prisma.user.findFirst({
            where: {
                username,
                isRemote,
            },
        })

        if (!user) {
            return c.json({ error: 'User not found' }, 404)
        }

        const followers = await prisma.follower.findMany({
            where: {
                userId: user.id,
                accepted: true,
            },
            take: limit,
            orderBy: { createdAt: 'desc' },
        })

        // Resolve followers to user objects
        const baseUrl = getBaseUrl()
        const followerUsers = []

        for (const follower of followers) {
            let followerUser = null

            if (follower.actorUrl.startsWith(baseUrl)) {
                // Local user
                const followerUsername = follower.actorUrl.split('/').pop()
                if (followerUsername) {
                    followerUser = await prisma.user.findUnique({
                        where: {
                            username: followerUsername,
                            isRemote: false,
                        },
                        select: {
                            id: true,
                            username: true,
                            name: true,
                            profileImage: true,
                            displayColor: true,
                            isRemote: true,
                        },
                    })
                }
            } else {
                // Remote user
                followerUser = await prisma.user.findFirst({
                    where: {
                        externalActorUrl: follower.actorUrl,
                        isRemote: true,
                    },
                    select: {
                        id: true,
                        username: true,
                        name: true,
                        profileImage: true,
                        displayColor: true,
                        isRemote: true,
                    },
                })
            }

            if (followerUser) {
                followerUsers.push(followerUser)
            }
        }

        return c.json({ followers: followerUsers })
    } catch (error) {
        console.error('Error getting followers:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Get following list
app.get('/profile/:username/following', async (c) => {
    try {
        // Decode username in case it's URL encoded
        const username = decodeURIComponent(c.req.param('username'))
        const limit = parseInt(c.req.query('limit') || '50')

        // Check if it's a remote user (contains @domain)
        const isRemote = username.includes('@')

        const user = await prisma.user.findFirst({
            where: {
                username,
                isRemote,
            },
        })

        if (!user) {
            return c.json({ error: 'User not found' }, 404)
        }

        const following = await prisma.following.findMany({
            where: {
                userId: user.id,
                accepted: true,
            },
            take: limit,
            orderBy: { createdAt: 'desc' },
        })

        // Resolve following to user objects
        const baseUrl = getBaseUrl()
        const followingUsers = []

        for (const follow of following) {
            let followUser = null

            if (follow.actorUrl.startsWith(baseUrl)) {
                // Local user
                const followUsername = follow.actorUrl.split('/').pop()
                if (followUsername) {
                    followUser = await prisma.user.findUnique({
                        where: {
                            username: followUsername,
                            isRemote: false,
                        },
                        select: {
                            id: true,
                            username: true,
                            name: true,
                            profileImage: true,
                            displayColor: true,
                            isRemote: true,
                        },
                    })
                }
            } else {
                // Remote user
                followUser = await prisma.user.findFirst({
                    where: {
                        externalActorUrl: follow.actorUrl,
                        isRemote: true,
                    },
                    select: {
                        id: true,
                        username: true,
                        name: true,
                        profileImage: true,
                        displayColor: true,
                        isRemote: true,
                    },
                })
            }

            if (followUser) {
                followingUsers.push(followUser)
            }
        }

        return c.json({ following: followingUsers })
    } catch (error) {
        console.error('Error getting following:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

app.get('/profile/:username', async (c) => {
    try {
        // Decode username in case it's URL encoded (e.g., alice%40app1.local -> alice@app1.local)
        const username = decodeURIComponent(c.req.param('username'))

        // Check if it's a remote user (contains @domain)
        const isRemote = username.includes('@')

        console.log(`[userSearch] Looking up profile for: ${username} (isRemote: ${isRemote})`)

        let user = await prisma.user.findFirst({
            where: {
                username,
                isRemote,
            },
            select: {
                id: true,
                username: true,
                name: true,
                bio: true,
                profileImage: true,
                headerImage: true,
                displayColor: true,
                isRemote: true,
                externalActorUrl: true,
                createdAt: true,
                _count: {
                    select: {
                        events: true,
                        followers: true,
                        following: true,
                    },
                },
            },
        })

        // If user not found and it's a remote user, try to resolve and cache them
        if (!user && isRemote) {
            const parsedHandle = parseHandle(username)

            if (parsedHandle && !isLocalHandle(parsedHandle.domain)) {
                console.log(`🔍 Attempting to resolve remote user: ${username}`)

                // Resolve via WebFinger
                const resource = `acct:${parsedHandle.username}@${parsedHandle.domain}`
                const actorUrl = await resolveWebFinger(resource)

                if (actorUrl) {
                    // Fetch actor
                    const actor = await fetchActor(actorUrl)

                    if (actor) {
                        // Cache remote user
                        const cachedUser = await cacheRemoteUser(actor as unknown as Person)

                        // Re-fetch the user with all fields
                        const refetchedUser = await prisma.user.findFirst({
                            where: {
                                id: cachedUser.id,
                            },
                            select: {
                                id: true,
                                username: true,
                                name: true,
                                bio: true,
                                profileImage: true,
                                headerImage: true,
                                displayColor: true,
                                isRemote: true,
                                externalActorUrl: true,
                                createdAt: true,
                                _count: {
                                    select: {
                                        events: true,
                                        followers: true,
                                        following: true,
                                    },
                                },
                            },
                        })

                        if (refetchedUser) {
                            user = refetchedUser
                        }

                        console.log(`✅ Resolved and cached remote user: ${username}`)
                    }
                }
            }
        }

        if (!user) {
            return c.json({ error: 'User not found' }, 404)
        }

        // Calculate actual follower/following counts (only accepted)
        // For remote users, we can't calculate counts from our local database
        // Their followers/following are stored on their server
        let followerCount = 0
        let followingCount = 0

        if (!isRemote) {
            // Only calculate for local users
            followerCount = await prisma.follower.count({
                where: {
                    userId: user.id,
                    accepted: true,
                },
            })

            followingCount = await prisma.following.count({
                where: {
                    userId: user.id,
                    accepted: true,
                },
            })
        }

        // Override _count with actual counts
        const userWithCounts = {
            ...user,
            _count: {
                events: user._count?.events || 0,
                followers: followerCount,
                following: followingCount,
            },
        }

        // Get user's events
        let events = await prisma.event.findMany({
            where: isRemote
                ? { attributedTo: user.externalActorUrl || undefined }
                : { userId: user.id },
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
            orderBy: { startTime: 'desc' },
            take: 50,
        })

        // If remote user has no cached events, fetch from their outbox
        if (isRemote && events.length === 0 && user.externalActorUrl) {
            try {
                const outboxUrl = `${user.externalActorUrl}/outbox?page=1`
                const response = await fetch(outboxUrl, {
                    headers: {
                        Accept: 'application/activity+json',
                    },
                })

                if (response && response.ok) {
                    const outbox = await response.json() as { orderedItems?: unknown[] } | undefined
                    const activities = outbox?.orderedItems || []

                    // Cache events from outbox
                    for (const activity of activities) {
                        const activityObj = activity as Record<string, unknown>
                        const activityType = activityObj.type
                        const activityObject = activityObj.object as Record<string, unknown> | undefined
                        if (activityType === 'Create' && activityObject && activityObject.type === 'Event') {
                            const eventObj = activityObject as Record<string, unknown>
                            const eventId = eventObj.id as string | undefined
                            const eventName = eventObj.name as string | undefined
                            const eventSummary = (eventObj.summary || eventObj.content) as string | undefined
                            const eventLocation = eventObj.location as string | Record<string, unknown> | undefined
                            const eventStartTime = eventObj.startTime as string | undefined
                            const eventEndTime = eventObj.endTime as string | undefined
                            const eventDuration = eventObj.duration as string | undefined
                            const eventUrl = eventObj.url as string | undefined
                            const eventStatus = eventObj.eventStatus as string | undefined
                            const eventAttendanceMode = eventObj.eventAttendanceMode as string | undefined
                            const eventMaxCapacity = eventObj.maximumAttendeeCapacity as number | undefined
                            const eventAttachment = eventObj.attachment as Array<{ url?: string }> | undefined

                            if (!eventId || !eventName || !eventStartTime) continue

                            // Extract location value
                            let locationValue: string | null = null
                            if (typeof eventLocation === 'string') {
                                locationValue = eventLocation
                            } else if (eventLocation && typeof eventLocation === 'object' && 'name' in eventLocation) {
                                locationValue = eventLocation.name as string
                            }

                            await prisma.event.upsert({
                                where: { externalId: eventId },
                                update: {
                                    title: eventName,
                                    summary: eventSummary || null,
                                    location: locationValue,
                                    startTime: new Date(eventStartTime),
                                    endTime: eventEndTime ? new Date(eventEndTime) : null,
                                    duration: eventDuration || null,
                                    url: eventUrl || null,
                                    eventStatus: eventStatus || null,
                                    eventAttendanceMode: eventAttendanceMode || null,
                                    maximumAttendeeCapacity: eventMaxCapacity || null,
                                    headerImage: eventAttachment?.[0]?.url || null,
                                    attributedTo: user.externalActorUrl,
                                },
                                create: {
                                    externalId: eventId,
                                    title: eventName,
                                    summary: eventSummary || null,
                                    location: locationValue,
                                    startTime: new Date(eventStartTime),
                                    endTime: eventEndTime ? new Date(eventEndTime) : null,
                                    duration: eventDuration || null,
                                    url: eventUrl || null,
                                    eventStatus: eventStatus || null,
                                    eventAttendanceMode: eventAttendanceMode || null,
                                    maximumAttendeeCapacity: eventMaxCapacity || null,
                                    headerImage: eventAttachment?.[0]?.url || null,
                                    attributedTo: user.externalActorUrl,
                                    userId: null,
                                },
                            })
                        }
                    }

                    // Re-fetch events after caching
                    events = await prisma.event.findMany({
                        where: { attributedTo: user.externalActorUrl },
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
                        orderBy: { startTime: 'desc' },
                        take: 50,
                    })

                    console.log(`✅ Cached ${activities.length} activities from ${user.username}'s outbox`)
                }
            } catch (error) {
                console.error('Error fetching remote outbox:', error)
                // Continue with empty events array
            }
        }

        // Manually count events for proper display
        const eventCount = isRemote
            ? await prisma.event.count({ where: { attributedTo: user.externalActorUrl || undefined } })
            : await prisma.event.count({ where: { userId: user.id } })

        return c.json({
            user: {
                ...userWithCounts,
                _count: {
                    ...userWithCounts._count,
                    events: eventCount,
                },
            },
            events,
        })
    } catch (error) {
        console.error('Error getting user profile:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

export default app
