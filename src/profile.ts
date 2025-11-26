/**
 * Profile Management
 * User profile endpoints with federation
 */

import { Hono } from 'hono'
import { z } from 'zod'
import { buildUpdateProfileActivity, buildFollowActivity, buildUndoActivity } from './services/ActivityBuilder.js'
import { deliverToFollowers, deliverToInbox } from './services/ActivityDelivery.js'
import { getBaseUrl } from './lib/activitypubHelpers.js'
import { requireAuth } from './middleware/auth.js'
import { prisma } from './lib/prisma.js'

const app = new Hono()

// Profile update schema
const ProfileUpdateSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    bio: z.string().max(500).optional(),
    displayColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    profileImage: z.string().url().optional(),
    headerImage: z.string().url().optional(),
})

// Get profile
app.get('/users/:username/profile', async (c) => {
    try {
        const { username } = c.req.param()

        const user = await prisma.user.findUnique({
            where: { username },
            select: {
                id: true,
                username: true,
                name: true,
                bio: true,
                displayColor: true,
                profileImage: true,
                headerImage: true,
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

        if (!user) {
            return c.json({ error: 'User not found' }, 404)
        }

        return c.json(user)
    } catch (error) {
        console.error('Error getting profile:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Update own profile
app.put('/profile', async (c) => {
    try {
        const userId = requireAuth(c)

        const body = await c.req.json()
        const updates = ProfileUpdateSchema.parse(body)

        // Update user (requireAuth ensures user can only update their own profile)
        const user = await prisma.user.update({
            where: { id: userId },
            data: updates,
        })

        // Build and deliver Update(Person) activity to followers
        const activity = buildUpdateProfileActivity(user)
        await deliverToFollowers(activity, userId)

        return c.json(user)
    } catch (error) {
        if (error instanceof z.ZodError) {
            return c.json({ error: 'Validation failed', details: error.errors }, 400)
        }
        console.error('Error updating profile:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Check follow status
app.get('/users/:username/follow-status', async (c) => {
    try {
        const { username } = c.req.param()
        const userId = c.get('userId')

        if (!userId) {
            return c.json({ isFollowing: false, isAccepted: false })
        }

        // Find target user
        const isRemote = username.includes('@')
        const targetUser = await prisma.user.findFirst({
            where: {
                username,
                isRemote,
            },
        })

        if (!targetUser) {
            return c.json({ error: 'User not found' }, 404)
        }

        // Get target actor URL
        const baseUrl = getBaseUrl()
        const targetActorUrl = targetUser.isRemote
            ? targetUser.externalActorUrl!
            : `${baseUrl}/users/${targetUser.username}`

        // Check if following
        const following = await prisma.following.findUnique({
            where: {
                userId_actorUrl: {
                    userId,
                    actorUrl: targetActorUrl,
                },
            },
        })

        return c.json({
            isFollowing: following !== null,
            isAccepted: following?.accepted || false,
        })
    } catch (error) {
        console.error('Error checking follow status:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Follow user
app.post('/users/:username/follow', async (c) => {
    try {
        const { username } = c.req.param()
        const userId = requireAuth(c)

        // Get current user
        const currentUser = await prisma.user.findUnique({
            where: { id: userId, isRemote: false },
        })

        if (!currentUser) {
            return c.json({ error: 'User not found' }, 404)
        }

        // Find target user
        const isRemote = username.includes('@')
        const targetUser = await prisma.user.findFirst({
            where: {
                username,
                isRemote,
            },
        })

        if (!targetUser) {
            return c.json({ error: 'User not found' }, 404)
        }

        // Can't follow yourself
        if (targetUser.id === userId) {
            return c.json({ error: 'Cannot follow yourself' }, 400)
        }

        // Get target actor URL
        const baseUrl = getBaseUrl()
        const targetActorUrl = targetUser.isRemote
            ? targetUser.externalActorUrl!
            : `${baseUrl}/users/${targetUser.username}`

        // Check if already following
        const existing = await prisma.following.findUnique({
            where: {
                userId_actorUrl: {
                    userId,
                    actorUrl: targetActorUrl,
                },
            },
        })

        if (existing) {
            return c.json({ error: 'Already following' }, 400)
        }

        // Build Follow activity
        const followActivity = buildFollowActivity(currentUser, targetActorUrl)

        // Create following record
        const following = await prisma.following.create({
            data: {
                userId,
                actorUrl: targetActorUrl,
                username: targetUser.username,
                inboxUrl: targetUser.inboxUrl || '',
                sharedInboxUrl: targetUser.sharedInboxUrl,
                iconUrl: targetUser.profileImage,
                accepted: !targetUser.isRemote, // Auto-accept for local users
            },
        })

        // For local users, also create the follower record immediately
        if (!targetUser.isRemote) {
            const currentUserActorUrl = `${baseUrl}/users/${currentUser.username}`
            await prisma.follower.upsert({
                where: {
                    userId_actorUrl: {
                        userId: targetUser.id,
                        actorUrl: currentUserActorUrl,
                    },
                },
                update: {
                    accepted: true,
                },
                create: {
                    userId: targetUser.id,
                    actorUrl: currentUserActorUrl,
                    username: currentUser.username,
                    inboxUrl: `${baseUrl}/users/${currentUser.username}/inbox`,
                    sharedInboxUrl: `${baseUrl}/inbox`,
                    iconUrl: currentUser.profileImage,
                    accepted: true,
                },
            })
        }

        // Deliver Follow activity to target user's inbox
        if (targetUser.isRemote && targetUser.inboxUrl) {
            // Remote user - send to their inbox
            const inboxUrl = targetUser.sharedInboxUrl || targetUser.inboxUrl
            await deliverToInbox(followActivity, inboxUrl, currentUser)
        } else {
            // Local user - handle locally (will be processed by inbox handler)
            const inboxUrl = `${baseUrl}/users/${targetUser.username}/inbox`
            await deliverToInbox(followActivity, inboxUrl, currentUser)
        }

        return c.json({ success: true, message: 'Follow request sent' })
    } catch (error) {
        if (error instanceof Error && error.message === 'Authentication required') {
            return c.json({ error: 'Unauthorized' }, 401)
        }
        console.error('Error following user:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Unfollow user
app.delete('/users/:username/follow', async (c) => {
    try {
        const { username } = c.req.param()
        const userId = requireAuth(c)

        // Get current user
        const currentUser = await prisma.user.findUnique({
            where: { id: userId, isRemote: false },
        })

        if (!currentUser) {
            return c.json({ error: 'User not found' }, 404)
        }

        // Find target user
        const isRemote = username.includes('@')
        const targetUser = await prisma.user.findFirst({
            where: {
                username,
                isRemote,
            },
        })

        if (!targetUser) {
            return c.json({ error: 'User not found' }, 404)
        }

        // Get target actor URL
        const baseUrl = getBaseUrl()
        const targetActorUrl = targetUser.isRemote
            ? targetUser.externalActorUrl!
            : `${baseUrl}/users/${targetUser.username}`

        // Check if following
        const following = await prisma.following.findUnique({
            where: {
                userId_actorUrl: {
                    userId,
                    actorUrl: targetActorUrl,
                },
            },
        })

        if (!following) {
            return c.json({ error: 'Not following' }, 400)
        }

        // Build original Follow activity for Undo
        const originalFollowActivity = buildFollowActivity(currentUser, targetActorUrl)
        const undoActivity = buildUndoActivity(currentUser, originalFollowActivity)

        // Delete following record
        await prisma.following.delete({
            where: {
                userId_actorUrl: {
                    userId,
                    actorUrl: targetActorUrl,
                },
            },
        })

        // Also remove from target user's followers
        const currentUserActorUrl = `${baseUrl}/users/${currentUser.username}`
        await prisma.follower.deleteMany({
            where: {
                userId: targetUser.id,
                actorUrl: currentUserActorUrl,
            },
        })

        // Deliver Undo(Follow) activity
        if (targetUser.isRemote && targetUser.inboxUrl) {
            const inboxUrl = targetUser.sharedInboxUrl || targetUser.inboxUrl
            await deliverToInbox(undoActivity, inboxUrl, currentUser)
        } else {
            const inboxUrl = `${baseUrl}/users/${targetUser.username}/inbox`
            await deliverToInbox(undoActivity, inboxUrl, currentUser)
        }

        return c.json({ success: true, message: 'Unfollowed' })
    } catch (error) {
        if (error instanceof Error && error.message === 'Authentication required') {
            return c.json({ error: 'Unauthorized' }, 401)
        }
        console.error('Error unfollowing user:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

export default app
