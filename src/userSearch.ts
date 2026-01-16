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
	getCollectionUrl,
	cacheEventFromOutboxActivity,
	fetchRemoteCollectionCount,
	fetchRemoteCollectionItems,
} from './lib/activitypubHelpers.js'
import { buildEventsWhereClause } from './lib/eventQueries.js'
import { safeFetch } from './lib/ssrfProtection.js'
import { ContentType } from './constants/activitypub.js'
import { trackInstance } from './lib/instanceHelpers.js'
import type { Actor } from './lib/activitypubSchemas.js'
import { prisma } from './lib/prisma.js'
import { canViewPrivateProfile } from './lib/privacy.js'
import { lenientRateLimit } from './middleware/rateLimit.js'
import { requireAuth } from './middleware/auth.js'
import { SuggestedUsersService } from './services/SuggestedUsersService.js'
import { logger } from './lib/logger.js'

const FOLLOWERS_CACHE_TTL_MINUTES = 5

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
		logger.error('Error parsing handle:', error)
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
		logger.error('Error getting user suggestions:', error)
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
		logger.error('Error searching:', error)
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
		logger.error('Error resolving account:', error)
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
/**
 * Get followers list
 * GET /api/user-search/profile/:username/followers
 */
app.get('/profile/:username/followers', async (c) => {
	try {
		const username = decodeURIComponent(c.req.param('username'))
		const currentUserId = c.get('userId') as string | undefined
		const limit = parseInt(c.req.query('limit') || '50')

		const user = await fetchUserForFollowers(username)
		if (!user) {
			return c.json({ error: 'User not found' }, 404)
		}

		const canView = await canViewFollowers(currentUserId, user)
		if (!canView) {
			return c.json({ followers: [], isRemote: true, remoteNote: null })
		}

		if (user.isRemote && user.externalActorUrl) {
			const cachedResult = await getCachedFollowers(user, currentUserId)
			if (cachedResult) {
				return c.json(cachedResult)
			}

			const remoteResult = await fetchAndProcessRemoteFollowers(user, currentUserId, limit)
			if (remoteResult) {
				return c.json(remoteResult)
			}

			return c.json({
				followers: [],
				isRemote: true,
				remoteNote: 'Unable to fetch followers from remote instance',
			})
		}

		const followers = await getLocalFollowers(user.id, limit)
		return c.json({ followers, isRemote: false, remoteNote: null })
	} catch (error) {
		logger.error('Error getting followers:', error)
		return c.json({ error: 'Internal server error' }, 500)
	}
})

type FollowerUser = {
	id: string
	username: string
	name: string | null
	profileImage: string | null
	displayColor: string | null
	isRemote: boolean
	isFollowing: boolean
	isPending: boolean
}

async function fetchUserForFollowers(username: string) {
	const isRemote = username.includes('@')
	return prisma.user.findFirst({
		where: { username, isRemote },
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
}

async function canViewFollowers(
	currentUserId: string | undefined,
	user: Awaited<ReturnType<typeof fetchUserForFollowers>>
) {
	if (!user) return false
	const isOwnProfile = currentUserId === user.id
	return (
		isOwnProfile ||
		canViewPrivateProfile({
			viewerId: currentUserId,
			profileUserId: user.id,
			profileIsRemote: user.isRemote,
			profileExternalActorUrl: user.externalActorUrl,
			profileUsername: user.username,
			profileIsPublic: user.isPublicProfile,
		})
	)
}

async function getCachedFollowers(
	user: NonNullable<Awaited<ReturnType<typeof fetchUserForFollowers>>>,
	currentUserId: string | undefined
) {
	const cacheExpiry = new Date(Date.now() - FOLLOWERS_CACHE_TTL_MINUTES * 60 * 1000)
	const hasFreshCache =
		user.followersListSync && user.followersListSync > cacheExpiry && user.followersListCached

	if (!hasFreshCache) return null

	logger.debug(`[followers] Using cached followers list for ${user.username}`)

	const cachedFollowers = user.followersListCached as FollowerUser[] | null

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
			const currentUserInList = cachedFollowers.some(
				(f) => f.id === currentUserId || f.username === currentUserId
			)
			if (!currentUserInList) {
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

	return {
		followers: cachedFollowers,
		isRemote: true,
		remoteNote: '(cached)',
	}
}

async function fetchAndProcessRemoteFollowers(
	user: NonNullable<Awaited<ReturnType<typeof fetchUserForFollowers>>>,
	currentUserId: string | undefined,
	limit: number
) {
	logger.debug(`[followers] Cache stale/missing for ${user.username}, fetching fresh data...`)

	if (!user.externalActorUrl) return null

	try {
		const actor = await fetchActor(user.externalActorUrl)
		if (!actor) return null

		const followersUrl = getCollectionUrl(actor.followers)
		if (!followersUrl) return null

		const [followerItems] = await Promise.all([
			fetchRemoteCollectionItems<{
				type?: string
				id?: string
				actor?: string | { id?: string }
				object?: string | { id?: string }
			}>(followersUrl, limit),
			fetchRemoteCollectionCount(followersUrl),
		])

		const followerActorUrls = extractFollowerActorUrls(followerItems)
		const remoteFollowers = await processFollowerUrls(followerActorUrls, currentUserId, limit)

		const result = await addPendingFollowerToRemote(user, currentUserId, remoteFollowers)
		return result
	} catch (e) {
		logger.error('Error fetching remote followers:', e)
		logger.error('Remote user:', { username: user.username, actorUrl: user.externalActorUrl })
		return null
	}
}

function extractFollowerActorUrls(
	followerItems: Array<{
		type?: string
		id?: string
		actor?: string | { id?: string }
		object?: string | { id?: string }
	}>
): string[] {
	return followerItems
		.map((item) => {
			if (typeof item === 'string') return item
			if (item.id && typeof item.id === 'string') return item.id
			if (item.actor) {
				if (typeof item.actor === 'string') return item.actor
				if (typeof item.actor === 'object' && 'id' in item.actor)
					return (item.actor as { id: string }).id
			}
			if (item.object && typeof item.object === 'object' && 'id' in item.object) {
				return (item.object as { id: string }).id
			}
			return null
		})
		.filter((url): url is string => typeof url === 'string' && url.length > 0)
}

async function processFollowerUrls(
	actorUrls: string[],
	currentUserId: string | undefined,
	limit: number
): Promise<FollowerUser[]> {
	const baseUrl = getBaseUrl()
	const validUrls = actorUrls.slice(0, limit)

	const isLocalUser = (url: string) => url.startsWith(baseUrl) && url.includes('/users/')
	const usersRegex = /\/?users\/([^/]+)/

	const localUrls = validUrls.filter(isLocalUser)
	const remoteUrls = validUrls.filter((url) => !isLocalUser(url))

	const localUsernames = localUrls
		.map((url) => {
			const match = usersRegex.exec(url)
			return match?.[1] || null
		})
		.filter((u): u is string => u !== null)

	const [localUsers, cachedRemoteUsers, followingRecords] = await Promise.all([
		localUsernames.length > 0
			? prisma.user.findMany({
					where: { username: { in: localUsernames }, isRemote: false },
					select: {
						id: true,
						username: true,
						name: true,
						profileImage: true,
						displayColor: true,
					},
				})
			: Promise.resolve([]),
		remoteUrls.length > 0 ? batchFetchRemoteUsers(remoteUrls) : Promise.resolve([]),
		currentUserId && validUrls.length > 0
			? prisma.following.findMany({
					where: {
						userId: currentUserId,
						actorUrl: { in: validUrls },
					},
				})
			: Promise.resolve([]),
	])

	const localUserMap = new Map(localUsers.map((u) => [u.username, u]))
	type RemoteUserData = {
		id: string
		username: string
		name: string | null
		profileImage: string | null
		displayColor: string | null
		externalActorUrl: string | null
	}
	const remoteUserMap = new Map(
		(cachedRemoteUsers as RemoteUserData[])
			.filter(
				(u): u is RemoteUserData & { externalActorUrl: string } =>
					u.externalActorUrl !== null
			)
			.map((u) => [u.externalActorUrl, u])
	)
	const followingMap = new Map(followingRecords.map((f) => [f.actorUrl, f]))

	const results = await Promise.all(
		validUrls.map(async (actorUrl) => {
			const isLocal = isLocalUser(actorUrl)
			let userData: (typeof localUsers)[number] | RemoteUserData | null = null

			if (isLocal) {
				const match = usersRegex.exec(actorUrl)
				const username = match?.[1] || null
				if (username) {
					userData = localUserMap.get(username) || null
				}
			} else {
				userData = remoteUserMap.get(actorUrl) || null
			}

			const followingRecord = followingMap.get(actorUrl) || null

			return processSingleFollower(
				userData as {
					id: string
					username: string
					name: string | null
					profileImage: string | null
					displayColor: string | null
				} | null,
				followingRecord,
				isLocal,
				actorUrl
			)
		})
	)

	return results
}

async function batchFetchRemoteUsers(actorUrls: string[]): Promise<
	Array<{
		id: string
		username: string
		name: string | null
		profileImage: string | null
		displayColor: string | null
		externalActorUrl: string | null
	}>
> {
	const cachedUsers = await prisma.user.findMany({
		where: { externalActorUrl: { in: actorUrls }, isRemote: true },
		select: {
			id: true,
			username: true,
			name: true,
			profileImage: true,
			displayColor: true,
			externalActorUrl: true,
		},
	})

	const cachedUrls = new Set(
		cachedUsers.map((u) => u.externalActorUrl).filter((u): u is string => u !== null)
	)
	const uncachedUrls = actorUrls.filter((url) => !cachedUrls.has(url))

	if (uncachedUrls.length > 0) {
		const fetchedUsers = await Promise.all(
			uncachedUrls.map(async (url) => {
				const user = await cacheRemoteUserByUrl(url)
				if (user) {
					return {
						id: user.id,
						username: user.username,
						name: user.name,
						profileImage: user.profileImage,
						displayColor: user.displayColor,
						externalActorUrl: url,
					}
				}
				return null
			})
		)
		const validFetched = fetchedUsers.filter((u): u is NonNullable<typeof u> => u !== null)
		return [...cachedUsers, ...validFetched]
	}

	return cachedUsers
}

async function processSingleFollower(
	userData: {
		id: string
		username: string
		name: string | null
		profileImage: string | null
		displayColor: string | null
	} | null,
	followingRecord: Awaited<ReturnType<typeof prisma.following.findUnique>> | null,
	isLocalUser: boolean,
	actorUrl: string
): Promise<FollowerUser> {
	const isPending = followingRecord !== null && !followingRecord.accepted
	const isFollowing = followingRecord !== null && followingRecord.accepted

	if (userData) {
		return {
			id: userData.id,
			username: userData.username,
			name: userData.name,
			profileImage: userData.profileImage,
			displayColor: userData.displayColor,
			isRemote: !isLocalUser,
			isFollowing,
			isPending,
		}
	}

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
}

async function addPendingFollowerToRemote(
	user: NonNullable<Awaited<ReturnType<typeof fetchUserForFollowers>>>,
	currentUserId: string | undefined,
	remoteFollowers: FollowerUser[]
) {
	if (!currentUserId) {
		return {
			followers: remoteFollowers,
			isRemote: true,
			remoteNote: null,
		}
	}

	const pendingRequest = await prisma.following.findUnique({
		where: {
			userId_actorUrl: {
				userId: currentUserId,
				actorUrl: user.externalActorUrl!,
			},
		},
	})

	if (!pendingRequest || pendingRequest.accepted) {
		return {
			followers: remoteFollowers,
			isRemote: true,
			remoteNote: null,
		}
	}

	const currentUserInList = remoteFollowers.some(
		(f) => f.id === currentUserId || f.username === currentUserId
	)

	if (currentUserInList) {
		return {
			followers: remoteFollowers,
			isRemote: true,
			remoteNote: '(1 local pending)',
		}
	}

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
			id: currentUser.id,
			username: currentUser.username,
			name: currentUser.name,
			profileImage: currentUser.profileImage,
			displayColor: currentUser.displayColor,
			isPending: true,
			isFollowing: true,
			isRemote: false,
		})
	}

	return {
		followers: remoteFollowers,
		isRemote: true,
		remoteNote: '(1 local pending)',
	}
}

async function getLocalFollowers(userId: string, limit: number) {
	const followers = await prisma.follower.findMany({
		where: { userId, accepted: true },
		take: limit,
		orderBy: { createdAt: 'desc' },
	})

	const pendingFollowing = await prisma.following.findMany({
		where: { userId, accepted: false },
		take: limit,
		orderBy: { createdAt: 'desc' },
	})

	const baseUrl = getBaseUrl()
	const currentUserId = undefined
	const currentUserActorUrl = currentUserId ? `${baseUrl}/users/${currentUserId}` : null
	const followerUsers: FollowerUser[] = []

	for (const follower of followers) {
		const followerUser = await processLocalFollower(
			follower.actorUrl,
			baseUrl,
			currentUserId,
			currentUserActorUrl
		)
		if (followerUser) followerUsers.push(followerUser)
	}

	for (const pending of pendingFollowing) {
		const pendingUser = await processLocalFollower(pending.actorUrl, baseUrl, null, null)
		if (pendingUser) {
			pendingUser.isPending = true
			followerUsers.push(pendingUser)
		}
	}

	return followerUsers
}

async function processLocalFollower(
	actorUrl: string,
	baseUrl: string,
	currentUserId: string | null | undefined,
	currentUserActorUrl: string | null
): Promise<FollowerUser | null> {
	let userRecord: {
		id: string
		username: string
		name: string | null
		profileImage: string | null
		displayColor: string | null
		isRemote: boolean
	} | null = null

	if (actorUrl.startsWith(baseUrl)) {
		const username = actorUrl.split('/').pop()
		if (username) {
			userRecord = await prisma.user.findUnique({
				where: { username, isRemote: false },
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
		userRecord = await prisma.user.findFirst({
			where: { externalActorUrl: actorUrl, isRemote: true },
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

	if (!userRecord) return null

	let isPending = false
	let isFollowing = false
	if (currentUserId && currentUserActorUrl) {
		const followingRecord = await prisma.following.findUnique({
			where: {
				userId_actorUrl: {
					userId: currentUserId,
					actorUrl,
				},
			},
		})
		isPending = followingRecord !== null && !followingRecord.accepted
		isFollowing = followingRecord !== null && followingRecord.accepted
	}

	return { ...userRecord, isPending, isFollowing }
}

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
		logger.error('Error getting following:', error)
		return c.json({ error: 'Internal server error' }, 500)
	}
})

// Helper function to resolve and cache remote user
export async function resolveAndCacheRemoteUser(username: string) {
	const parsedHandle = parseHandle(username)

	if (!parsedHandle || isLocalHandle(parsedHandle.domain)) {
		return null
	}

	logger.debug(`🔍 Attempting to resolve remote user: ${username}`)

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

	if (refetchedUser) {
		logger.debug(`✅ Resolved and cached remote user: ${username}`)
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
		logger.error('Error fetching events from outbox:', error)
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

async function lookupUser(username: string, isRemote: boolean) {
	const user = await prisma.user.findFirst({
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

	if (!user && isRemote) {
		const resolvedUser = await resolveAndCacheRemoteUser(username)
		if (resolvedUser) {
			return resolvedUser
		}
	}

	return user
}

async function checkProfileVisibility(
	user: NonNullable<Awaited<ReturnType<typeof lookupUser>>>,
	currentUserId: string | undefined,
	isOwnProfile: boolean
) {
	if (isOwnProfile) return true

	return canViewPrivateProfile({
		viewerId: currentUserId,
		profileUserId: user.id,
		profileIsRemote: user.isRemote,
		profileExternalActorUrl: user.externalActorUrl,
		profileUsername: user.username,
		profileIsPublic: user.isPublicProfile,
	})
}

function getLimitedProfileResponse(
	c: import('hono').Context,
	user: NonNullable<Awaited<ReturnType<typeof lookupUser>>>
) {
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

async function getUserCounts(user: NonNullable<Awaited<ReturnType<typeof lookupUser>>>) {
	let followerCount: number | null = null
	let followingCount: number | null = null
	let eventCount: number | null = null

	if (user.isRemote && user.externalActorUrl) {
		const counts = await fetchRemoteCounts(user)
		followerCount = counts.followerCount
		followingCount = counts.followingCount
		eventCount = counts.eventCount
	}

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

	if (eventCount === null) {
		eventCount = await prisma.event.count({ where: { userId: user.id } })
	}

	await updateCachedCounts(user, followerCount ?? 0, followingCount ?? 0)

	return { followerCount, followingCount, eventCount }
}

async function fetchRemoteCounts(
	user: NonNullable<Awaited<ReturnType<typeof lookupUser>>>
): Promise<{
	followerCount: number | null
	followingCount: number | null
	eventCount: number | null
}> {
	const hasFreshCache = false

	if (hasFreshCache) {
		return {
			followerCount: user.followersCount,
			followingCount: user.followingCount,
			eventCount: user._count?.events ?? null,
		}
	}

	try {
		const actor = await fetchActor(user.externalActorUrl!)

		if (!actor) {
			return {
				followerCount: user.followersCount ?? null,
				followingCount: user.followingCount ?? null,
				eventCount: user._count?.events ?? null,
			}
		}

		const followersUrl = getCollectionUrl(actor.followers)
		const followingUrl = getCollectionUrl(actor.following)
		const outboxUrl = getCollectionUrl(actor.outbox)

		const [remoteFollowers, remoteFollowing, outboxResponse] = await Promise.all([
			followersUrl ? fetchRemoteCollectionCount(followersUrl) : Promise.resolve(null),
			followingUrl ? fetchRemoteCollectionCount(followingUrl) : Promise.resolve(null),
			outboxUrl
				? safeFetch(outboxUrl, { headers: { Accept: ContentType.ACTIVITY_JSON } })
				: Promise.resolve(null),
		])

		let followerCount = remoteFollowers ?? user.followersCount ?? null
		let followingCount = remoteFollowing ?? user.followingCount ?? null
		let eventCount: number | null = user._count?.events ?? null

		if (outboxResponse?.ok) {
			const outbox = (await outboxResponse.json()) as {
				totalItems?: number
				first?: string | { id: string }
				orderedItems?: unknown[]
				items?: unknown[]
			}

			if (typeof outbox.totalItems === 'number' && outbox.totalItems > 0) {
				eventCount = outbox.totalItems
			}

			const items = await fetchOutboxFirstPage(outbox)
			if (items.length > 0) {
				await Promise.all(
					items.map((item) =>
						cacheEventFromOutboxActivity(
							item as Record<string, unknown>,
							user.externalActorUrl!
						).catch((err) => logger.error('Error caching remote event:', err))
					)
				)
			}
		}

		if (followerCount === null) followerCount = user.followersCount ?? null
		if (followingCount === null) followingCount = user.followingCount ?? null

		return { followerCount, followingCount, eventCount }
	} catch (e) {
		logger.error('Error fetching remote counts:', e)
		return {
			followerCount: user.followersCount ?? null,
			followingCount: user.followingCount ?? null,
			eventCount: user._count?.events ?? null,
		}
	}
}

async function fetchOutboxFirstPage(outbox: {
	first?: string | { id: string }
	orderedItems?: unknown[]
	items?: unknown[]
}): Promise<unknown[]> {
	if (outbox.first) {
		const firstPageUrl = typeof outbox.first === 'string' ? outbox.first : outbox.first?.id
		if (firstPageUrl) {
			try {
				const pageResponse = await safeFetch(firstPageUrl, {
					headers: { Accept: ContentType.ACTIVITY_JSON },
				})
				if (pageResponse.ok) {
					const page = (await pageResponse.json()) as {
						orderedItems?: unknown[]
						items?: unknown[]
					}
					return page.orderedItems || page.items || []
				}
			} catch (e) {
				logger.error('Error fetching outbox page:', e)
			}
		}
		if (typeof outbox.first === 'object') {
			const firstObj = outbox.first as { orderedItems?: unknown[]; items?: unknown[] }
			return firstObj.orderedItems || firstObj.items || []
		}
	}
	return outbox.orderedItems || outbox.items || []
}

async function updateCachedCounts(
	user: NonNullable<Awaited<ReturnType<typeof lookupUser>>>,
	followerCount: number,
	followingCount: number
) {
	if (user.isRemote && user.externalActorUrl) {
		await prisma.user
			.update({
				where: { id: user.id },
				data: {
					followersCount: followerCount,
					followingCount: followingCount,
				},
			})
			.catch((e) => logger.error('Failed to update profile cache:', e))
	}
}

async function fetchUserEvents(
	user: NonNullable<Awaited<ReturnType<typeof lookupUser>>>,
	currentUserId: string | undefined
) {
	const whereClause = buildEventsWhereClause(user)
	const now = new Date()

	const upcomingEvents = await fetchUpcomingEvents(whereClause, now)
	const limitRemaining = 50 - upcomingEvents.length
	const pastEvents =
		limitRemaining > 0 ? await fetchPastEvents(whereClause, now, limitRemaining) : []

	const filteredUpcoming = await filterEventsByVisibility(upcomingEvents, currentUserId)
	const filteredPast = await filterEventsByVisibility(pastEvents, currentUserId)

	let events = [...filteredUpcoming, ...filteredPast]

	if (user.isRemote && events.length === 0 && user.externalActorUrl) {
		events = await fetchRemoteUserEvents(user, currentUserId, now)
	}

	return events
}

async function fetchUpcomingEvents(
	whereClause: import('@prisma/client').Prisma.EventWhereInput,
	now: Date
) {
	const upcomingWhere = {
		AND: [
			whereClause,
			{
				OR: [
					{ endTime: { gte: now } },
					{ AND: [{ endTime: null }, { startTime: { gte: now } }] },
				],
			},
		],
	}

	return prisma.event.findMany({
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
		orderBy: { startTime: 'asc' },
		take: 50,
	})
}

async function fetchPastEvents(
	whereClause: import('@prisma/client').Prisma.EventWhereInput,
	now: Date,
	take: number
) {
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

	return prisma.event.findMany({
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
		orderBy: { startTime: 'desc' },
		take,
	})
}

async function fetchRemoteUserEvents(
	user: NonNullable<Awaited<ReturnType<typeof lookupUser>>>,
	currentUserId: string | undefined,
	now: Date
) {
	await fetchAndCacheEventsFromOutbox(user.externalActorUrl!)

	const upcomingEvents = await prisma.event.findMany({
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

	const limitRemaining = 50 - upcomingEvents.length
	const pastEvents =
		limitRemaining > 0
			? await prisma.event.findMany({
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
					take: limitRemaining,
				})
			: []

	const filteredUpcoming = await filterEventsByVisibility(upcomingEvents, currentUserId)
	const filteredPast = await filterEventsByVisibility(pastEvents, currentUserId)

	return [...filteredUpcoming, ...filteredPast]
}

function buildProfileResponse(
	user: NonNullable<Awaited<ReturnType<typeof lookupUser>>>,
	counts: {
		followerCount: number | null
		followingCount: number | null
		eventCount: number | null
	},
	events: Awaited<ReturnType<typeof fetchUserEvents>>
) {
	return {
		user: {
			...user,
			_count: {
				followers: counts.followerCount,
				following: counts.followingCount,
				events: counts.eventCount ?? events.length,
			},
		},
		events,
	}
}

app.get('/profile/:username', async (c) => {
	try {
		const username = decodeURIComponent(c.req.param('username'))
		const currentUserId = c.get('userId') as string | undefined
		const isRemote = username.includes('@')

		logger.debug(`[userSearch] Looking up profile for: ${username} (isRemote: ${isRemote})`)

		const user = await lookupUser(username, isRemote)
		if (!user) {
			return c.json({ error: 'User not found' }, 404)
		}

		if (user.isRemote && user.externalActorUrl) {
			void trackInstance(user.externalActorUrl)
		}

		const isOwnProfile = currentUserId === user.id
		const canViewFullProfile = await checkProfileVisibility(user, currentUserId, isOwnProfile)

		if (!user.isPublicProfile && !canViewFullProfile) {
			return getLimitedProfileResponse(c, user)
		}

		const counts = await getUserCounts(user)
		const events = await fetchUserEvents(user, currentUserId)

		return c.json(buildProfileResponse(user, counts, events))
	} catch (error) {
		logger.error('Error getting user profile:', error)
		return c.json({ error: 'Internal server error' }, 500)
	}
})

export default app
