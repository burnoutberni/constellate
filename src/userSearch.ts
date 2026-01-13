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
	cacheRemoteUserByUrl,
	getBaseUrl,
	cacheEventFromOutboxActivity,
	fetchRemoteCollectionCount,
	fetchRemoteCollectionItems,
} from './lib/activitypubHelpers.js'
import { isUrlSafe, safeFetch } from './lib/ssrfProtection.js'
import { ContentType } from './constants/activitypub.js'
import { trackInstance } from './lib/instanceHelpers.js'
import type { Actor } from './lib/activitypubSchemas.js'
import { prisma } from './lib/prisma.js'
import { canViewPrivateProfile } from './lib/privacy.js'
import { lenientRateLimit } from './middleware/rateLimit.js'
import { requireAuth } from './middleware/auth.js'
import { SuggestedUsersService } from './services/SuggestedUsersService.js'

const FOLLOWERS_CACHE_TTL_MINUTES = 5
const PROFILE_CACHE_TTL_MINUTES = 60

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
		const remoteUser = await cacheRemoteUser(actor as Actor)

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
				followersListCached: true,
				followersListSync: true,
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
			return c.json({ followers: [], isRemote: true, remoteNote: null })
		}

		// For remote users, fetch followers from the remote instance
		if (isRemote && user.externalActorUrl) {
			// Check if we have cached followers list
			const cacheExpiry = new Date(Date.now() - FOLLOWERS_CACHE_TTL_MINUTES * 60 * 1000)
			const hasFreshCache =
				user.followersListSync &&
				user.followersListSync > cacheExpiry &&
				user.followersListCached

			if (hasFreshCache) {
				console.log(`[followers] Using cached followers list for ${user.username}`)
				// Check if current user has a pending request to this remote user
				// and add them to the list if so (even if not in remote's accepted followers)
				const cachedFollowers = user.followersListCached as Array<{
					id: string
					username: string
					name: string | null
					profileImage: string | null
					displayColor: string | null
					isRemote: boolean
					isFollowing: boolean
					isPending: boolean
				}> | null

				if (currentUserId && cachedFollowers) {
					const pendingRequest = await prisma.following.findUnique({
						where: {
							userId_actorUrl: {
								userId: currentUserId,
								actorUrl: user.externalActorUrl!,
							},
						},
					})

					if (pendingRequest && !pendingRequest.accepted) {
						// Check if current user is already in the list
						const currentUserInList = cachedFollowers.some(
							(f) => f.id === currentUserId || f.username === currentUserId
						)
						if (!currentUserInList) {
							// Fetch current user data and add as pending
							const currentUser = await prisma.user.findUnique({
								where: { id: currentUserId },
								select: {
									id: true,
									username: true,
									name: true,
									profileImage: true,
									displayColor: true,
								},
							})
							if (currentUser) {
								cachedFollowers.unshift({
									...currentUser,
									isPending: true,
									isFollowing: true,
									isRemote: false,
								})
							}
						}
					}
				}

				return c.json({
					followers: cachedFollowers,
					isRemote: true,
					remoteNote: '(cached)',
				})
			}

			// Cache is stale or missing - fetch fresh data
			console.log(
				`[followers] Cache stale/missing for ${user.username}, fetching fresh data...`
			)
			try {
				const actor = await fetchActor(user.externalActorUrl)
				if (actor) {
					const getCollectionUrl = (val: unknown) => {
						if (typeof val === 'string') return val
						if (val && typeof val === 'object' && 'id' in val)
							return (val as { id: string }).id
						return null
					}

					const followersUrl = getCollectionUrl(actor.followers)
					if (followersUrl) {
						// Fetch both items and count in parallel
						const [followerItems, followerCountResult] = await Promise.all([
							fetchRemoteCollectionItems<{
								type?: string
								id?: string
								actor?: string | { id?: string }
								object?: string | { id?: string }
							}>(followersUrl),
							fetchRemoteCollectionCount(followersUrl),
						])

						// Extract follower actor URLs from followers collection
						// ActivityPub followers collections can contain:
						// 1. Direct actor URLs (strings)
						// 2. Actor objects with 'id' property
						// 3. Follow activity objects with 'actor' property
						const followerActorUrls = followerItems
							.map((item) => {
								// Case 1: Direct actor URL string
								if (typeof item === 'string') {
									return item
								}

								// Case 2: Actor object with 'id' property
								if (item.id && typeof item.id === 'string') {
									return item.id
								}

								// Case 3: Follow activity with 'actor' property (can be string or object)
								if (item.actor) {
									if (typeof item.actor === 'string') {
										return item.actor
									}
									if (
										typeof item.actor === 'object' &&
										item.actor !== null &&
										'id' in item.actor
									) {
										return (item.actor as { id: string }).id
									}
								}

								// Case 4: object.id fallback
								if (
									item.object &&
									typeof item.object === 'object' &&
									'id' in item.object
								) {
									return (item.object as { id: string }).id
								}

								return null
							})
							.filter(
								(url): url is string => typeof url === 'string' && url.length > 0
							)

						// Process followers in parallel for better performance
						const followerPromises = followerActorUrls
							.slice(0, limit)
							.map(async (actorUrl) => {
								// Check if this is a local user - fetch directly from DB instead of caching
								const baseUrl = getBaseUrl()
								const isLocalUser = actorUrl.startsWith(baseUrl)

								let userData: {
									id: string
									username: string
									name: string | null
									profileImage: string | null
									displayColor: string | null
								} | null = null

								if (isLocalUser) {
									// Fetch local user directly from database (fresh data)
									const localUsername = actorUrl
										.split('/users/')[1]
										?.split('/')[0]
									if (localUsername) {
										userData = await prisma.user
											.findFirst({
												where: { username: localUsername, isRemote: false },
												select: {
													id: true,
													username: true,
													name: true,
													profileImage: true,
													displayColor: true,
												},
											})
											.catch(() => null)
									}
								}

								// Fetch following status in parallel
								const [followingRecord, cachedRemoteUser] = await Promise.all([
									currentUserId
										? prisma.following.findUnique({
												where: {
													userId_actorUrl: {
														userId: currentUserId,
														actorUrl,
													},
												},
											})
										: Promise.resolve(null),
									!isLocalUser
										? cacheRemoteUserByUrl(actorUrl)
										: Promise.resolve(null),
								])

								const isPending =
									followingRecord !== null && !followingRecord.accepted
								const isFollowing =
									followingRecord !== null && followingRecord.accepted

								// Use local user data if found, otherwise use cached remote user
								if (userData) {
									return {
										id: userData.id,
										username: userData.username,
										name: userData.name,
										profileImage: userData.profileImage,
										displayColor: userData.displayColor,
										isRemote: false,
										isFollowing,
										isPending,
									}
								}

								if (cachedRemoteUser) {
									return {
										id: cachedRemoteUser.id,
										username: cachedRemoteUser.username,
										name: cachedRemoteUser.name,
										profileImage: cachedRemoteUser.profileImage,
										displayColor: cachedRemoteUser.displayColor,
										isRemote: true,
										isFollowing,
										isPending,
									}
								}

								// If not cached, add a placeholder
								const usernameFromUrl = actorUrl.split('/').pop() || 'unknown'
								return {
									id: usernameFromUrl,
									username: usernameFromUrl,
									name: null,
									profileImage: null,
									displayColor: null,
									isRemote: true,
									isFollowing,
									isPending,
								}
							})

						const remoteFollowers = await Promise.all(followerPromises)

						// Check if current user has a pending request to this remote user
						// and add them to the list if so (even if not in remote's accepted followers)
						let pendingCount = 0
						if (currentUserId) {
							const pendingRequest = await prisma.following.findUnique({
								where: {
									userId_actorUrl: {
										userId: currentUserId,
										actorUrl: user.externalActorUrl!,
									},
								},
							})

							if (pendingRequest && !pendingRequest.accepted) {
								pendingCount = 1
								// Check if current user is already in the list
								const currentUserInList = remoteFollowers.some(
									(f) => f.id === currentUserId || f.username === currentUserId
								)
								if (!currentUserInList) {
									// Add current user as pending follower
									const currentUser = await prisma.user.findUnique({
										where: { id: currentUserId },
										select: {
											id: true,
											username: true,
											name: true,
											profileImage: true,
											displayColor: true,
										},
									})
									if (currentUser) {
										remoteFollowers.unshift({
											...currentUser,
											isPending: true,
											isFollowing: true,
											isRemote: false,
											// Store the remote target username for unfollow/cancel
											unfollowTarget: user.username,
										})
									}
								}
							}
						}

						const totalFollowers =
							(followerCountResult ?? remoteFollowers.length) + pendingCount
						const localPendingCount = pendingCount

						// Cache the followers list
						try {
							await prisma.user.update({
								where: { id: user.id },
								data: {
									followersListCached: remoteFollowers as any,
									followersListSync: new Date(),
								},
							})
							console.log(
								`[followers] Cached ${remoteFollowers.length} followers for ${user.username}`
							)
						} catch (cacheError) {
							console.error('[followers] Failed to cache followers list:', cacheError)
						}

						return c.json({
							followers: remoteFollowers,
							isRemote: true,
							remoteNote:
								localPendingCount > 0
									? `(${localPendingCount} local pending)`
									: null,
						})
					}
				}
			} catch (e) {
				console.error('Error fetching remote followers:', e)
				console.error('Remote user:', username, 'actorUrl:', user.externalActorUrl)
			}
			// Remote fetch failed or followersUrl not found - return empty for remote users
			return c.json({
				followers: [],
				isRemote: true,
				remoteNote: 'Unable to fetch followers from remote instance',
			})
		}

		// Local users: query local database
		const followers = await prisma.follower.findMany({
			where: {
				userId: user.id,
				accepted: true,
			},
			take: limit,
			orderBy: { createdAt: 'desc' },
		})

		// Also fetch pending followers from the Following table
		// This shows users who have requested to follow but haven't been accepted yet
		const pendingFollowing = await prisma.following.findMany({
			where: {
				userId: user.id,
				accepted: false,
			},
			take: limit,
			orderBy: { createdAt: 'desc' },
		})

		// Resolve followers to user objects
		const baseUrl = getBaseUrl()
		const currentUserActorUrl = currentUserId ? `${baseUrl}/users/${currentUserId}` : null
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
				// Check if current user has a pending request to follow this follower
				let isPending = false
				let isFollowing = false
				if (currentUserId && currentUserActorUrl) {
					const followingRecord = await prisma.following.findUnique({
						where: {
							userId_actorUrl: {
								userId: currentUserId,
								actorUrl: follower.actorUrl,
							},
						},
					})
					isPending = followingRecord !== null && !followingRecord.accepted
					isFollowing = followingRecord !== null && followingRecord.accepted
				}
				followerUsers.push({ ...followerUser, isPending, isFollowing })
			}
		}

		// Add pending followers
		for (const pending of pendingFollowing) {
			let pendingUser = null

			if (pending.actorUrl.startsWith(baseUrl)) {
				// Local user who requested to follow
				const followerUsername = pending.actorUrl.split('/').pop()
				if (followerUsername) {
					pendingUser = await prisma.user.findUnique({
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
							isRemote: false,
						},
					})
				}
			} else {
				// Remote user who requested to follow
				pendingUser = await prisma.user.findFirst({
					where: {
						externalActorUrl: pending.actorUrl,
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

			if (pendingUser) {
				followerUsers.push({ ...pendingUser, isPending: true })
			}
		}

		return c.json({ followers: followerUsers, isRemote: false, remoteNote: null })
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
export async function resolveAndCacheRemoteUser(username: string) {
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
	const cachedUser = await cacheRemoteUser(actor as Actor)

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
				profileSync: true,
				followersCount: true,
				followingCount: true,
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
		let followerCount: number | null = null
		let followingCount: number | null = null
		let eventCount: number | null = null

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

			// Count events created by this user
			eventCount = await prisma.event.count({
				where: { userId: user.id },
			})
		} else if (user.externalActorUrl) {
			// Check if cached profile is fresh
			const cacheExpiry = new Date(Date.now() - PROFILE_CACHE_TTL_MINUTES * 60 * 1000)
			const hasFreshCache = user.profileSync && user.profileSync > cacheExpiry

			if (hasFreshCache) {
				console.log(`[profile] Using cached profile for ${user.username}`)
				// Use cached counts from user record (updated when profile was synced)
				followerCount = user.followersCount
				followingCount = user.followingCount
				eventCount = user._count?.events ?? null
			} else {
				// Cache is stale - fetch fresh data from remote
				console.log(`[profile] Cache stale for ${user.username}, fetching fresh data...`)
				try {
					// Fetch the actor object to get accurate collection URLs
					const actor = await fetchActor(user.externalActorUrl)

					if (actor) {
						// Helper to get URL from string or object
						const getCollectionUrl = (val: unknown) => {
							if (typeof val === 'string') return val
							if (val && typeof val === 'object' && 'id' in val)
								return (val as { id: string }).id
							return null
						}

						const followersUrl = getCollectionUrl(actor.followers)
						const followingUrl = getCollectionUrl(actor.following)
						const outboxUrl = getCollectionUrl(actor.outbox)

						// Fire off counts fetch in parallel
						// For Outbox, we fetch the collection to get items and sync them
						const [remoteFollowers, remoteFollowing, outboxResponse] =
							await Promise.all([
								followersUrl
									? fetchRemoteCollectionCount(followersUrl)
									: Promise.resolve(null),
								followingUrl
									? fetchRemoteCollectionCount(followingUrl)
									: Promise.resolve(null),
								outboxUrl
									? safeFetch(outboxUrl, {
											headers: { Accept: ContentType.ACTIVITY_JSON },
										})
									: Promise.resolve(null),
							])

						if (remoteFollowers !== null) followerCount = remoteFollowers
						if (remoteFollowing !== null) followingCount = remoteFollowing

						// Process Outbox for events
						if (outboxResponse && outboxResponse.ok) {
							const outbox = (await outboxResponse.json()) as any
							// Only use remote count if it's > 0, otherwise fallback to local count
							// This handles cases where the remote instance returns 0 but we have cached events
							if (typeof outbox.totalItems === 'number' && outbox.totalItems > 0) {
								eventCount = outbox.totalItems
							}

							// Sync events from the first page
							let items: any[] = []
							if (outbox.first) {
								const firstPageUrl =
									typeof outbox.first === 'string'
										? outbox.first
										: outbox.first.id
								if (firstPageUrl) {
									// If first page URL is different from outbox URL (or outbox wasn't a page)
									// We need to fetch it. Often 'first' is just the URL of the first page.
									try {
										const pageResponse = await safeFetch(firstPageUrl, {
											headers: { Accept: ContentType.ACTIVITY_JSON },
										})
										if (pageResponse.ok) {
											const page = (await pageResponse.json()) as any
											items = page.orderedItems || page.items || []
										}
									} catch (e) {
										console.error('Error fetching outbox page:', e)
									}
								} else if (typeof outbox.first === 'object') {
									items = outbox.first.orderedItems || outbox.first.items || []
								}
							} else {
								// Maybe it's a CollectionPage directly?
								items = outbox.orderedItems || outbox.items || []
							}

							if (items.length > 0) {
								// Process items in parallel
								// We catch errors per item to avoid failing the whole request
								await Promise.all(
									items.map((item) =>
										cacheEventFromOutboxActivity(
											item,
											user.externalActorUrl!
										).catch((err) =>
											console.error('Error caching remote event:', err)
										)
									)
								)
							}
						}
					} else {
						// Fallback to legacy guessing if actor fetch fails
						const followersUrl = `${user.externalActorUrl}/followers`
						const followingUrl = `${user.externalActorUrl}/following`

						const [remoteFollowers, remoteFollowing] = await Promise.all([
							fetchRemoteCollectionCount(followersUrl),
							fetchRemoteCollectionCount(followingUrl),
						])

						if (remoteFollowers !== null) followerCount = remoteFollowers
						if (remoteFollowing !== null) followingCount = remoteFollowing
					}
				} catch (e) {
					console.error('Error fetching remote counts:', e)
					// Fallback to local counts (handled below)
				}
			}
		}

		// Fallback to local counts if remote fetch failed or wasn't attempted (local user)
		if (followerCount === null) {
			followerCount = await prisma.follower.count({
				where: { userId: user.id, accepted: true },
			})
		}

		if (followingCount === null) {
			followingCount = await prisma.following.count({
				where: { userId: user.id, accepted: true },
			})
		}

		// Update cached counts for remote users
		if (isRemote && user.externalActorUrl) {
			await prisma.user
				.update({
					where: { id: user.id },
					data: {
						profileSync: new Date(),
						followersCount: followerCount,
						followingCount: followingCount,
					},
				})
				.catch((e) => console.error('Failed to update profile cache:', e))
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

		// For remote users, we search by BOTH userId (if they are linked in DB)
		// AND attributedTo (fallback for events not yet linked to the user record)
		// AND organizers (if the user is listed as an organizer, e.g. a Group actor)
		const whereClause = isRemote
			? {
					OR: [
						{ userId: user.id },
						{ attributedTo: user.externalActorUrl || undefined },
						{
							organizers: {
								array_contains: [{ url: user.externalActorUrl }],
							},
						},
					],
				}
			: { userId: user.id }

		// Get user's events - filter by visibility
		// We want to show:
		// 1. Ongoing and Future events (sorted by startTime ASC)
		// 2. Past events (sorted by startTime DESC)
		const now = new Date()

		// 1. Fetch Upcoming/Ongoing
		// Note: We need to combine user filtering (whereClause) with time filtering
		// Using AND to preserve both conditions, not overwrite OR
		const upcomingWhere = {
			AND: [
				whereClause,
				{
					OR: [
						{ endTime: { gte: now } }, // Ends in future = Ongoing or Future
						{ AND: [{ endTime: null }, { startTime: { gte: now } }] }, // No end time, starts in future
					],
				},
			],
		}

		let upcomingEvents = await prisma.event.findMany({
			where: upcomingWhere,
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
			orderBy: { startTime: 'asc' }, // Soonest first
			take: 50,
		})

		// 2. Fetch Past
		const limitRemaining = 50 - upcomingEvents.length
		let pastEvents: typeof upcomingEvents = []

		if (limitRemaining > 0) {
			const pastWhere = {
				AND: [
					whereClause,
					{
						NOT: [
							{ endTime: { gte: now } },
							{ AND: [{ endTime: null }, { startTime: { gte: now } }] },
						],
					},
				],
			}

			pastEvents = await prisma.event.findMany({
				where: pastWhere,
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
				orderBy: { startTime: 'desc' }, // Most recent first
				take: limitRemaining,
			})
		}

		// Filter events by visibility - only show events the viewer can see
		upcomingEvents = await filterEventsByVisibility(upcomingEvents, currentUserId)
		pastEvents = await filterEventsByVisibility(pastEvents, currentUserId)

		let events = [...upcomingEvents, ...pastEvents]

		// If remote user has no cached events, fetch from their outbox
		// Note: This logic assumes we haven't fetched anything yet.
		// If we found 0 upcoming and 0 past, we try to fetch.
		if (isRemote && events.length === 0 && user.externalActorUrl) {
			await fetchAndCacheEventsFromOutbox(user.externalActorUrl)

			// Re-fetch events after caching using the same logic
			// 1. Upcoming
			upcomingEvents = await prisma.event.findMany({
				where: {
					attributedTo: user.externalActorUrl,
					OR: [
						{ endTime: { gte: now } },
						{ AND: [{ endTime: null }, { startTime: { gte: now } }] },
					],
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
							comments: true,
						},
					},
				},
				orderBy: { startTime: 'asc' },
				take: 50,
			})

			// 2. Past
			const limitRemainingRefetch = 50 - upcomingEvents.length
			pastEvents = []

			if (limitRemainingRefetch > 0) {
				pastEvents = await prisma.event.findMany({
					where: {
						attributedTo: user.externalActorUrl,
						NOT: [
							{ endTime: { gte: now } },
							{ AND: [{ endTime: null }, { startTime: { gte: now } }] },
						],
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
								comments: true,
							},
						},
					},
					orderBy: { startTime: 'desc' },
					take: limitRemainingRefetch,
				})
			}

			// Filter events by visibility
			upcomingEvents = await filterEventsByVisibility(upcomingEvents, currentUserId)
			pastEvents = await filterEventsByVisibility(pastEvents, currentUserId)

			events = [...upcomingEvents, ...pastEvents]
		}

		// If eventCount is null (remote fetch failed) or 0 (remote returned 0 but we have cached events),
		// use a sensible fallback
		if (eventCount === null || (eventCount === 0 && isRemote && user.externalActorUrl)) {
			// For remote users, count locally cached events as fallback
			if (isRemote && user.externalActorUrl) {
				try {
					eventCount = await prisma.event.count({ where: whereClause })
				} catch (e) {
					console.error('Error counting local events:', e)
					eventCount = events.length
				}
			} else if (eventCount === null) {
				// Local user without count - use fetched events length
				eventCount = events.length
			}
		}

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
