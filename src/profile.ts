import { Hono } from 'hono'
import { randomUUID } from 'crypto'
import { prisma } from './lib/prisma.js'
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
import { trackInstance } from './lib/instanceHelpers.js'
import { requireAuth } from './middleware/auth.js'
import { config } from './config.js'
import { moderateRateLimit } from './middleware/rateLimit.js'
import { canViewPrivateProfile } from './lib/privacy.js'
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
		.regex(/^#[0-9a-fA-F]{6}$/, { message: 'Invalid hex color' })
		.optional(),
	profileImage: z
		.url()
		.optional()
		.refine(async (val) => val === undefined || (await isUrlSafe(val)), {
			message: 'Profile image URL is not safe (SSRF protection)',
		}),
	headerImage: z
		.url()
		.optional()
		.refine(async (val) => val === undefined || (await isUrlSafe(val)), {
			message: 'Header image URL is not safe (SSRF protection)',
		}),
	autoAcceptFollowers: z.boolean().optional(),
	isPublicProfile: z.boolean().optional(),
	timezone: z.string().optional().refine(isValidTimeZone, 'Invalid IANA timezone identifier'),
	// Add other profile fields as needed
	url: z.url().optional(),
	theme: z.enum(['LIGHT', 'DARK']).nullable().optional(),
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
				isPublicProfile: true,
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

// Request user data export (GDPR) - creates an async job
app.post('/users/me/export', async (c) => {
	try {
		const userId = requireAuth(c)

		// Check if user already has a pending or processing export
		const existingExport = await prisma.dataExport.findFirst({
			where: {
				userId,
				status: {
					in: ['PENDING', 'PROCESSING'],
				},
			},
			orderBy: { createdAt: 'desc' },
		})

		if (existingExport) {
			return c.json(
				{
					exportId: existingExport.id,
					status: existingExport.status,
					message: 'Export already in progress',
					createdAt: existingExport.createdAt.toISOString(),
				},
				200
			)
		}

		// Create a new export job
		const dataExport = await prisma.dataExport.create({
			data: {
				userId,
				status: 'PENDING',
			},
		})

		return c.json(
			{
				exportId: dataExport.id,
				status: dataExport.status,
				message: 'Export job created. You will be notified when it is ready.',
				createdAt: dataExport.createdAt.toISOString(),
			},
			202
		)
	} catch (error) {
		if (error instanceof AppError) {
			throw error
		}
		console.error('Error creating export job:', error)
		return c.json({ error: 'Internal server error' }, 500)
	}
})

// Get export status and download
app.get('/users/me/export/:exportId', async (c) => {
	try {
		const userId = requireAuth(c)
		const { exportId } = c.req.param()

		const dataExport = await prisma.dataExport.findUnique({
			where: { id: exportId },
		})

		if (!dataExport) {
			return c.json({ error: 'Export not found' }, 404)
		}

		// Verify the export belongs to the requesting user
		if (dataExport.userId !== userId) {
			return c.json({ error: 'Unauthorized' }, 403)
		}

		// Check if export has expired
		if (dataExport.expiresAt && dataExport.expiresAt < new Date()) {
			return c.json({ error: 'Export has expired' }, 410)
		}

		// Return status if not completed
		if (dataExport.status !== 'COMPLETED') {
			return c.json({
				exportId: dataExport.id,
				status: dataExport.status,
				createdAt: dataExport.createdAt?.toISOString() || null,
				updatedAt: dataExport.updatedAt?.toISOString() || null,
				errorMessage: dataExport.errorMessage,
			})
		}

		// Return the export data
		if (!dataExport.data) {
			return c.json({ error: 'Export data not available' }, 500)
		}

		return c.json(dataExport.data)
	} catch (error) {
		if (error instanceof AppError) {
			throw error
		}
		console.error('Error getting export:', error)
		return c.json({ error: 'Internal server error' }, 500)
	}
})

// Helper function to filter events by visibility
async function filterEventsByVisibility<
	T extends Awaited<ReturnType<typeof prisma.event.findMany>>,
>(events: T, currentUserId: string | undefined): Promise<T> {
	const { canUserViewEvent } = await import('./lib/eventVisibility.js')
	const filtered = await Promise.all(
		events.map(async (event) => {
			const canView = await canUserViewEvent(event, currentUserId)
			return canView ? event : null
		})
	)
	return filtered.filter((event): event is T[number] => event !== null) as T
}

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
				isPublicProfile: true,
				timezone: true,
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

		if (user.isRemote && user.externalActorUrl) {
			void trackInstance(user.externalActorUrl)
		}

		// Check if profile is private and viewer doesn't have access
		const isOwnProfile = currentUserId === user.id
		const canViewFullProfile =
			isOwnProfile ||
			(await canViewPrivateProfile({
				viewerId: currentUserId,
				profileUserId: user.id,
				profileIsRemote: user.isRemote,
				profileExternalActorUrl: user.externalActorUrl,
				profileUsername: user.username,
				profileIsPublic: user.isPublicProfile,
			}))

		// If private profile and viewer can't see it, return minimal data with consistent structure
		if (!user.isPublicProfile && !canViewFullProfile) {
			return c.json({
				user: {
					id: user.id,
					username: user.username,
					name: user.name,
					profileImage: user.profileImage,
					isRemote: user.isRemote,
					isPublicProfile: false,
					createdAt: user.createdAt.toISOString(),
					displayColor: user.displayColor || '#3b82f6',
					bio: null,
					headerImage: null,
					_count: {
						events: 0,
						followers: 0,
						following: 0,
					},
				},
				events: [],
			})
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

		// Override _count with actual counts
		const userWithCounts = {
			...user,
			isAdmin: isOwnProfile ? user.isAdmin : undefined,
			autoAcceptFollowers: isOwnProfile ? user.autoAcceptFollowers : undefined,
			_count: {
				events: user._count?.events || 0,
				followers: followerCount,
				following: followingCount,
			},
		}

		// Get user's events - filter by visibility
		let events = await prisma.event.findMany({
			where: user.isRemote
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

		// Filter events by visibility - only show events the viewer can see
		events = await filterEventsByVisibility(events, currentUserId)

		// Manually count events for proper display
		const eventCount = user.isRemote
			? await prisma.event.count({
					where: { attributedTo: user.externalActorUrl || undefined },
				})
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
		console.error('Error getting profile:', error)
		return c.json({ error: 'Internal server error' }, 500)
	}
})

// Update profile
app.put('/profile', moderateRateLimit, async (c) => {
	try {
		const userId = requireAuth(c)

		const body: unknown = await c.req.json()
		const updates = await ProfileUpdateSchema.parseAsync(body)

		const updatedUser = await prisma.user.update({
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
		const activity = buildUpdateProfileActivity(updatedUser)
		await deliverToFollowers(activity, userId)

		return c.json(updatedUser)
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

// Get current ToS version (public endpoint)
app.get('/tos/version', async (c) => {
	return c.json({ version: config.tosVersion })
})

// Get user's ToS acceptance status
app.get('/tos/status', async (c) => {
	try {
		const userId = requireAuth(c)

		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { tosAcceptedAt: true, tosVersion: true },
		})

		if (!user) {
			return c.json({ error: 'User not found' }, 404)
		}

		const isAccepted = !!user.tosAcceptedAt
		const isCurrentVersion = user.tosVersion === config.tosVersion

		return c.json({
			accepted: isAccepted,
			acceptedAt: user.tosAcceptedAt,
			acceptedVersion: user.tosVersion,
			currentVersion: config.tosVersion,
			needsAcceptance: !isAccepted || !isCurrentVersion,
		})
	} catch (error) {
		if (error instanceof AppError) {
			throw error
		}
		console.error('Error getting ToS status:', error)
		return c.json({ error: 'Internal server error' }, 500)
	}
})

// Accept ToS
app.post('/tos/accept', moderateRateLimit, async (c) => {
	try {
		const userId = requireAuth(c)

		await prisma.user.update({
			where: { id: userId },
			data: {
				tosAcceptedAt: new Date(),
				tosVersion: config.tosVersion,
			},
		})

		return c.json({
			success: true,
			message: 'Terms of Service accepted',
			version: config.tosVersion,
		})
	} catch (error) {
		if (error instanceof AppError) {
			throw error
		}
		console.error('Error accepting ToS:', error)
		return c.json({ error: 'Internal server error' }, 500)
	}
})

export default app
