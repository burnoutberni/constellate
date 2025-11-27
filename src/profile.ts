/**
 * Profile Management
 * User profile endpoints with federation
 */

import { Hono } from 'hono'
import { z, ZodError } from 'zod'
import { buildUpdateProfileActivity, buildFollowActivity, buildUndoActivity, buildAcceptActivity, buildRejectFollowActivity } from './services/ActivityBuilder.js'
import { deliverToFollowers, deliverToInbox } from './services/ActivityDelivery.js'
import { getBaseUrl } from './lib/activitypubHelpers.js'
import { requireAuth } from './middleware/auth.js'
import { prisma } from './lib/prisma.js'
import { broadcastToUser, BroadcastEvents } from './realtime.js'
import type { FollowActivity } from './lib/activitypubSchemas.js'

const app = new Hono()

// Profile update schema
const ProfileUpdateSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    bio: z.string().max(500).optional(),
    displayColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    profileImage: z.string().url().optional(),
    headerImage: z.string().url().optional(),
    autoAcceptFollowers: z.boolean().optional(),
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
                    },
                },
            },
        })

        if (!user) {
            return c.json({ error: 'User not found' }, 404)
        }

        // Calculate actual follower/following counts (only accepted)
        // For remote users, we can't calculate counts from our local database
        let followerCount = 0
        let followingCount = 0

        if (!user.isRemote) {
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

        return c.json({
            ...user,
            _count: {
                ...user._count,
                followers: followerCount,
                following: followingCount,
            },
        })
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
        if (error instanceof ZodError) {
            return c.json({ error: 'Validation failed', details: error.issues }, 400 as const)
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
        
        // For remote users, we don't need autoAcceptFollowers (they handle it on their server)
        // For local users, we need it to check their setting
        const targetUser = await prisma.user.findFirst({
            where: {
                username,
                isRemote,
            },
            select: isRemote ? {
                id: true,
                username: true,
                name: true,
                bio: true,
                displayColor: true,
                profileImage: true,
                headerImage: true,
                isRemote: true,
                externalActorUrl: true,
                inboxUrl: true,
                sharedInboxUrl: true,
            } : {
                id: true,
                username: true,
                name: true,
                bio: true,
                displayColor: true,
                profileImage: true,
                headerImage: true,
                isRemote: true,
                externalActorUrl: true,
                inboxUrl: true,
                sharedInboxUrl: true,
                autoAcceptFollowers: true,
            } as any,
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

        // If already following and accepted, return error
        // If already following but not accepted, we can resend the follow request
        if (existing && existing.accepted) {
            return c.json({ error: 'Already following' }, 400)
        }

        // If existing but not accepted, delete it so we can create a new one
        if (existing && !existing.accepted) {
            await prisma.following.delete({
                where: {
                    userId_actorUrl: {
                        userId,
                        actorUrl: targetActorUrl,
                    },
                },
            })
        }

        // Build Follow activity
        const followActivity = buildFollowActivity(currentUser, targetActorUrl)

        // For local users, handle the follow directly (no need to go through inbox)
        if (!targetUser.isRemote) {
            const currentUserActorUrl = `${baseUrl}/users/${currentUser.username}`
            // Check if target user auto-accepts followers (only for local users)
            const shouldAutoAccept = (targetUser as any).autoAcceptFollowers ?? true
            
            // Create the follower record
            await prisma.follower.upsert({
                where: {
                    userId_actorUrl: {
                        userId: targetUser.id,
                        actorUrl: currentUserActorUrl,
                    },
                },
                update: {
                    accepted: shouldAutoAccept,
                },
                create: {
                    userId: targetUser.id,
                    actorUrl: currentUserActorUrl,
                    username: currentUser.username,
                    inboxUrl: `${baseUrl}/users/${currentUser.username}/inbox`,
                    sharedInboxUrl: `${baseUrl}/inbox`,
                    iconUrl: currentUser.profileImage,
                    accepted: shouldAutoAccept,
                },
            })

            // Create following record - for local users, accepted status matches auto-accept setting
            const following = await prisma.following.create({
                data: {
                    userId,
                    actorUrl: targetActorUrl,
                    username: targetUser.username,
                    inboxUrl: targetUser.inboxUrl || '',
                    sharedInboxUrl: targetUser.sharedInboxUrl,
                    iconUrl: targetUser.profileImage,
                    accepted: shouldAutoAccept, // Already accepted if auto-accepting
                },
            })

            // If auto-accepting, we've already set accepted: true above, so no need to send Accept activity
            // The records are already in the correct state
        } else {
            // Remote user - create following record as unaccepted, will be updated when they accept
            const following = await prisma.following.create({
                data: {
                    userId,
                    actorUrl: targetActorUrl,
                    username: targetUser.username,
                    inboxUrl: targetUser.inboxUrl || '',
                    sharedInboxUrl: targetUser.sharedInboxUrl,
                    iconUrl: targetUser.profileImage,
                    accepted: false, // Will be updated when remote user accepts
                },
            })

            // Send Follow activity to their inbox
            const inboxUrl = targetUser.sharedInboxUrl || targetUser.inboxUrl
            if (inboxUrl) {
                await deliverToInbox(followActivity, inboxUrl, currentUser)
            }

            // Broadcast FOLLOW_PENDING to the follower's clients
            // This tells Alice's frontend that the request was sent and is pending
            await broadcastToUser(userId, {
                type: BroadcastEvents.FOLLOW_PENDING,
                data: {
                    username: targetUser.username,
                    actorUrl: targetActorUrl,
                    isAccepted: false,
                },
            })
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

        // Also remove from target user's followers (for local users)
        if (!targetUser.isRemote) {
            const currentUserActorUrl = `${baseUrl}/users/${currentUser.username}`
            await prisma.follower.deleteMany({
                where: {
                    userId: targetUser.id,
                    actorUrl: currentUserActorUrl,
                },
            })
        }

        // Deliver Undo(Follow) activity
        if (targetUser.isRemote && targetUser.inboxUrl) {
            const inboxUrl = targetUser.sharedInboxUrl || targetUser.inboxUrl
            await deliverToInbox(undoActivity, inboxUrl, currentUser)
        } else if (!targetUser.isRemote) {
            const inboxUrl = `${baseUrl}/users/${targetUser.username}/inbox`
            await deliverToInbox(undoActivity, inboxUrl, currentUser)
        }

        // Broadcast FOLLOW_REMOVED to the unfollower's clients (Alice)
        await broadcastToUser(userId, {
            type: BroadcastEvents.FOLLOW_REMOVED,
            data: {
                username: targetUser.username,
                actorUrl: targetActorUrl,
                isFollowing: false,
            },
        })

        return c.json({ success: true, message: 'Unfollowed' })
    } catch (error) {
        if (error instanceof Error && error.message === 'Authentication required') {
            return c.json({ error: 'Unauthorized' }, 401)
        }
        console.error('Error unfollowing user:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Get pending followers
app.get('/followers/pending', async (c) => {
    try {
        const userId = requireAuth(c)

        const pendingFollowers = await prisma.follower.findMany({
            where: {
                userId,
                accepted: false,
            },
            orderBy: { createdAt: 'desc' },
        })

        // Resolve followers to user objects
        const baseUrl = getBaseUrl()
        const followerUsers = []

        for (const follower of pendingFollowers) {
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
                            bio: true,
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
                        bio: true,
                    },
                })
            }

            if (followerUser) {
                followerUsers.push({
                    ...followerUser,
                    followerId: follower.id,
                    createdAt: follower.createdAt,
                })
            }
        }

        return c.json({ followers: followerUsers })
    } catch (error) {
        console.error('Error getting pending followers:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Accept follower
app.post('/followers/:followerId/accept', async (c) => {
    try {
        const userId = requireAuth(c)
        const { followerId } = c.req.param()

        const follower = await prisma.follower.findUnique({
            where: { id: followerId },
            include: {
                user: true,
            },
        })

        if (!follower || follower.userId !== userId) {
            return c.json({ error: 'Follower not found' }, 404)
        }

        if (follower.accepted) {
            return c.json({ error: 'Follower already accepted' }, 400)
        }

        // Update follower to accepted
        await prisma.follower.update({
            where: { id: followerId },
            data: { accepted: true },
        })

        // Send Accept activity to the follower
        const baseUrl = getBaseUrl()
        const followActivity: FollowActivity = {
            '@context': ['https://www.w3.org/ns/activitystreams'],
            id: `${follower.actorUrl}/follows/${Date.now()}`,
            type: 'Follow',
            actor: follower.actorUrl,
            object: `${baseUrl}/users/${follower.user.username}`,
            published: new Date().toISOString(),
        }
        const acceptActivity = buildAcceptActivity(follower.user, followActivity)
        const inboxUrl = follower.sharedInboxUrl || follower.inboxUrl
        await deliverToInbox(acceptActivity, inboxUrl, follower.user)

        return c.json({ success: true, message: 'Follower accepted' })
    } catch (error) {
        console.error('Error accepting follower:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Reject follower
app.post('/followers/:followerId/reject', async (c) => {
    try {
        const userId = requireAuth(c)
        const { followerId } = c.req.param()

        const follower = await prisma.follower.findUnique({
            where: { id: followerId },
            include: {
                user: true,
            },
        })

        if (!follower || follower.userId !== userId) {
            return c.json({ error: 'Follower not found' }, 404)
        }

        // Delete the follower record
        await prisma.follower.delete({
            where: { id: followerId },
        })

        // Send Reject activity to the follower
        const baseUrl = getBaseUrl()
        const followActivity: FollowActivity = {
            '@context': ['https://www.w3.org/ns/activitystreams'],
            id: `${follower.actorUrl}/follows/${Date.now()}`,
            type: 'Follow',
            actor: follower.actorUrl,
            object: `${baseUrl}/users/${follower.user.username}`,
            published: new Date().toISOString(),
        }
        const rejectActivity = buildRejectFollowActivity(follower.user, followActivity)
        const inboxUrl = follower.sharedInboxUrl || follower.inboxUrl
        await deliverToInbox(rejectActivity, inboxUrl, follower.user)

        return c.json({ success: true, message: 'Follower rejected' })
    } catch (error) {
        console.error('Error rejecting follower:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

export default app
