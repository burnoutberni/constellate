/**
 * Activity Feed
 * Returns activities from people the user follows
 */

import { Hono } from 'hono'
import { prisma } from './lib/prisma.js'
import { canUserViewEvent } from './lib/eventVisibility.js'

export interface FeedActivity {
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

async function getFollowing(userId: string) {
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
        console.log(`[Activity Feed] Following actorUrls:`, following.map((f) => f.actorUrl))
    }

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
        console.log(
            `[Activity Feed] Found ${unacceptedFollowing.length} unaccepted following relationships:`,
            unacceptedFollowing.map((f) => f.actorUrl)
        )
    }

    return following
}

async function resolveFollowedUserIds(following: Array<{ actorUrl: string }>) {
    const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000'
    const followedUserIds: string[] = []

    for (const follow of following) {
        const user = await resolveActorUser(follow.actorUrl, baseUrl)
        if (user) {
            followedUserIds.push(user.id)
        } else {
            console.log(`[Activity Feed] Could not find user for actorUrl: ${follow.actorUrl}`)
        }
    }

    return followedUserIds
}

async function resolveActorUser(actorUrl: string, baseUrl: string) {
    if (actorUrl.startsWith(baseUrl)) {
        const username = actorUrl.split('/').pop()
        if (!username) {
            return null
        }
        return prisma.user.findUnique({
            where: {
                username,
                isRemote: false,
            },
            select: { id: true },
        })
    }

    return prisma.user.findFirst({
        where: {
            externalActorUrl: actorUrl,
            isRemote: true,
        },
        select: { id: true },
    })
}

function buildEventSummary(event: {
    id: string
    title: string
    startTime: Date
    location: string | null
    user: FeedActivity['event']['user']
}) {
    return {
        id: event.id,
        title: event.title,
        startTime: event.startTime.toISOString(),
        location: event.location,
        user: event.user,
    }
}

type VisibilityTarget = Parameters<typeof canUserViewEvent>[0]

async function filterVisibleActivities<T>(
    records: T[],
    viewerId: string,
    getEvent: (record: T) => VisibilityTarget,
    buildActivity: (record: T) => FeedActivity
) {
    const visibleActivities: FeedActivity[] = []
    for (const record of records) {
        const canView = await canUserViewEvent(getEvent(record), viewerId)
        if (canView) {
            visibleActivities.push(buildActivity(record))
        }
    }
    return visibleActivities
}

async function fetchLikeActivities(followedUserIds: string[], viewerId: string) {
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

    return filterVisibleActivities(
        likes,
        viewerId,
        (like) => like.event,
        (like) => ({
            id: `like-${like.id}`,
            type: 'like',
            createdAt: like.createdAt.toISOString(),
            user: like.user,
            event: buildEventSummary(like.event),
        })
    )
}

async function fetchRsvpActivities(followedUserIds: string[], viewerId: string) {
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

    return filterVisibleActivities(
        rsvps,
        viewerId,
        (rsvp) => rsvp.event,
        (rsvp) => ({
            id: `rsvp-${rsvp.id}`,
            type: 'rsvp',
            createdAt: rsvp.createdAt.toISOString(),
            user: rsvp.user,
            event: buildEventSummary(rsvp.event),
            data: {
                status: rsvp.status,
            },
        })
    )
}

async function fetchCommentActivities(followedUserIds: string[], viewerId: string) {
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

    return filterVisibleActivities(
        comments,
        viewerId,
        (comment) => comment.event,
        (comment) => ({
            id: `comment-${comment.id}`,
            type: 'comment',
            createdAt: comment.createdAt.toISOString(),
            user: comment.author,
            event: buildEventSummary(comment.event),
            data: {
                commentContent: comment.content,
            },
        })
    )
}

async function fetchNewEventActivities(followedUserIds: string[], viewerId: string) {
    const events = await prisma.event.findMany({
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

    return filterVisibleActivities(
        events,
        viewerId,
        (event) => event,
        (event) => ({
            id: `event-${event.id}`,
            type: 'event_created',
            createdAt: event.createdAt.toISOString(),
            user: event.user,
            event: buildEventSummary(event),
        })
    )
}

async function collectActivities(followedUserIds: string[], viewerId: string) {
    const [likes, rsvps, comments, newEvents] = await Promise.all([
        fetchLikeActivities(followedUserIds, viewerId),
        fetchRsvpActivities(followedUserIds, viewerId),
        fetchCommentActivities(followedUserIds, viewerId),
        fetchNewEventActivities(followedUserIds, viewerId),
    ])

    const combined = [...likes, ...rsvps, ...comments, ...newEvents]
    combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return combined.slice(0, 50)
}

// Get activity feed for authenticated user
app.get('/activity/feed', async (c) => {
    try {
        const userId = c.get('userId')

        if (!userId) {
            return c.json({ activities: [] })
        }

        const following = await getFollowing(userId)
        const followedUserIds = await resolveFollowedUserIds(following)

        console.log(
            `[Activity Feed] User ${userId} follows ${followedUserIds.length} users (after resolving actorUrls):`,
            followedUserIds
        )

        if (followedUserIds.length === 0) {
            return c.json({ activities: [] })
        }

        const activities = await collectActivities(followedUserIds, userId)
        return c.json({ activities })
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

export const __testExports = {
    buildEventSummary,
    filterVisibleActivities,
    resolveActorUser,
    resolveFollowedUserIds,
    fetchLikeActivities,
    fetchRsvpActivities,
    fetchCommentActivities,
    fetchNewEventActivities,
}

