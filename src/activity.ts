/**
 * Activity Feed
 * Returns activities from people the user follows
 */

import { Hono } from 'hono'
import { prisma } from './lib/prisma.js'

interface FeedActivity {
    id: string
    type: string
    createdAt: string
    user: {
        id: string
        username: string
        name: string | null
        displayColor: string
        profileImage: string | null
    } | null
    event: {
        id: string
        title: string
        startTime: string
        location: string | null
        user: {
            id: string
            username: string
            name: string | null
            displayColor: string
        } | null
    }
    data?: Record<string, unknown>
}

const app = new Hono()

// Get activity feed for authenticated user
app.get('/activity/feed', async (c) => {
    try {
        const userId = c.get('userId')

        // If not authenticated, return empty feed
        if (!userId) {
            return c.json({ activities: [] })
        }

        // Get users that the current user follows
        const following = await prisma.following.findMany({
            where: {
                userId,
                accepted: true,
            },
            select: {
                actorUrl: true,
                username: true,
                accepted: true,
            },
        })

        console.log(`[Activity Feed] Found ${following.length} accepted following relationships for user ${userId}`)
        if (following.length > 0) {
            console.log(`[Activity Feed] Following actorUrls:`, following.map(f => f.actorUrl))
        }

        // Also check unaccepted follows for debugging
        const unacceptedFollowing = await prisma.following.findMany({
            where: {
                userId,
                accepted: false,
            },
            select: {
                actorUrl: true,
                username: true,
            },
        })
        if (unacceptedFollowing.length > 0) {
            console.log(`[Activity Feed] Found ${unacceptedFollowing.length} unaccepted following relationships:`, unacceptedFollowing.map(f => f.actorUrl))
        }

        // Extract user IDs from actor URLs (both local and remote)
        const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000'
        const followedUserIds: string[] = []

        for (const follow of following) {
            let user = null

            if (follow.actorUrl.startsWith(baseUrl)) {
                // Local user - find by username
                const username = follow.actorUrl.split('/').pop()
                if (username) {
                    user = await prisma.user.findUnique({
                        where: {
                            username,
                            isRemote: false,
                        },
                        select: { id: true },
                    })
                }
            } else {
                // Remote user - find by externalActorUrl
                user = await prisma.user.findFirst({
                    where: {
                        externalActorUrl: follow.actorUrl,
                        isRemote: true,
                    },
                    select: { id: true },
                })
            }

            if (user) {
                followedUserIds.push(user.id)
            } else {
                console.log(`[Activity Feed] Could not find user for actorUrl: ${follow.actorUrl}`)
            }
        }

        console.log(`[Activity Feed] User ${userId} follows ${followedUserIds.length} users (after resolving actorUrls):`, followedUserIds)

        const activities: FeedActivity[] = []

        // If no followed users, return empty feed
        if (followedUserIds.length === 0) {
            return c.json({ activities: [] })
        }

        // Get recent likes from followed users
        const likes = await prisma.eventLike.findMany({
            where: {
                userId: {
                    in: followedUserIds,
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
                event: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                name: true,
                                displayColor: true,
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        })

        for (const like of likes) {
            activities.push({
                id: `like-${like.id}`,
                type: 'like',
                createdAt: like.createdAt.toISOString(),
                user: like.user,
                event: {
                    id: like.event.id,
                    title: like.event.title,
                    startTime: like.event.startTime.toISOString(),
                    location: like.event.location,
                    user: like.event.user,
                },
            })
        }

        // Get recent RSVPs from followed users
        const rsvps = await prisma.eventAttendance.findMany({
            where: {
                userId: {
                    in: followedUserIds,
                },
                status: {
                    in: ['attending', 'maybe'],
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
                event: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                name: true,
                                displayColor: true,
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        })

        for (const rsvp of rsvps) {
            activities.push({
                id: `rsvp-${rsvp.id}`,
                type: 'rsvp',
                createdAt: rsvp.createdAt.toISOString(),
                user: rsvp.user,
                event: {
                    id: rsvp.event.id,
                    title: rsvp.event.title,
                    startTime: rsvp.event.startTime.toISOString(),
                    location: rsvp.event.location,
                    user: rsvp.event.user,
                },
                data: {
                    status: rsvp.status,
                },
            })
        }

        // Get recent comments from followed users
        const comments = await prisma.comment.findMany({
            where: {
                authorId: {
                    in: followedUserIds,
                },
            },
            include: {
                author: {
                    select: {
                        id: true,
                        username: true,
                        name: true,
                        displayColor: true,
                        profileImage: true,
                    },
                },
                event: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                name: true,
                                displayColor: true,
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        })

        for (const comment of comments) {
            activities.push({
                id: `comment-${comment.id}`,
                type: 'comment',
                createdAt: comment.createdAt.toISOString(),
                user: comment.author,
                event: {
                    id: comment.event.id,
                    title: comment.event.title,
                    startTime: comment.event.startTime.toISOString(),
                    location: comment.event.location,
                    user: comment.event.user,
                },
                data: {
                    commentContent: comment.content,
                },
            })
        }

        // Get recent event creations from followed users
        const newEvents = await prisma.event.findMany({
            where: {
                userId: {
                    in: followedUserIds,
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
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        })

        for (const event of newEvents) {
            activities.push({
                id: `event-${event.id}`,
                type: 'event_created',
                createdAt: event.createdAt.toISOString(),
                user: event.user,
                event: {
                    id: event.id,
                    title: event.title,
                    startTime: event.startTime.toISOString(),
                    location: event.location,
                    user: event.user,
                },
            })
        }

        // Sort all activities by creation date (most recent first)
        activities.sort((a, b) => {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        })

        // Return top 50 most recent activities
        return c.json({
            activities: activities.slice(0, 50),
        })
    } catch (error) {
        console.error('Error getting activity feed:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Debug endpoint to check following relationships
// Only available in development
if (process.env.NODE_ENV !== 'production' && !process.env.VITEST) {
    app.get('/activity/debug', async (c) => {
        try {
            const userId = c.get('userId')

            if (!userId) {
                return c.json({ error: 'Not authenticated' }, 401)
            }

            const allFollowing = await prisma.following.findMany({
                where: { userId },
                select: {
                    actorUrl: true,
                    username: true,
                    accepted: true,
                },
            })

            const allFollowers = await prisma.follower.findMany({
                where: { userId },
                select: {
                    actorUrl: true,
                    username: true,
                    accepted: true,
                    createdAt: true,
                },
            })

            return c.json({
                userId,
                following: allFollowing,
                followers: allFollowers,
                acceptedFollowing: allFollowing.filter(f => f.accepted),
                unacceptedFollowing: allFollowing.filter(f => !f.accepted),
            })
        } catch (error) {
            console.error('Error in debug endpoint:', error)
            return c.json({ error: 'Internal server error' }, 500)
        }
    })
}

export default app

