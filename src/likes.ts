/**
 * Event Likes/Bookmarks
 * Handles event likes with ActivityPub federation
 */

import { Hono } from 'hono'
import { buildLikeActivity, buildUndoActivity } from './services/ActivityBuilder.js'
import { deliverToActors, deliverToFollowers, deliverActivity } from './services/ActivityDelivery.js'
import { broadcast, BroadcastEvents } from './realtime.js'
import { requireAuth } from './middleware/auth.js'
import { moderateRateLimit } from './middleware/rateLimit.js'
import { getBaseUrl } from './lib/activitypubHelpers.js'
import { getPublicAddressing } from './lib/audience.js'
import { prisma } from './lib/prisma.js'

const app = new Hono()

// Like event
app.post('/:id/like', moderateRateLimit, async (c) => {
    try {
        const { id } = c.req.param()
        const userId = requireAuth(c)

        // Get event with author info
        const event = await prisma.event.findUnique({
            where: { id },
            include: {
                user: true,
            },
        })

        if (!event) {
            return c.json({ error: 'Event not found' }, 404)
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
        })

        if (!user) {
            return c.json({ error: 'User not found' }, 404)
        }

        // Check if already liked
        const existing = await prisma.eventLike.findUnique({
            where: {
                eventId_userId: {
                    eventId: id,
                    userId,
                },
            },
        })

        if (existing) {
            return c.json({ error: 'Already liked' }, 400)
        }

        // Create like
        const like = await prisma.eventLike.create({
            data: {
                eventId: id,
                userId,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        name: true,
                        profileImage: true,
                        displayColor: true,
                    },
                },
            },
        })

        // Build and deliver Like activity
        const baseUrl = getBaseUrl()
        const eventUrl = event.externalId || `${baseUrl}/events/${id}`
        const eventAuthorUrl = event.attributedTo!
        
        // Get event author's followers URL (if local user)
        let eventAuthorFollowersUrl: string | undefined
        if (event.user) {
            eventAuthorFollowersUrl = `${baseUrl}/users/${event.user.username}/followers`
        } else if (eventAuthorUrl.startsWith(baseUrl)) {
            // Local user but not in relation - extract username from URL
            const username = eventAuthorUrl.split('/').pop()
            if (username) {
                eventAuthorFollowersUrl = `${baseUrl}/users/${username}/followers`
            }
        }
        
        // Determine if event is public (default to true for now)
        // Events created with to: [PUBLIC_COLLECTION] are public
        const isPublic = true

        const activity = buildLikeActivity(
            user,
            eventUrl,
            eventAuthorUrl,
            eventAuthorFollowersUrl,
            isPublic
        )
        
        // Deliver to event author and their followers
        await deliverToActors(activity, [eventAuthorUrl], userId)
        
        // Also deliver to event author's followers if event is public
        if (eventAuthorFollowersUrl && event.user) {
            await deliverToFollowers(activity, event.user.id)
        }

        // Broadcast real-time update
        broadcast({
            type: BroadcastEvents.LIKE_ADDED,
            data: {
                eventId: id,
                like,
            },
        })

        return c.json(like, 201)
    } catch (error) {
        console.error('Error liking event:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Unlike event
app.delete('/:id/like', moderateRateLimit, async (c) => {
    try {
        const { id } = c.req.param()
        const userId = requireAuth(c)

        // Check if liked
        const like = await prisma.eventLike.findUnique({
            where: {
                eventId_userId: {
                    eventId: id,
                    userId,
                },
            },
            include: {
                event: { include: { user: true } },
                user: true,
            },
        })

        if (!like) {
            return c.json({ error: 'Not liked' }, 404)
        }


        const user = await prisma.user.findUnique({
            where: { id: userId },
        })

        if (!user) {
            return c.json({ error: 'User not found' }, 404)
        }

        // Delete like
        await prisma.eventLike.delete({
            where: {
                eventId_userId: {
                    eventId: id,
                    userId,
                },
            },
        })

        // Build and deliver Undo(Like) activity
        const baseUrl = getBaseUrl()
        const eventUrl = like.event.externalId || `${baseUrl}/events/${id}`
        const eventAuthorUrl = like.event.attributedTo!
        
        // Get event author's followers URL
        let eventAuthorFollowersUrl: string | undefined
        if (like.event.user) {
            eventAuthorFollowersUrl = `${baseUrl}/users/${like.event.user.username}/followers`
        } else if (eventAuthorUrl.startsWith(baseUrl)) {
            const username = eventAuthorUrl.split('/').pop()
            if (username) {
                eventAuthorFollowersUrl = `${baseUrl}/users/${username}/followers`
            }
        }
        
        const isPublic = true

        const likeActivity = buildLikeActivity(
            user,
            eventUrl,
            eventAuthorUrl,
            eventAuthorFollowersUrl,
            isPublic
        )
        const undoActivity = buildUndoActivity(user, likeActivity)

        // Deliver to event author and their followers
        await deliverToActors(undoActivity, [eventAuthorUrl], userId)
        
        // Also deliver to event author's followers if event is public
        if (eventAuthorFollowersUrl && like.event.user) {
            await deliverToFollowers(undoActivity, like.event.user.id)
        }

        // Broadcast real-time update
        broadcast({
            type: BroadcastEvents.LIKE_REMOVED,
            data: {
                eventId: id,
                userId,
            },
        })

        return c.json({ success: true })
    } catch (error) {
        console.error('Error unliking event:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Get likes
app.get('/:id/likes', async (c) => {
    try {
        const { id } = c.req.param()

        const likes = await prisma.eventLike.findMany({
            where: { eventId: id },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        name: true,
                        profileImage: true,
                        displayColor: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        })

        return c.json({
            likes,
            count: likes.length,
        })
    } catch (error) {
        console.error('Error getting likes:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

export default app
