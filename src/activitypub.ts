/**
 * ActivityPub Endpoints
 * WebFinger, Actor, Inbox, Outbox, and Collections
 */

import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import {
	getBaseUrl,
	createOrderedCollection,
	createOrderedCollectionPage,
} from './lib/activitypubHelpers.js'
import { canViewPrivateProfile } from './lib/privacy.js'
import { verifySignature, createDigest } from './lib/httpSignature.js'
import { ActivitySchema, PersonSchema, EventSchema } from './lib/activitypubSchemas.js'
import {
	ACTIVITYPUB_CONTEXTS,
	ContentType,
	ObjectType,
	PAGINATION,
} from './constants/activitypub.js'
import { handleActivity } from './federation.js'
import { prisma } from './lib/prisma.js'
import { config } from './config.js'
import { logger } from './lib/logger.js'

/**
 * Validates the Digest header against the request body
 * Supports SHA-256 algorithm (case-insensitive)
 * Handles multiple comma-separated digest values
 */
async function validateDigest(bodyText: string, digestHeader: string | undefined): Promise<boolean> {
	if (!digestHeader) return true

	const digest = await createDigest(bodyText)
	// createDigest returns "SHA-256=...", so we slice after the first "="
	const digestValue = digest.slice(digest.indexOf('=') + 1)
	const digestParts = digestHeader.split(',')

	for (const part of digestParts) {
		const trimmed = part.trim()
		const firstEqual = trimmed.indexOf('=')
		if (firstEqual === -1) continue

		const algo = trimmed.slice(0, firstEqual)
		const val = trimmed.slice(firstEqual + 1)

		if (algo.toLowerCase() === 'sha-256') {
			return val === digestValue
		}
	}

	// If SHA-256 is present but didn't match, we would have returned false in loop?
	// No, the loop logic above is: if we find SHA-256, we return comparison result.
	// Wait, my previous loop logic was:
	// if found sha-256, store it.
	// if stored, compare.
	// Refined logic:
	// Loop: if algo is sha-256 -> return val === digestValue.
	// If loop finishes without returning, it means SHA-256 was not found in header.
	// In that case, we default to valid (true) or invalid?
	// Current decision: Only enforce if SHA-256 is present.
	return true
}

const app = new Hono()

// Maximum request body size for ActivityPub inbox endpoints (1MB)
// This prevents DoS attacks from large malformed JSON payloads
const MAX_INBOX_BODY_SIZE = 1 * 1024 * 1024 // 1MB

// WebFinger discovery
app.get('/.well-known/webfinger', async (c) => {
	try {
		const resource = c.req.query('resource')

		if (!resource) {
			return c.json({ error: 'Missing resource parameter' }, 400)
		}

		// Parse resource (acct:username@domain)
		const match = /^acct:([^@]+)@(.+)$/.exec(resource)
		if (!match) {
			return c.json({ error: 'Invalid resource format' }, 400)
		}

		const [, username, domain] = match
		const baseUrl = getBaseUrl()
		const expectedDomain = new URL(baseUrl).hostname

		if (domain !== expectedDomain) {
			return c.json({ error: 'Domain mismatch' }, 404)
		}

		// Find user
		const user = await prisma.user.findUnique({
			where: { username, isRemote: false },
		})

		if (!user) {
			return c.json({ error: 'User not found' }, 404)
		}

		const actorUrl = `${baseUrl}/users/${username}`

		return c.json({
			subject: resource,
			aliases: [actorUrl],
			links: [
				{
					rel: 'self',
					type: ContentType.ACTIVITY_JSON,
					href: actorUrl,
				},
				{
					rel: 'https://webfinger.net/rel/profile-page',
					type: 'text/html',
					href: actorUrl,
				},
			],
		})
	} catch (error) {
		logger.error('WebFinger error:', error)
		return c.json({ error: 'Internal server error' }, 500)
	}
})

// NodeInfo discovery
app.get('/.well-known/nodeinfo', async (c) => {
	const baseUrl = getBaseUrl()
	return c.json({
		links: [
			{
				rel: 'https://nodeinfo.diaspora.software/ns/schema/2.0',
				href: `${baseUrl}/nodeinfo/2.0`,
			},
		],
	})
})

app.get('/nodeinfo/2.0', async (c) => {
	const userCount = await prisma.user.count({ where: { isRemote: false } })
	const eventCount = await prisma.event.count({ where: { userId: { not: null } } })

	return c.json({
		version: '2.0',
		software: {
			name: 'constellate',
			version: '1.0.0',
		},
		protocols: ['activitypub'],
		services: {
			inbound: [],
			outbound: [],
		},
		openRegistrations: true,
		usage: {
			users: {
				total: userCount,
			},
			localPosts: eventCount,
		},
		metadata: {
			nodeName: 'Constellate',
			nodeDescription: 'Federated event management platform',
		},
	})
})

// Actor endpoint
app.get('/users/:username', async (c) => {
	try {
		const { username } = c.req.param()
		const baseUrl = getBaseUrl()

		const user = await prisma.user.findUnique({
			where: { username, isRemote: false },
		})

		if (!user) {
			return c.json({ error: 'User not found' }, 404)
		}

		// Generate keys if user doesn't have them
		if (!user.publicKey || !user.privateKey) {
			const { generateAndEncryptRSAKeys } = await import('./auth.js')
			const { publicKey, encryptedPrivateKey } = await generateAndEncryptRSAKeys()

			await prisma.user.update({
				where: { id: user.id },
				data: {
					publicKey,
					privateKey: encryptedPrivateKey,
				},
			})

			user.publicKey = publicKey
			user.privateKey = encryptedPrivateKey
			logger.info('✅ Generated and encrypted keys for user: ' + username)
		}

		const actorUrl = `${baseUrl}/users/${username}`

		const actor = {
			'@context': ACTIVITYPUB_CONTEXTS,
			type: ObjectType.PERSON,
			id: actorUrl,
			preferredUsername: username,
			name: user.name || username,
			summary: user.bio || undefined,
			inbox: `${actorUrl}/inbox`,
			outbox: `${actorUrl}/outbox`,
			followers: `${actorUrl}/followers`,
			following: `${actorUrl}/following`,
			publicKey: {
				id: `${actorUrl}#main-key`,
				owner: actorUrl,
				publicKeyPem: user.publicKey!,
			},
			icon: user.profileImage
				? {
						type: ObjectType.IMAGE,
						url: user.profileImage,
					}
				: undefined,
			image: user.headerImage
				? {
						type: ObjectType.IMAGE,
						url: user.headerImage,
					}
				: undefined,
			endpoints: {
				sharedInbox: `${baseUrl}/inbox`,
			},
			displayColor: user.displayColor,
		}

		// Validate before returning
		PersonSchema.parse(actor)

		return c.json(actor, 200, {
			'Content-Type': ContentType.ACTIVITY_JSON,
		})
	} catch (error) {
		logger.error('Actor endpoint error:', error)
		return c.json({ error: 'Internal server error' }, 500)
	}
})

// Followers collection
app.get('/users/:username/followers', async (c) => {
	try {
		const { username } = c.req.param()
		const page = c.req.query('page')
		const baseUrl = getBaseUrl()

		const user = await prisma.user.findUnique({
			where: { username, isRemote: false },
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

		// Check privacy - get viewer actor URL from request headers if available
		const viewerActorUrl = c.req.header('X-Actor-Url') || undefined
		const canView = await canViewPrivateProfile({
			viewerActorUrl,
			profileUserId: user.id,
			profileIsRemote: user.isRemote,
			profileExternalActorUrl: user.externalActorUrl,
			profileUsername: user.username,
			profileIsPublic: user.isPublicProfile,
		})

		const collectionUrl = `${baseUrl}/users/${username}/followers`

		if (!canView) {
			// Return empty collection for private profiles
			return c.json(createOrderedCollection(collectionUrl, [], 0), 200, {
				'Content-Type': ContentType.ACTIVITY_JSON,
			})
		}

		if (!page) {
			// Return collection
			const totalFollowers = await prisma.follower.count({
				where: { userId: user.id, accepted: true },
			})

			return c.json(createOrderedCollection(collectionUrl, [], totalFollowers), 200, {
				'Content-Type': ContentType.ACTIVITY_JSON,
			})
		}

		// Return page
		const pageNum = parseInt(page)
		const limit = PAGINATION.DEFAULT_PAGE_SIZE
		const skip = (pageNum - 1) * limit

		const followers = await prisma.follower.findMany({
			where: { userId: user.id, accepted: true },
			skip,
			take: limit,
			orderBy: { createdAt: 'desc' },
		})

		const actorUrls = followers.map((f) => f.actorUrl)

		const nextPage =
			followers.length === limit ? `${collectionUrl}?page=${pageNum + 1}` : undefined

		const prevPage = pageNum > 1 ? `${collectionUrl}?page=${pageNum - 1}` : undefined

		return c.json(
			createOrderedCollectionPage(
				`${collectionUrl}?page=${pageNum}`,
				actorUrls,
				collectionUrl,
				nextPage,
				prevPage
			),
			200,
			{ 'Content-Type': ContentType.ACTIVITY_JSON }
		)
	} catch (error) {
		logger.error('Followers collection error:', error)
		return c.json({ error: 'Internal server error' }, 500)
	}
})

// Following collection
app.get('/users/:username/following', async (c) => {
	try {
		const { username } = c.req.param()
		const page = c.req.query('page')
		const baseUrl = getBaseUrl()

		const user = await prisma.user.findUnique({
			where: { username, isRemote: false },
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

		// Check privacy - get viewer actor URL from request headers if available
		const viewerActorUrl = c.req.header('X-Actor-Url') || undefined
		const canView = await canViewPrivateProfile({
			viewerActorUrl,
			profileUserId: user.id,
			profileIsRemote: user.isRemote,
			profileExternalActorUrl: user.externalActorUrl,
			profileUsername: user.username,
			profileIsPublic: user.isPublicProfile,
		})

		const collectionUrl = `${baseUrl}/users/${username}/following`

		if (!canView) {
			// Return empty collection for private profiles
			return c.json(createOrderedCollection(collectionUrl, [], 0), 200, {
				'Content-Type': ContentType.ACTIVITY_JSON,
			})
		}

		if (!page) {
			// Return collection
			const totalFollowing = await prisma.following.count({
				where: { userId: user.id, accepted: true },
			})

			return c.json(createOrderedCollection(collectionUrl, [], totalFollowing), 200, {
				'Content-Type': ContentType.ACTIVITY_JSON,
			})
		}

		// Return page
		const pageNum = parseInt(page)
		const limit = PAGINATION.DEFAULT_PAGE_SIZE
		const skip = (pageNum - 1) * limit

		const following = await prisma.following.findMany({
			where: { userId: user.id, accepted: true },
			skip,
			take: limit,
			orderBy: { createdAt: 'desc' },
		})

		const actorUrls = following.map((f) => f.actorUrl)

		const nextPage =
			following.length === limit ? `${collectionUrl}?page=${pageNum + 1}` : undefined

		const prevPage = pageNum > 1 ? `${collectionUrl}?page=${pageNum - 1}` : undefined

		return c.json(
			createOrderedCollectionPage(
				`${collectionUrl}?page=${pageNum}`,
				actorUrls,
				collectionUrl,
				nextPage,
				prevPage
			),
			200,
			{ 'Content-Type': ContentType.ACTIVITY_JSON }
		)
	} catch (error) {
		logger.error('Following collection error:', error)
		return c.json({ error: 'Internal server error' }, 500)
	}
})

// Outbox collection
app.get('/users/:username/outbox', async (c) => {
	try {
		const { username } = c.req.param()
		const page = c.req.query('page')
		const baseUrl = getBaseUrl()

		const user = await prisma.user.findUnique({
			where: { username, isRemote: false },
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

		// Check privacy - get viewer actor URL from request headers if available
		const viewerActorUrl = c.req.header('X-Actor-Url') || undefined
		const canViewAll = await canViewPrivateProfile({
			viewerActorUrl,
			profileUserId: user.id,
			profileIsRemote: user.isRemote,
			profileExternalActorUrl: user.externalActorUrl,
			profileUsername: user.username,
			profileIsPublic: user.isPublicProfile,
		})

		const collectionUrl = `${baseUrl}/users/${username}/outbox`

		// Build event filter based on privacy
		const eventWhere: { userId: string; visibility?: 'PUBLIC' } = { userId: user.id }
		if (!canViewAll) {
			// For private profiles, only show PUBLIC events to non-followers
			eventWhere.visibility = 'PUBLIC'
		}

		if (!page) {
			// Return collection
			const totalEvents = await prisma.event.count({
				where: eventWhere,
			})

			return c.json(createOrderedCollection(collectionUrl, [], totalEvents), 200, {
				'Content-Type': ContentType.ACTIVITY_JSON,
			})
		}

		// Return page with events as Create activities
		const pageNum = parseInt(page)
		const limit = PAGINATION.DEFAULT_PAGE_SIZE
		const skip = (pageNum - 1) * limit

		const events = await prisma.event.findMany({
			where: eventWhere,
			skip,
			take: limit,
			orderBy: { createdAt: 'desc' },
			include: { user: true },
		})

		const activities = events.map((event) => {
			const actorUrl = `${baseUrl}/users/${username}`
			const eventUrl = `${baseUrl}/events/${event.id}`

			return {
				'@context': ACTIVITYPUB_CONTEXTS,
				id: `${actorUrl}/activities/${event.id}/create`,
				type: 'Create',
				actor: actorUrl,
				published: event.createdAt.toISOString(),
				object: {
					type: ObjectType.EVENT,
					id: eventUrl,
					name: event.title,
					summary: event.summary || undefined,
					startTime: event.startTime.toISOString(),
					endTime: event.endTime?.toISOString(),
					location: event.location || undefined,
					attributedTo: actorUrl,
				},
			}
		})

		const nextPage =
			events.length === limit ? `${collectionUrl}?page=${pageNum + 1}` : undefined

		const prevPage = pageNum > 1 ? `${collectionUrl}?page=${pageNum - 1}` : undefined

		return c.json(
			createOrderedCollectionPage(
				`${collectionUrl}?page=${pageNum}`,
				activities,
				collectionUrl,
				nextPage,
				prevPage
			),
			200,
			{ 'Content-Type': ContentType.ACTIVITY_JSON }
		)
	} catch (error) {
		logger.error('Outbox collection error:', error)
		return c.json({ error: 'Internal server error' }, 500)
	}
})

// Personal inbox
app.post(
	'/users/:username/inbox',
	bodyLimit({
		maxSize: MAX_INBOX_BODY_SIZE,
		onError: (c) => {
			return c.json({ error: 'Request body too large' }, 413)
		},
	}),
	async (c) => {
		try {
			const { username } = c.req.param()

			// Verify user exists
			const user = await prisma.user.findUnique({
				where: { username, isRemote: false },
			})

			if (!user) {
				return c.json({ error: 'User not found' }, 404)
			}

			// Verify HTTP signature BEFORE parsing JSON to prevent DoS attacks
			// This ensures we reject invalid requests before wasting resources on JSON parsing
			const signature = c.req.header('signature')
			if (!signature) {
				return c.json({ error: 'Missing signature' }, 401)
			}

			const method = c.req.method
			const url = new URL(c.req.url)
			const path = url.pathname + url.search // Include query string if present
			const headers: Record<string, string> = {}
			c.req.raw.headers.forEach((value, key) => {
				headers[key.toLowerCase()] = value
			})

			// Use the target server's hostname for signature verification
			// The signature was created with the target host (app1.local), not the sender's host
			// This handles reverse proxy scenarios where Host header is changed to localhost:3000
			const baseUrl = getBaseUrl()
			const targetHost = new URL(baseUrl).hostname
			if (headers['host'] && !headers['host'].includes(targetHost)) {
				// Only log host details in development to avoid information disclosure
				if (config.isDevelopment) {
					logger.info(
						'[Inbox] Using target host: ' +
							targetHost +
							' (instead of ' +
							headers['host'] +
							')'
					)
				}
				headers['host'] = targetHost
			}

			const isValid = await verifySignature(signature, method, path, headers)
			if (!isValid) {
				logger.error('[Inbox] Signature verification failed for ' + method + ' ' + path)
				// Only log signature details in development to avoid information disclosure
				if (config.isDevelopment) {
					logger.error('[Inbox] Signature: ' + signature.substring(0, 100) + '...')
				}
				return c.json({ error: 'Invalid signature' }, 401)
			}

			// Read body text first to verify digest
			let bodyText: string
			try {
				bodyText = await c.req.text()
			} catch (error) {
				logger.error('[Inbox] Failed to read request body:', error)
				return c.json({ error: 'Invalid request body' }, 400)
			}

			// Verify digest if present
			const digestHeader = c.req.header('digest')
			const isDigestValid = await validateDigest(bodyText, digestHeader)
			if (!isDigestValid) {
				logger.error('[Inbox] Digest mismatch')
				return c.json({ error: 'Invalid digest' }, 401)
			}

			// Parse activity with error handling to prevent DoS from malformed JSON
			let activity
			try {
				activity = JSON.parse(bodyText) as unknown
			} catch (error) {
				// Only log full error details in development to avoid potential information disclosure
				if (config.isDevelopment) {
					logger.error('[Inbox] JSON parsing failed:', error)
				} else {
					logger.error('[Inbox] JSON parsing failed')
				}
				return c.json({ error: 'Invalid JSON payload' }, 400)
			}

			// Validate activity
			let validatedActivity
			try {
				validatedActivity = ActivitySchema.parse(activity)
			} catch (error) {
				logger.error('Activity validation failed:', error)
				return c.json({ error: 'Invalid activity' }, 400)
			}

			// Handle activity asynchronously
			handleActivity(validatedActivity).catch((error) => {
				logger.error('Error handling activity:', error)
			})

			return c.json({ status: 'accepted' }, 202)
		} catch (error) {
			logger.error('Inbox error:', error)
			return c.json({ error: 'Internal server error' }, 500)
		}
	}
)

// Shared inbox
app.post(
	'/inbox',
	bodyLimit({
		maxSize: MAX_INBOX_BODY_SIZE,
		onError: (c) => {
			return c.json({ error: 'Request body too large' }, 413)
		},
	}),
	async (c) => {
		try {
			// Verify HTTP signature BEFORE parsing JSON to prevent DoS attacks
			// This ensures we reject invalid requests before wasting resources on JSON parsing
			const signature = c.req.header('signature')
			if (!signature) {
				return c.json({ error: 'Missing signature' }, 401)
			}

			const method = c.req.method
			const url = new URL(c.req.url)
			const path = url.pathname + url.search // Include query string if present
			const headers: Record<string, string> = {}
			c.req.raw.headers.forEach((value, key) => {
				headers[key.toLowerCase()] = value
			})

			// Use the target server's hostname for signature verification
			// The signature was created with the target host (app1.local), not the sender's host
			// This handles reverse proxy scenarios where Host header is changed to localhost:3000
			const baseUrl = getBaseUrl()
			const targetHost = new URL(baseUrl).hostname
			if (headers['host'] && !headers['host'].includes(targetHost)) {
				// Only log host details in development to avoid information disclosure
				if (config.isDevelopment) {
					logger.info(
						'[Shared Inbox] Using target host: ' +
							targetHost +
							' (instead of ' +
							headers['host'] +
							')'
					)
				}
				headers['host'] = targetHost
			}

			const isValid = await verifySignature(signature, method, path, headers)
			if (!isValid) {
				logger.error(
					'[Shared Inbox] Signature verification failed for ' + method + ' ' + path
				)
				// Only log signature details in development to avoid information disclosure
				if (config.isDevelopment) {
					logger.error('[Shared Inbox] Signature: ' + signature.substring(0, 100) + '...')
				}
				return c.json({ error: 'Invalid signature' }, 401)
			}

			// Read body text first to verify digest
			let bodyText: string
			try {
				bodyText = await c.req.text()
			} catch (error) {
				logger.error('[Shared Inbox] Failed to read request body:', error)
				return c.json({ error: 'Invalid request body' }, 400)
			}

			// Verify digest if present
			const digestHeader = c.req.header('digest')
			const isDigestValid = await validateDigest(bodyText, digestHeader)
			if (!isDigestValid) {
				logger.error('[Shared Inbox] Digest mismatch')
				return c.json({ error: 'Invalid digest' }, 401)
			}

			// Parse activity with error handling to prevent DoS from malformed JSON
			let activity
			try {
				activity = JSON.parse(bodyText) as unknown
			} catch (error) {
				// Only log full error details in development to avoid potential information disclosure
				if (config.isDevelopment) {
					logger.error('[Shared Inbox] JSON parsing failed:', error)
				} else {
					logger.error('[Shared Inbox] JSON parsing failed')
				}
				return c.json({ error: 'Invalid JSON payload' }, 400)
			}

			// Validate activity
			let validatedActivity
			try {
				validatedActivity = ActivitySchema.parse(activity)
			} catch (error) {
				logger.error('Activity validation failed:', error)
				return c.json({ error: 'Invalid activity' }, 400)
			}

			// Handle activity asynchronously
			handleActivity(validatedActivity).catch((error) => {
				logger.error('Error handling activity:', error)
			})

			return c.json({ status: 'accepted' }, 202)
		} catch (error) {
			logger.error('Shared inbox error:', error)
			return c.json({ error: 'Internal server error' }, 500)
		}
	}
)

// Event as ActivityPub object
app.get('/events/:id', async (c) => {
	try {
		const { id } = c.req.param()
		const baseUrl = getBaseUrl()

		const event = await prisma.event.findUnique({
			where: { id },
			include: { user: true },
		})

		if (!event) {
			return c.json({ error: 'Event not found' }, 404)
		}

		const user = event.user
		const actorUrl = user?.isRemote
			? user.externalActorUrl!
			: `${baseUrl}/users/${user?.username}`

		const eventUrl = `${baseUrl}/events/${id}`

		const eventObject = {
			'@context': ACTIVITYPUB_CONTEXTS,
			type: ObjectType.EVENT,
			id: eventUrl,
			name: event.title,
			summary: event.summary || undefined,
			startTime: event.startTime.toISOString(),
			endTime: event.endTime?.toISOString(),
			duration: event.duration || undefined,
			location: event.location || undefined,
			url: event.url || undefined,
			attributedTo: actorUrl,
			published: event.createdAt.toISOString(),
			updated: event.updatedAt.toISOString(),
			eventStatus: event.eventStatus || undefined,
			eventAttendanceMode: event.eventAttendanceMode || undefined,
			maximumAttendeeCapacity: event.maximumAttendeeCapacity || undefined,
			attachment: event.headerImage
				? [
						{
							type: ObjectType.IMAGE,
							url: event.headerImage,
						},
					]
				: undefined,
		}

		// Validate before returning
		EventSchema.parse(eventObject)

		return c.json(eventObject, 200, {
			'Content-Type': ContentType.ACTIVITY_JSON,
		})
	} catch (error) {
		logger.error('Event object error:', error)
		return c.json({ error: 'Internal server error' }, 500)
	}
})

export default app
