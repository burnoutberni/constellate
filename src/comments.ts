/**
 * Event Comments
 * Handles threaded comments with ActivityPub federation
 */

import { Hono } from 'hono'
import { z, ZodError } from 'zod'
import type { Event, User } from '@prisma/client'
import { buildCreateCommentActivity, buildDeleteCommentActivity } from './services/ActivityBuilder.js'
import { deliverToActors, deliverToFollowers } from './services/ActivityDelivery.js'
import { getBaseUrl } from './lib/activitypubHelpers.js'
import { requireAuth } from './middleware/auth.js'
import { moderateRateLimit } from './middleware/rateLimit.js'
import { broadcast, BroadcastEvents } from './realtime.js'
import { prisma } from './lib/prisma.js'
import { canUserViewEvent, isPublicVisibility } from './lib/eventVisibility.js'
import { AppError } from './lib/errors.js'
import { sanitizeText } from './lib/sanitization.js'

const app = new Hono()

type EventWithOwner = Event & { user: User | null }

// Comment validation schema
const CommentSchema = z.object({
    content: z.string().min(1).max(5000),
    inReplyToId: z.string().optional(),
})

// Create comment
app.post('/:id/comments', moderateRateLimit, async (c) => {
    try {
        const { id } = c.req.param()
        const userId = requireAuth(c)

        const body = await c.req.json()
        const { content, inReplyToId } = CommentSchema.parse(body)

        // Get event
        const event = (await prisma.event.findUnique({
            where: { id },
            include: { user: true },
        })) as EventWithOwner | null

        if (!event) {
            return c.json({ error: 'Event not found' }, 404)
        }

        const canView = await canUserViewEvent(event, userId)
        if (!canView) {
            return c.json({ error: 'Forbidden' }, 403)
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
        })

        if (!user) {
            return c.json({ error: 'User not found' }, 404)
        }

        // Validate inReplyToId if provided
        if (inReplyToId) {
            const parentComment = await prisma.comment.findUnique({
                where: { id: inReplyToId },
            })

            if (!parentComment || parentComment.eventId !== id) {
                return c.json({ error: 'Invalid parent comment' }, 400)
            }
        }

        // Create comment with sanitized content
        const comment = await prisma.comment.create({
            data: {
                content: sanitizeText(content),
                eventId: id,
                authorId: userId,
                inReplyToId: inReplyToId || null,
            },
            include: {
                author: true,
                event: true,
            },
        })

        // Build and deliver Create(Note) activity
        const baseUrl = getBaseUrl()
        const eventAuthorUrl = event.attributedTo!

        const getEventAuthorFollowersUrl = () => {
            if (event.user) {
                return `${baseUrl}/users/${event.user.username}/followers`
            }
            if (eventAuthorUrl.startsWith(baseUrl)) {
                const username = eventAuthorUrl.split('/').pop()
                if (username) {
                    return `${baseUrl}/users/${username}/followers`
                }
            }
            return undefined
        }

        const getParentCommentAuthorUrl = async () => {
            if (!inReplyToId) return undefined
            const parentComment = await prisma.comment.findUnique({
                where: { id: inReplyToId },
                include: { author: true },
            })
            if (parentComment && parentComment.author.id !== userId) {
                return parentComment.author.externalActorUrl ||
                    `${baseUrl}/users/${parentComment.author.username}`
            }
            return undefined
        }

        // Get event author's followers URL only when needed
        const shouldNotifyFollowers = event.visibility === 'PUBLIC' || event.visibility === 'FOLLOWERS'
        const eventAuthorFollowersUrl = shouldNotifyFollowers ? getEventAuthorFollowersUrl() : undefined
        const parentCommentAuthorUrl = await getParentCommentAuthorUrl()

        // Determine if event is public
        const isPublic = isPublicVisibility(event.visibility)

        const activity = buildCreateCommentActivity(
            comment,
            eventAuthorUrl,
            eventAuthorFollowersUrl,
            parentCommentAuthorUrl,
            isPublic
        )

        // Build recipients list
        const recipients: string[] = [eventAuthorUrl]
        if (parentCommentAuthorUrl && parentCommentAuthorUrl !== eventAuthorUrl) {
            recipients.push(parentCommentAuthorUrl)
        }

        // Deliver to direct recipients
        await deliverToActors(activity, recipients, userId)

        // Also deliver to event author's followers if event allows it
        if (eventAuthorFollowersUrl && event.user && shouldNotifyFollowers) {
            await deliverToFollowers(activity, event.user.id)
        }

        // Broadcast real-time update
        const broadcastData = {
            eventId: id,
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
        console.log(`📡 Broadcasting comment:added for event ${id}`)
        await broadcast({
            type: BroadcastEvents.COMMENT_ADDED,
            data: broadcastData,
        })

        return c.json(comment, 201)
    } catch (error) {
        if (error instanceof AppError) {
            throw error
        }
        if (error instanceof ZodError) {
            return c.json({ error: 'Validation failed', details: error.issues }, 400 as const)
        }
        console.error('Error creating comment:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Get comments
app.get('/:id/comments', async (c) => {
    try {
        const { id } = c.req.param()

        // Get top-level comments with replies
        const comments = await prisma.comment.findMany({
            where: {
                eventId: id,
                inReplyToId: null,
            },
            include: {
                author: {
                    select: {
                        id: true,
                        username: true,
                        name: true,
                        profileImage: true,
                        displayColor: true,
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
                                    },
                                },
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        })

        return c.json({
            comments,
            count: comments.length,
        })
    } catch (error) {
        console.error('Error getting comments:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Delete comment
app.delete('/comments/:commentId', moderateRateLimit, async (c) => {
    try {
        const { commentId } = c.req.param()
        const userId = requireAuth(c)

        // Get comment with related data
        const comment = await prisma.comment.findUnique({
            where: { id: commentId },
            include: {
                author: true,
                event: {
                    include: { user: true },
                },
                inReplyTo: {
                    include: { author: true },
                },
            },
        })

        if (!comment) {
            return c.json({ error: 'Comment not found' }, 404)
        }

        // Check ownership
        if (comment.authorId !== userId) {
            return c.json({ error: 'Forbidden' }, 403)
        }

        const baseUrl = getBaseUrl()
        const event = comment.event as EventWithOwner
        const eventAuthorUrl = event.attributedTo!

        // Get event author's followers URL
        let eventAuthorFollowersUrl: string | undefined
        const shouldNotifyFollowers = event.visibility === 'PUBLIC' || event.visibility === 'FOLLOWERS'
        if (shouldNotifyFollowers) {
            if (event.user) {
                eventAuthorFollowersUrl = `${baseUrl}/users/${event.user.username}/followers`
            } else if (eventAuthorUrl.startsWith(baseUrl)) {
                const username = eventAuthorUrl.split('/').pop()
                if (username) {
                    eventAuthorFollowersUrl = `${baseUrl}/users/${username}/followers`
                }
            }
        }

        // Get parent comment author URL if replying
        let parentCommentAuthorUrl: string | undefined
        if (comment.inReplyTo && comment.inReplyTo.author.id !== userId) {
            parentCommentAuthorUrl = comment.inReplyTo.author.externalActorUrl ||
                `${baseUrl}/users/${comment.inReplyTo.author.username}`
        }

        const isPublic = isPublicVisibility(event.visibility)

        // Build Delete activity before deleting
        const activity = buildDeleteCommentActivity(
            comment,
            eventAuthorUrl,
            eventAuthorFollowersUrl,
            parentCommentAuthorUrl,
            isPublic
        )

        // Build recipients list
        const recipients: string[] = [eventAuthorUrl]
        if (parentCommentAuthorUrl && parentCommentAuthorUrl !== eventAuthorUrl) {
            recipients.push(parentCommentAuthorUrl)
        }

        // Delete comment (cascades to replies)
        await prisma.comment.delete({
            where: { id: commentId },
        })

        // Deliver Delete activity
        await deliverToActors(activity, recipients, userId)

        // Also deliver to event author's followers if event is public
        if (eventAuthorFollowersUrl && event.user && shouldNotifyFollowers) {
            await deliverToFollowers(activity, event.user.id)
        }

        // Broadcast real-time update
        await broadcast({
            type: BroadcastEvents.COMMENT_DELETED,
            data: {
                eventId: comment.eventId,
                commentId: commentId,
            },
        })

        return c.json({ success: true })
    } catch (error) {
        if (error instanceof AppError) {
            throw error
        }
        console.error('Error deleting comment:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

export default app
