/**
 * User and Event Search with Remote Account Resolution
 * Handles searching for local content and resolving remote accounts
 */

import { Hono } from 'hono'
import { z, ZodError } from 'zod'
import { resolveWebFinger } from './lib/webfinger.js'
import {
	fetchActor,
	cacheRemoteUser,
	getBaseUrl,
	cacheEventFromOutboxActivity,
} from './lib/activitypubHelpers.js'
import { trackInstance } from './lib/instanceHelpers.js'
import type { Person } from './lib/activitypubSchemas.js'
import { prisma } from './lib/prisma.js'
import { canViewPrivateProfile } from './lib/privacy.js'
import { lenientRateLimit } from './middleware/rateLimit.js'
import { requireAuth } from './middleware/auth.js'
import { SuggestedUsersService } from './services/SuggestedUsersService.js'

const app = new Hono()

// Apply rate limiting to prevent abuse
app.use('*', lenientRateLimit)

// Search validation schema
const SearchQuerySchema = z.object({
	q: z.string().min(1).max(200), // Add length limit
	limit: z.string().optional(),
})

// Resolve account schema - removed as unused

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
		const urlResult = parseUrlHandle(input)
		if (urlResult) return urlResult

		const domainPathResult = parseDomainPathHandle(input)
		if (domainPathResult) return domainPathResult

		const normalized = normalizeHandleInput(input)
		return parseSimpleHandle(normalized)
	} catch (error) {
		console.error('Error parsing handle:', error)
		return null
	}
}

function parseUrlHandle(input: string) {
	if (!input.startsWith('http://') && !input.startsWith('https://')) return null

	const url = new URL(input)
	const pathParts = url.pathname.split('/').filter(Boolean)

	const userIndex = pathParts.indexOf('users')
	if (userIndex !== -1 && pathParts[userIndex + 1]) {
		return { username: pathParts[userIndex + 1], domain: url.hostname }
	}

	if (pathParts[0]?.startsWith('@')) {
		return { username: pathParts[0].slice(1), domain: url.hostname }
	}

	if (pathParts.length > 0) {
		return { username: pathParts[pathParts.length - 1], domain: url.hostname }
	}

	return null
}

function parseDomainPathHandle(input: string) {
	if (!input.includes('/') || !input.includes('@')) return null

	const slashIndex = input.indexOf('/')
	const domain = input.substring(0, slashIndex)
	const pathPart = input.substring(slashIndex + 1)

	if (pathPart.startsWith('@')) {
		return { username: pathPart.slice(1), domain }
	}

	return null
}

function normalizeHandleInput(input: string) {
	return input.startsWith('@') ? input.slice(1) : input
}

function parseSimpleHandle(normalized: string) {
	const parts = normalized.split('@')
	if (parts.length === 2 && parts[0] && parts[1]) {
		return { username: parts[0], domain: parts[1] }
	}
	return null
}

/**
 * Check if a handle is for a local user
 */
function isLocalHandle(domain: string): boolean {
	const baseUrl = getBaseUrl()
	const localDomain = new URL(baseUrl).hostname
	return domain === localDomain
}

type SearchUserResult = {
	id: string
	username: string
	name: string | null
	profileImage: string | null
	displayColor: string
	isRemote: boolean
	externalActorUrl: string | null
}

type RemoteAccountSuggestion = {
	handle: string
	username: string
	domain: string
} | null

function parseSearchParams(c: { req: { query: (key: string) => string | undefined | null } }) {
	const params = SearchQuerySchema.parse({
		q: c.req.query('q'),
		limit: c.req.query('limit'),
	})

	const query = params.q
	const limit = Math.min(parseInt(params.limit || '10'), 50)
	return { query, limit }
}

async function searchLocalUsers(query: string, limit: number): Promise<SearchUserResult[]> {
	return prisma.user.findMany({
		where: {
			OR: [{ username: { contains: query } }, { name: { contains: query } }],
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
}

async function searchLocalEvents(query: string, limit: number) {
	return prisma.event.findMany({
		where: {
			OR: [{ title: { contains: query } }, { summary: { contains: query } }],
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
}

async function handleRemoteSuggestion(
	query: string,
	users: SearchUserResult[]
): Promise<{ users: SearchUserResult[]; remoteAccountSuggestion: RemoteAccountSuggestion }> {
	const parsedHandle = parseHandle(query)

	if (!parsedHandle || isLocalHandle(parsedHandle.domain)) {
		return { users, remoteAccountSuggestion: null }
	}

	const cachedRemoteUser = await findCachedRemoteUser(parsedHandle)
	if (cachedRemoteUser) {
		const alreadyPresent = users.some((user) => user.id === cachedRemoteUser.id)
		return {
			users: alreadyPresent ? users : [cachedRemoteUser, ...users],
			remoteAccountSuggestion: null,
		}
	}

	return {
		users,
		remoteAccountSuggestion: {
			handle: `@${parsedHandle.username}@${parsedHandle.domain}`,
			username: parsedHandle.username,
			domain: parsedHandle.domain,
		},
	}
}

async function findCachedRemoteUser(parsedHandle: { username: string; domain: string }) {
	return prisma.user.findFirst({
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
}

app.get('/suggestions', async (c) => {
	try {
		const userId = requireAuth(c)
		const limitParam = c.req.query('limit')
		const limit = limitParam ? parseInt(limitParam) : 5

		const suggestions = await SuggestedUsersService.getSuggestions(userId, limit)

		return c.json(suggestions)
	} catch (error) {
		console.error('Error getting user suggestions:', error)
		return c.json({ error: 'Internal server error' }, 500)
	}
})

/**
 * Search for users and events
 * GET /api/user-search?q=query&limit=10
 */
app.get('/', async (c) => {
	try {
		const { query, limit } = parseSearchParams(c)
		const users = await searchLocalUsers(query, limit)
		const events = await searchLocalEvents(query, limit)
		const { users: finalUsers, remoteAccountSuggestion } = await handleRemoteSuggestion(
			query,
			users
		)

		return c.json({
			users: finalUsers,
			events,
			remoteAccountSuggestion,
		})
	} catch (error) {
		if (error instanceof ZodError) {
			return c.json(
				{ error: 'Invalid search parameters', details: error.issues },
				400 as const
			)
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
		const body: unknown = await c.req.json()
		if (!body || typeof body !== 'object') {
			return c.json({ error: 'Invalid request body' }, 400)
		}
		const { handle } = body as { handle?: string }

		if (!handle || typeof handle !== 'string' || handle.trim().length === 0) {
			return c.json({ error: 'Invalid handle format' }, 400)
		}

		const parsedHandle = parseHandle(handle)

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
			if (cachedUser.externalActorUrl) {
				void trackInstance(cachedUser.externalActorUrl)
			}
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
		const currentUserId = c.get('userId') as string | undefined
		const limit = parseInt(c.req.query('limit') || '50')

		// Check if it's a remote user (contains @domain)
		const isRemote = username.includes('@')

		const user = await prisma.user.findFirst({
			where: {
				username,
				isRemote,
			},
			select: {
				id: true,
				username: true,
				isRemote: true,
				externalActorUrl: true,
				isPublicProfile: true,
			},
		})

		if (!user) {
			return c.json({ error: 'User not found' }, 404)
		}

		// Check privacy
		const isOwnProfile = currentUserId === user.id
		const canView =
			isOwnProfile ||
			(await canViewPrivateProfile({
				viewerId: currentUserId,
				profileUserId: user.id,
				profileIsRemote: user.isRemote,
				profileExternalActorUrl: user.externalActorUrl,
				profileUsername: user.username,
				profileIsPublic: user.isPublicProfile,
			}))

		if (!canView) {
			return c.json({ followers: [] })
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
		const currentUserId = c.get('userId') as string | undefined
		const limit = parseInt(c.req.query('limit') || '50')

		// Check if it's a remote user (contains @domain)
		const isRemote = username.includes('@')

		const user = await prisma.user.findFirst({
			where: {
				username,
				isRemote,
			},
			select: {
				id: true,
				username: true,
				isRemote: true,
				externalActorUrl: true,
				isPublicProfile: true,
			},
		})

		if (!user) {
			return c.json({ error: 'User not found' }, 404)
		}

		// Check privacy
		const isOwnProfile = currentUserId === user.id
		const canView =
			isOwnProfile ||
			(await canViewPrivateProfile({
				viewerId: currentUserId,
				profileUserId: user.id,
				profileIsRemote: user.isRemote,
				profileExternalActorUrl: user.externalActorUrl,
				profileUsername: user.username,
				profileIsPublic: user.isPublicProfile,
			}))

		if (!canView) {
			return c.json({ following: [] })
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

// Helper function to resolve and cache remote user
async function resolveAndCacheRemoteUser(username: string) {
	const parsedHandle = parseHandle(username)

	if (!parsedHandle || isLocalHandle(parsedHandle.domain)) {
		return null
	}

	console.log(`🔍 Attempting to resolve remote user: ${username}`)

	// Resolve via WebFinger
	const resource = `acct:${parsedHandle.username}@${parsedHandle.domain}`
	const actorUrl = await resolveWebFinger(resource)

	if (!actorUrl) return null

	// Fetch actor
	const actor = await fetchActor(actorUrl)
	if (!actor) return null

	// Cache remote user
	const cachedUser = await cacheRemoteUser(actor as unknown as Person)

	// Re-fetch the user with all fields
	const refetchedUser = await prisma.user.findFirst({
		where: { id: cachedUser.id },
		select: {
			id: true,
			username: true,
			name: true,
			bio: true,
			profileImage: true,
			headerImage: true,
			displayColor: true,
			timezone: true,
			isRemote: true,
			externalActorUrl: true,
			isPublicProfile: true,
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
		console.log(`✅ Resolved and cached remote user: ${username}`)
		return refetchedUser
	}

	return null
}

// Helper function to extract location value from event location
// extractLocationValue and cacheEventFromOutboxActivity moved to lib/activitypubHelpers.ts

// Helper function to fetch and cache events from remote user outbox
async function fetchAndCacheEventsFromOutbox(userExternalActorUrl: string) {
	try {
		const outboxUrl = `${userExternalActorUrl}/outbox?page=1`
		const response = await fetch(outboxUrl, {
			headers: {
				Accept: 'application/activity+json',
			},
		})

		if (!response || !response.ok) return

		const outbox = (await response.json()) as { orderedItems?: unknown[] } | undefined
		const activities = outbox?.orderedItems || []

		// Cache events from outbox
		for (const activity of activities) {
			const activityObj = activity as Record<string, unknown>
			await cacheEventFromOutboxActivity(activityObj, userExternalActorUrl)
		}
	} catch (error) {
		console.error('Error fetching events from outbox:', error)
	}
}

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

app.get('/profile/:username', async (c) => {
	try {
		// Decode username in case it's URL encoded (e.g., alice%40app1.local -> alice@app1.local)
		const username = decodeURIComponent(c.req.param('username'))
		const currentUserId = c.get('userId') as string | undefined

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
				timezone: true,
				isRemote: true,
				externalActorUrl: true,
				isPublicProfile: true,
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
			const resolvedUser = await resolveAndCacheRemoteUser(username)
			if (resolvedUser) {
				user = resolvedUser
			}
		}

		if (!user) {
			return c.json({ error: 'User not found' }, 404)
		}

		// Track instance if remote
		if (user && user.isRemote && user.externalActorUrl) {
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

		// Get user's events - filter by visibility
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

		// Filter events by visibility - only show events the viewer can see
		events = await filterEventsByVisibility(events, currentUserId)

		// If remote user has no cached events, fetch from their outbox
		if (isRemote && events.length === 0 && user.externalActorUrl) {
			await fetchAndCacheEventsFromOutbox(user.externalActorUrl)

			// Re-fetch events after caching
			let fetchedEvents = await prisma.event.findMany({
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

			// Filter events by visibility
			fetchedEvents = await filterEventsByVisibility(fetchedEvents, currentUserId)

			events = fetchedEvents
		}

		// Manually count events for proper display
		const eventCount = isRemote
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
		console.error('Error getting user profile:', error)
		return c.json({ error: 'Internal server error' }, 500)
	}
})

export default app
