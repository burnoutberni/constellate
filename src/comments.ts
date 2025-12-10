/**
 * Event Comments
 * Handles threaded comments with ActivityPub federation
 */

import { Hono } from 'hono'
import { z, ZodError } from 'zod'
import type { Comment, Event, User } from '@prisma/client'
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
import { resolveMentions } from './lib/mentions.js'

const app = new Hono()

type EventWithOwner = Event & { user: User | null }

const commentAuthorSelect = {
    id: true,
    username: true,
    name: true,
    profileImage: true,
    displayColor: true,
    isRemote: true,
} as const

const mentionInclude = {
    mentions: {
        include: {
            mentionedUser: {
                select: commentAuthorSelect,
            },
        },
    },
} as const

function getEventOwnerHandle(event: EventWithOwner): string {
    if (event.user?.username) {
        return event.user.username
    }

    if (event.attributedTo) {
        try {
            const actorUrl = new URL(event.attributedTo)
            const username = actorUrl.pathname.split('/').filter(Boolean).pop()
            if (username) {
                return `${username}@${actorUrl.hostname}`
            }
        } catch (error) {
            console.warn('Unable to derive event owner handle:', error)
        }
    }

    return ''
}

// Comment validation schema
const CommentSchema = z.object({
    content: z.string().min(1).max(5000),
    inReplyToId: z.string().optional(),
})

// Helper function to get event author followers URL
function getEventAuthorFollowersUrl(event: EventWithOwner, baseUrl: string): string | undefined {
    const eventAuthorUrl = event.attributedTo!
    
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

// Helper function to get parent comment author URL
async function getParentCommentAuthorUrl(
    inReplyToId: string | undefined,
    userId: string,
    baseUrl: string
): Promise<string | undefined> {
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

// Helper function to create comment mentions
async function createCommentMentions(commentId: string, sanitizedContent: string) {
    const mentionTargets = await resolveMentions(sanitizedContent)

    if (mentionTargets.length) {
        await prisma.commentMention.createMany({
            data: mentionTargets.map((target) => ({
                commentId,
                mentionedUserId: target.user.id,
                handle: target.handle,
            })),
            skipDuplicates: true,
        })
    }

    return mentionTargets
}

// Helper function to build and deliver comment activity
async function buildAndDeliverCommentActivity(
    comment: Comment & { author: User; event: Event },
    event: EventWithOwner,
    eventAuthorFollowersUrl: string | undefined,
    parentCommentAuthorUrl: string | undefined,
    userId: string
) {
    const eventAuthorUrl = event.attributedTo!
    const isPublic = isPublicVisibility(event.visibility)
    const shouldNotifyFollowers = event.visibility === 'PUBLIC' || event.visibility === 'FOLLOWERS'

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
}

// Helper function to build comment broadcast data
function buildCommentBroadcastData(
    commentWithRelations: {
        id: string
        content: string
        createdAt: Date
        author: unknown
        mentions: Array<{
            id: string
            handle: string
            mentionedUser: {
                id: string
                username: string
                name: string | null
                displayColor: string | null
                profileImage: string | null
            }
        }>
    },
    eventId: string
) {
    const mentionPayload = commentWithRelations.mentions.map((mention) => ({
        id: mention.id,
        handle: mention.handle,
        user: {
            id: mention.mentionedUser.id,
            username: mention.mentionedUser.username,
            name: mention.mentionedUser.name,
            displayColor: mention.mentionedUser.displayColor,
            profileImage: mention.mentionedUser.profileImage,
        },
    }))

    return {
        eventId,
        comment: {
            id: commentWithRelations.id,
            content: commentWithRelations.content,
            createdAt: commentWithRelations.createdAt.toISOString(),
            author: commentWithRelations.author,
            mentions: mentionPayload,
        },
    }
}

// New helper for initial validation
async function validateCommentCreation(
    eventId: string,
    userId: string,
    inReplyToId?: string
): Promise<{ event: EventWithOwner; user: User }> {
    const event = (await prisma.event.findUnique({
        where: { id: eventId },
        include: { user: true },
    })) as EventWithOwner | null

    if (!event) throw new AppError('Event not found', 'NOT_FOUND', 404)

    const canView = await canUserViewEvent(event, userId)
    if (!canView) throw new AppError('Forbidden', 'FORBIDDEN', 403)

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new AppError('User not found', 'NOT_FOUND', 404)

    if (inReplyToId) {
        const parentComment = await prisma.comment.findUnique({ where: { id: inReplyToId } })
        if (!parentComment || parentComment.eventId !== eventId) {
            throw new AppError('Invalid parent comment', 'BAD_REQUEST', 400)
        }
    }

    return { event, user }
}

// New helper for broadcasting mention notifications
async function broadcastMentionNotifications(
    targets: Awaited<ReturnType<typeof createCommentMentions>>,
    comment: Comment & { author: User },
    event: EventWithOwner,
    sanitizedContent: string,
    userId: string
) {
    const notificationTargets = targets.filter((target) => !target.user.isRemote && target.user.id !== userId)

    if (notificationTargets.length === 0) return

    const ownerHandle = getEventOwnerHandle(event)

    for (const target of notificationTargets) {
        await broadcast({
            type: BroadcastEvents.MENTION_RECEIVED,
            targetUserId: target.user.id,
            data: {
                commentId: comment.id,
                commentContent: sanitizedContent,
                createdAt: comment.createdAt.toISOString(),
                eventId: event.id,
                eventTitle: event.title,
                eventOwnerHandle: ownerHandle,
                handle: target.handle,
                author: {
                    id: comment.author.id,
                    username: comment.author.username,
                    name: comment.author.name,
                },
            },
        })
    }
}

// Create comment
app.post('/:id/comments', moderateRateLimit, async (c) => {
    try {
        const { id } = c.req.param()
        const userId = requireAuth(c)

        const body = await c.req.json()
        const { content, inReplyToId } = CommentSchema.parse(body)

        const { event } = await validateCommentCreation(id, userId, inReplyToId)

        const sanitizedContent = sanitizeText(content)
        const comment = await prisma.comment.create({
            data: {
                content: sanitizedContent,
                eventId: id,
                authorId: userId,
                inReplyToId: inReplyToId || null,
            },
            include: {
                author: true,
                event: { include: { user: true } },
            },
        })

        const mentionTargets = await createCommentMentions(comment.id, sanitizedContent)

        const commentWithRelations = await prisma.comment.findUnique({
            where: { id: comment.id },
            include: { author: { select: commentAuthorSelect }, ...mentionInclude },
        })

        if (!commentWithRelations) {
            throw new AppError('Failed to load comment relations', 'INTERNAL_ERROR', 500)
        }

        const baseUrl = getBaseUrl()
        const shouldNotifyFollowers = event.visibility === 'PUBLIC' || event.visibility === 'FOLLOWERS'
        const eventAuthorFollowersUrl = shouldNotifyFollowers ? getEventAuthorFollowersUrl(event, baseUrl) : undefined
        const parentCommentAuthorUrl = await getParentCommentAuthorUrl(inReplyToId, userId, baseUrl)

        await buildAndDeliverCommentActivity(comment, event, eventAuthorFollowersUrl, parentCommentAuthorUrl, userId)

        const broadcastData = buildCommentBroadcastData(commentWithRelations, id)
        await broadcast({ type: BroadcastEvents.COMMENT_ADDED, data: broadcastData })
        console.log(`📡 Broadcasting comment:added for event ${id}`)

        await broadcastMentionNotifications(mentionTargets, comment, event, sanitizedContent, userId)

        return c.json(commentWithRelations, 201)
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
                    select: commentAuthorSelect,
                },
                ...mentionInclude,
                replies: {
                    include: {
                        author: {
                            select: commentAuthorSelect,
                        },
                        ...mentionInclude,
                        replies: {
                            include: {
                                author: {
                                    select: commentAuthorSelect,
                                },
                                ...mentionInclude,
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
        const shouldNotifyFollowers = event.visibility === 'PUBLIC' || event.visibility === 'FOLLOWERS'
        const eventAuthorFollowersUrl = shouldNotifyFollowers
            ? getEventAuthorFollowersUrl(event, baseUrl)
            : undefined

        // Get parent comment author URL if replying
        const parentCommentAuthorUrl = comment.inReplyTo && comment.inReplyTo.author.id !== userId
            ? (comment.inReplyTo.author.externalActorUrl ||
                `${baseUrl}/users/${comment.inReplyTo.author.username}`)
            : undefined

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
