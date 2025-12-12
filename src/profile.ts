import { randomUUID } from 'crypto'
import { Hono } from 'hono'
import { z, ZodError } from 'zod'
import {
	buildUpdateProfileActivity,
	buildFollowActivity,
	buildUndoActivity,
	buildAcceptActivity,
	buildRejectFollowActivity,
} from './services/ActivityBuilder.js'
import { deliverToFollowers, deliverToInbox } from './services/ActivityDelivery.js'
import { getBaseUrl } from './lib/activitypubHelpers.js'
import { requireAuth } from './middleware/auth.js'
import { moderateRateLimit } from './middleware/rateLimit.js'
import { prisma } from './lib/prisma.js'
import { broadcastToUser, BroadcastEvents } from './realtime.js'
import { sanitizeText } from './lib/sanitization.js'
import type { FollowActivity } from './lib/activitypubSchemas.js'
import { AppError } from './lib/errors.js'
import { isValidTimeZone, normalizeTimeZone } from './lib/timezone.js'
import { isUrlSafe } from './lib/ssrfProtection.js'

const app = new Hono()

// Profile update schema
const ProfileUpdateSchema = z.object({
	name: z.string().min(1).max(100).optional(),
	bio: z.string().max(500).optional(),
	displayColor: z
		.string()
		.regex(/^#[0-9A-Fa-f]{6}$/)
		.optional(),
	profileImage: z
		.string()
		.url()
		.optional()
		.refine(async (val) => val === undefined || (await isUrlSafe(val)), {
			message: 'Profile image URL is not safe (SSRF protection)',
		}),
	headerImage: z
		.string()
		.url()
		.optional()
		.refine(async (val) => val === undefined || (await isUrlSafe(val)), {
			message: 'Header image URL is not safe (SSRF protection)',
		}),
	autoAcceptFollowers: z.boolean().optional(),
	timezone: z.string().optional().refine(isValidTimeZone, 'Invalid IANA timezone identifier'),
})

// Get current user's own profile (includes admin status)
// This must come BEFORE /users/:username/profile to avoid route conflicts
app.get('/users/me/profile', async (c) => {
	try {
		const userId = requireAuth(c)

		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				username: true,
				email: true,
				name: true,
				bio: true,
				displayColor: true,
				profileImage: true,
				headerImage: true,
				isRemote: true,
				externalActorUrl: true,
				isAdmin: true,
				autoAcceptFollowers: true,
				timezone: true,
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

		// Calculate actual follower/following counts
		let followerCount = 0
		let followingCount = 0

		if (!user.isRemote) {
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
		// Re-throw AppError instances so the global error handler can process them
		if (error instanceof AppError) {
			throw error
		}
		console.error('Error getting own profile:', error)
		return c.json({ error: 'Internal server error' }, 500)
	}
})

// Get current user's reminders
app.get('/users/me/reminders', async (c) => {
	try {
		const userId = requireAuth(c)

		const reminders = await prisma.eventReminder.findMany({
			where: {
				userId,
			},
			include: {
				event: {
					select: {
						id: true,
						title: true,
						startTime: true,
						endTime: true,
						timezone: true,
						headerImage: true,
						user: {
							select: {
								id: true,
								username: true,
								name: true,
								displayColor: true,
								profileImage: true,
								isRemote: true,
							},
						},
					},
				},
			},
			orderBy: {
				remindAt: 'asc',
			},
		})

		// Serialize reminders
		const serializedReminders = reminders.map((reminder) => ({
			id: reminder.id,
			eventId: reminder.eventId,
			userId: reminder.userId,
			minutesBeforeStart: reminder.minutesBeforeStart,
			status: reminder.status,
			remindAt: reminder.remindAt.toISOString(),
			createdAt: reminder.createdAt.toISOString(),
			updatedAt: reminder.updatedAt.toISOString(),
			deliveredAt: reminder.deliveredAt?.toISOString() ?? null,
			lastAttemptAt: reminder.lastAttemptAt?.toISOString() ?? null,
			failureReason: reminder.failureReason,
			event: {
				id: reminder.event.id,
				title: reminder.event.title,
				startTime: reminder.event.startTime.toISOString(),
				endTime: reminder.event.endTime?.toISOString() ?? null,
				timezone: reminder.event.timezone,
				headerImage: reminder.event.headerImage,
				user: reminder.event.user,
			},
		}))

		return c.json({ reminders: serializedReminders })
	} catch (error) {
		if (error instanceof AppError) {
			throw error
		}
		console.error('Error getting user reminders:', error)
		return c.json({ error: 'Internal server error' }, 500)
	}
})

// Get profile
app.get('/users/:username/profile', async (c) => {
	try {
		const { username } = c.req.param()
		const currentUserId = c.get('userId') // Get current user from auth middleware

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
				isAdmin: true,
				autoAcceptFollowers: true,
				timezone: true,
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

		// Only return sensitive fields if user is viewing their own profile
		const isOwnProfile = currentUserId === user.id

		return c.json({
			...user,
			isAdmin: isOwnProfile ? user.isAdmin : undefined,
			autoAcceptFollowers: isOwnProfile ? user.autoAcceptFollowers : undefined,
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
app.put('/profile', moderateRateLimit, async (c) => {
	try {
		const userId = requireAuth(c)

		const body = await c.req.json()
		const updates = await ProfileUpdateSchema.parseAsync(body)

		// Update user with sanitized input
		const user = await prisma.user.update({
			where: { id: userId },
			data: {
				...updates,
				name: updates.name ? sanitizeText(updates.name) : undefined,
				bio: updates.bio ? sanitizeText(updates.bio) : undefined,
				timezone:
					updates.timezone !== undefined
						? normalizeTimeZone(updates.timezone)
						: undefined,
			},
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
app.post('/users/:username/follow', moderateRateLimit, async (c) => {
	try {
		const { username } = c.req.param()
		const userId = requireAuth(c)

		const currentUser = await requireLocalUser(userId)
		if (!currentUser) return c.json({ error: 'User not found' }, 404)

		const targetUser = await findTargetUser(username)
		if (!targetUser) return c.json({ error: 'User not found' }, 404)

		if (targetUser.id === userId) {
			return c.json({ error: 'Cannot follow yourself' }, 400)
		}

		const baseUrl = getBaseUrl()
		const targetActorUrl = getTargetActorUrl(targetUser, baseUrl)

		const isAlreadyFollowing = await checkFollowingStatus(userId, targetActorUrl)
		if (isAlreadyFollowing) {
			return c.json({ error: 'Already following' }, 400)
		}

		const followActivity = buildFollowActivity(currentUser, targetActorUrl)

		if (!targetUser.isRemote) {
			await handleLocalFollow(currentUser, targetUser, baseUrl, targetActorUrl)
		} else {
			await handleRemoteFollow(currentUser, targetUser, targetActorUrl, followActivity)
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

async function requireLocalUser(userId: string) {
	return prisma.user.findUnique({
		where: { id: userId, isRemote: false },
	})
}

async function findTargetUser(username: string) {
	const isRemote = username.includes('@')
	const targetUser = await prisma.user.findFirst({
		where: { username, isRemote },
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
			inboxUrl: true,
			sharedInboxUrl: true,
			...(isRemote ? {} : { autoAcceptFollowers: true }),
		},
	})

	return targetUser
}

function getTargetActorUrl(
	targetUser: { isRemote: boolean; externalActorUrl: string | null; username: string },
	baseUrl: string
) {
	return targetUser.isRemote
		? targetUser.externalActorUrl!
		: `${baseUrl}/users/${targetUser.username}`
}

async function checkFollowingStatus(userId: string, targetActorUrl: string): Promise<boolean> {
	const existing = await prisma.following.findUnique({
		where: {
			userId_actorUrl: {
				userId,
				actorUrl: targetActorUrl,
			},
		},
	})

	if (existing?.accepted) {
		return true
	}

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

	return false
}

async function handleLocalFollow(
	currentUser: {
		id: string
		username: string
		profileImage: string | null
		privateKey: string | null
	},
	targetUser: {
		id: string
		username: string
		profileImage: string | null
		sharedInboxUrl: string | null
		inboxUrl: string | null
		autoAcceptFollowers?: boolean
	},
	baseUrl: string,
	targetActorUrl: string
) {
	const currentUserActorUrl = `${baseUrl}/users/${currentUser.username}`
	const shouldAutoAccept = targetUser.autoAcceptFollowers ?? true

	await prisma.follower.upsert({
		where: {
			userId_actorUrl: {
				userId: targetUser.id,
				actorUrl: currentUserActorUrl,
			},
		},
		update: { accepted: shouldAutoAccept },
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

	await prisma.following.create({
		data: {
			userId: currentUser.id,
			actorUrl: targetActorUrl,
			username: targetUser.username,
			inboxUrl: targetUser.inboxUrl || '',
			sharedInboxUrl: targetUser.sharedInboxUrl,
			iconUrl: targetUser.profileImage,
			accepted: shouldAutoAccept,
		},
	})
}

async function handleRemoteFollow(
	currentUser: {
		id: string
		username: string
		profileImage: string | null
		privateKey: string | null
	},
	targetUser: {
		username: string
		profileImage: string | null
		inboxUrl: string | null
		sharedInboxUrl: string | null
	},
	targetActorUrl: string,
	followActivity: FollowActivity
) {
	await prisma.following.create({
		data: {
			userId: currentUser.id,
			actorUrl: targetActorUrl,
			username: targetUser.username,
			inboxUrl: targetUser.inboxUrl || '',
			sharedInboxUrl: targetUser.sharedInboxUrl,
			iconUrl: targetUser.profileImage,
			accepted: false,
		},
	})

	const inboxUrl = targetUser.sharedInboxUrl || targetUser.inboxUrl
	if (inboxUrl) {
		await deliverToInbox(followActivity, inboxUrl, {
			id: currentUser.id,
			username: currentUser.username,
			privateKey: currentUser.privateKey,
		})
	}

	await broadcastToUser(currentUser.id, {
		type: BroadcastEvents.FOLLOW_PENDING,
		data: {
			username: targetUser.username,
			actorUrl: targetActorUrl,
			isAccepted: false,
		},
	})
}

// Unfollow user
app.delete('/users/:username/follow', moderateRateLimit, async (c) => {
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
app.post('/followers/:followerId/accept', moderateRateLimit, async (c) => {
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
			id: `${follower.actorUrl}/follows/${randomUUID()}`,
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
app.post('/followers/:followerId/reject', moderateRateLimit, async (c) => {
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
			id: `${follower.actorUrl}/follows/${randomUUID()}`,
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
