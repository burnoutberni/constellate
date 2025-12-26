/**
 * Instance Discovery Helpers
 * Functions for discovering and tracking federated instances
 */

import { prisma } from './prisma.js'
import { safeFetch } from './ssrfProtection.js'
import { ContentType } from '../constants/activitypub.js'
import { resolveWebFinger } from './webfinger.js'
import type { Activity } from './activitypubSchemas.js'

/**
 * Extract domain from actor URL
 */
export function extractDomain(actorUrl: string): string | null {
	try {
		const url = new URL(actorUrl)
		return url.hostname
	} catch {
		return null
	}
}

/**
 * Extract base URL from actor URL
 */
export function extractBaseUrl(actorUrl: string): string | null {
	try {
		const url = new URL(actorUrl)
		// Include port if non-standard
		const port = url.port && url.port !== '80' && url.port !== '443' ? `:${url.port}` : ''
		return `${url.protocol}//${url.hostname}${port}`
	} catch {
		return null
	}
}

/**
 * Fetch instance metadata from NodeInfo
 * https://nodeinfo.diaspora.software/protocol.html
 */
export async function fetchInstanceMetadata(baseUrl: string): Promise<{
	software?: string
	version?: string
	userCount?: number
	eventCount?: number
	title?: string
	description?: string
	iconUrl?: string
	contact?: string
} | null> {
	try {
		// Try to fetch NodeInfo
		const wellKnownUrl = `${baseUrl}/.well-known/nodeinfo`
		const wellKnownResponse = await safeFetch(
			wellKnownUrl,
			{
				headers: { Accept: ContentType.JSON },
			},
			5000
		)

		if (!wellKnownResponse.ok) {
			return null
		}

		const wellKnownData = (await wellKnownResponse.json()) as {
			links?: Array<{ rel: string; href: string }>
		}

		// Find NodeInfo 2.0 or 2.1 link
		// Note: These are specification URLs as defined by the NodeInfo protocol, not actual HTTP requests
		// eslint-disable-next-line sonarjs/no-clear-text-protocols
		const nodeInfoSchema20 = 'http://nodeinfo.diaspora.software/ns/schema/2.0'
		// eslint-disable-next-line sonarjs/no-clear-text-protocols
		const nodeInfoSchema21 = 'http://nodeinfo.diaspora.software/ns/schema/2.1'
		const nodeInfoLink = wellKnownData.links?.find(
			(link) => link.rel === nodeInfoSchema20 || link.rel === nodeInfoSchema21
		)

		if (!nodeInfoLink) {
			return null
		}

		// Fetch NodeInfo
		const nodeInfoResponse = await safeFetch(
			nodeInfoLink.href,
			{
				headers: { Accept: ContentType.JSON },
			},
			5000
		)

		if (!nodeInfoResponse.ok) {
			return null
		}

		const nodeInfo = (await nodeInfoResponse.json()) as {
			software?: { name?: string; version?: string }
			usage?: { users?: { total?: number }; localPosts?: number; localComments?: number }
			metadata?: {
				nodeName?: string
				nodeDescription?: string
				nodeIcon?: string
				contact?: string
			}
		}

		return {
			software: nodeInfo.software?.name,
			version: nodeInfo.software?.version,
			userCount: nodeInfo.usage?.users?.total,
			eventCount: (nodeInfo.usage?.localPosts ?? 0) + (nodeInfo.usage?.localComments ?? 0),
			title: nodeInfo.metadata?.nodeName,
			description: nodeInfo.metadata?.nodeDescription,
			iconUrl: nodeInfo.metadata?.nodeIcon,
			contact: nodeInfo.metadata?.contact,
		}
	} catch (error) {
		console.error('Error fetching instance metadata:', error)
		return null
	}
}

/**
 * Record or update instance information based on actor URL
 */
export async function trackInstance(actorUrl: string): Promise<void> {
	const domain = extractDomain(actorUrl)
	const baseUrl = extractBaseUrl(actorUrl)

	if (!domain || !baseUrl) {
		return
	}

	// Check if instance already exists
	const existingInstance = await prisma.instance.findUnique({
		where: { domain },
	})

	const now = new Date()

	if (existingInstance) {
		// Update last activity time
		await prisma.instance.update({
			where: { domain },
			data: {
				lastActivityAt: now,
			},
		})
	} else {
		// Create new instance record
		const metadata = await fetchInstanceMetadata(baseUrl)

		// Try to discover public endpoint
		let publicEventsUrl: string | null = null
		if (domain) {
			publicEventsUrl = await discoverPublicEndpoint(domain)
		}

		await prisma.instance.create({
			data: {
				domain,
				baseUrl,
				software: metadata?.software,
				version: metadata?.version,
				userCount: metadata?.userCount,
				eventCount: metadata?.eventCount,
				title: metadata?.title,
				description: metadata?.description,
				iconUrl: metadata?.iconUrl,
				contact: metadata?.contact,
				publicEventsUrl,
				lastActivityAt: now,
				lastFetchedAt: metadata ? now : null,
			},
		})
	}
}

/**
 * Discover a public endpoint (outbox) for an instance
 */
export async function discoverPublicEndpoint(domain: string): Promise<string | null> {
	try {
		// 1. Try generic "events" actor via WebFinger
		const eventsActorUrl = await resolveWebFinger(`acct:events@${domain}`)
		if (eventsActorUrl) {
			const actor = await fetchRemoteActor(eventsActorUrl)
			if (actor?.outbox) {
				return actor.outbox
			}
		}

		// 2. Try "groups" actor (Gathio/Mobilizon style sometimes)
		const groupsActorUrl = await resolveWebFinger(`acct:groups@${domain}`)
		if (groupsActorUrl) {
			const actor = await fetchRemoteActor(groupsActorUrl)
			if (actor?.outbox) {
				return actor.outbox
			}
		}

		// 3. Fallback: Check if there is an "instance actor" (e.g. Mastodon)
		// Usually accessible at https://domain/actor
		const instanceActorUrl = `https://${domain}/actor`
		const instanceActor = await fetchRemoteActor(instanceActorUrl)
		if (instanceActor?.outbox) {
			return instanceActor.outbox
		}

		return null
	} catch (error) {
		console.error(`Error discovering endpoint for ${domain}:`, error)
		return null
	}
}

/**
 * Poll known actors from this instance (Fallback strategy)
 * Returns a list of outbox URLs to poll
 */
export async function pollKnownActors(domain: string): Promise<string[]> {
	try {
		const users = await prisma.user.findMany({
			where: {
				isRemote: true,
				externalActorUrl: {
					contains: `://${domain}/`,
				},
			},
			select: {
				externalActorUrl: true,
			},
		})

		const outboxes: string[] = []
		for (const user of users) {
			if (user.externalActorUrl) {
				// We need to fetch the actor to get the outbox, or guess it?
				// To be safe, we should have stored the outbox URL in the User model.
				// But we assume standard ActivityPub structure or fetch it.
				// Since fetching every user is expensive, we rely on the fact that we might
				// have cached the outbox in the User model... wait, User model DOES NOT have outboxUrl?
				// Checking User model... Step 55 view_code_item:
				// inboxUrl, sharedInboxUrl... NO outboxUrl.
				// user.externalActorUrl is the ID. We can append /outbox and hope?
				// Or we should fetch the actor.
				// "cacheRemoteUser" did fetch the actor, but didn't save outbox?
				// Let's check cacheRemoteUser again.
				// It parses optional fields... but didn't save outboxUrl.
				// So we must fetch the actor or guess. Guessing is risky.
				// We'll append /outbox as a heuristic for now, or fetch if needed.
				// Fetching all actors every poll is bad.
				// Ideally we add `outboxUrl` to User model too, but that's another schema change.
				// For now, let's assume `externalActorUrl + /outbox` works for Mastodon/Pleroma/Mobilizon.
				outboxes.push(`${user.externalActorUrl}/outbox`)
			}
		}
		return outboxes
	} catch (error) {
		console.error(`Error polling known actors for ${domain}:`, error)
		return []
	}
}

/**
 * Fetch public timeline (Collection)
 */
export async function fetchInstancePublicTimeline(outboxUrl: string): Promise<Activity[]> {
	try {
		const response = await safeFetch(outboxUrl, {
			headers: { Accept: ContentType.ACTIVITY_JSON },
		})

		if (!response.ok) {
			// Try adding ?page=true or ?page=1 if it's a Collection
			const pageUrl = outboxUrl.includes('?')
				? `${outboxUrl}&page=true`
				: `${outboxUrl}?page=true`
			const pageResponse = await safeFetch(pageUrl, {
				headers: { Accept: ContentType.ACTIVITY_JSON },
			})
			if (!pageResponse.ok) return []
			return processCollectionResponse(await pageResponse.json())
		}

		const data = await response.json()
		return processCollectionResponse(data)
	} catch (error) {
		console.error(`Error fetching timeline from ${outboxUrl}:`, error)
		return []
	}
}

async function processCollectionResponse(data: unknown): Promise<Activity[]> {
	if (!data) return []

	// Type guard helper could be better, but for now we cast to access properties
	const collection = data as Record<string, unknown>

	// If it's a Collection/OrderedCollection, look for 'first'
	if (
		(collection.type === 'Collection' || collection.type === 'OrderedCollection') &&
		collection.first
	) {
		// If 'first' is a string, fetch it
		if (typeof collection.first === 'string') {
			const firstPageRes = await safeFetch(collection.first, {
				headers: { Accept: ContentType.ACTIVITY_JSON },
			})
			if (firstPageRes.ok) {
				const firstPage = (await firstPageRes.json()) as Record<string, unknown>
				return (firstPage.orderedItems || firstPage.items || []) as Activity[]
			}
			return []
		}
		// If 'first' is an object
		const firstPage = collection.first as Record<string, unknown>
		return (firstPage.orderedItems || firstPage.items || []) as Activity[]
	}

	// If it's a Page
	if (collection.type === 'OrderedCollectionPage' || collection.type === 'CollectionPage') {
		return (collection.orderedItems || collection.items || []) as Activity[]
	}

	return []
}

// Private helper
async function fetchRemoteActor(url: string): Promise<{ outbox?: string } | null> {
	try {
		const response = await safeFetch(url, {
			headers: { Accept: ContentType.ACTIVITY_JSON },
		})
		if (!response.ok) return null
		return (await response.json()) as { outbox?: string }
	} catch {
		return null
	}
}

/**
 * Refresh instance metadata (run periodically or on-demand)
 */
export async function refreshInstanceMetadata(domain: string): Promise<void> {
	try {
		const instance = await prisma.instance.findUnique({
			where: { domain },
		})

		if (!instance) {
			return
		}

		const metadata = await fetchInstanceMetadata(instance.baseUrl)
		const now = new Date()

		if (metadata) {
			await prisma.instance.update({
				where: { domain },
				data: {
					software: metadata.software,
					version: metadata.version,
					userCount: metadata.userCount,
					eventCount: metadata.eventCount,
					title: metadata.title,
					description: metadata.description,
					iconUrl: metadata.iconUrl,
					contact: metadata.contact,
					lastFetchedAt: now,
					lastError: null,
					lastErrorAt: null,
				},
			})
		} else {
			await prisma.instance.update({
				where: { domain },
				data: {
					lastError: 'Failed to fetch instance metadata',
					lastErrorAt: now,
				},
			})
		}
	} catch (error) {
		console.error('Error refreshing instance metadata:', error)
		await prisma.instance.update({
			where: { domain },
			data: {
				lastError: error instanceof Error ? error.message : 'Unknown error',
				lastErrorAt: new Date(),
			},
		})
	}
}

/**
 * Get all known instances with statistics
 */
export async function getKnownInstances(options: {
	limit?: number
	offset?: number
	sortBy?: 'activity' | 'users' | 'created'
	filterBlocked?: boolean
}) {
	const { limit = 50, offset = 0, sortBy = 'activity', filterBlocked = true } = options

	const where = filterBlocked ? { isBlocked: false } : {}

	let orderBy
	if (sortBy === 'activity') {
		orderBy = { lastActivityAt: 'desc' as const }
	} else if (sortBy === 'users') {
		orderBy = { userCount: 'desc' as const }
	} else {
		orderBy = { createdAt: 'desc' as const }
	}

	const [instances, total] = await Promise.all([
		prisma.instance.findMany({
			where,
			orderBy,
			skip: offset,
			take: limit,
		}),
		prisma.instance.count({ where }),
	])

	// Skip bulk queries if no instances
	if (instances.length === 0) {
		return {
			instances: [],
			total,
			limit,
			offset,
		}
	}

	// Get connection stats for all instances in bulk to avoid N+1 queries
	// Fetch all related records that might match any instance
	const domains = instances.map((i) => i.domain)
	const [allUsers, allEvents, allFollowings] = await Promise.all([
		prisma.user.findMany({
			where: {
				isRemote: true,
				OR: domains.flatMap((domain) => [
					{ externalActorUrl: { contains: `://${domain}/` } },
					{ externalActorUrl: { contains: `://${domain}:` } },
				]),
			},
			select: { externalActorUrl: true },
		}),
		prisma.event.findMany({
			where: {
				OR: domains.flatMap((domain) => [
					{ externalId: { contains: `://${domain}/` } },
					{ externalId: { contains: `://${domain}:` } },
				]),
			},
			select: { externalId: true },
		}),
		prisma.following.findMany({
			where: {
				OR: domains.flatMap((domain) => [
					{ actorUrl: { contains: `://${domain}/` } },
					{ actorUrl: { contains: `://${domain}:` } },
				]),
			},
			select: { actorUrl: true },
		}),
	])

	// Count matches in memory for each instance
	const instancesWithStats = instances.map((instance) => {
		const urlPatterns = [`://${instance.domain}/`, `://${instance.domain}:`]

		return {
			...instance,
			stats: {
				remoteUsers: allUsers.filter((u) =>
					urlPatterns.some((p) => u.externalActorUrl?.includes(p))
				).length,
				remoteEvents: allEvents.filter((e) =>
					urlPatterns.some((p) => e.externalId?.includes(p))
				).length,
				localFollowing: allFollowings.filter((f) =>
					urlPatterns.some((p) => f.actorUrl?.includes(p))
				).length,
			},
		}
	})

	return {
		instances: instancesWithStats,
		total,
		limit,
		offset,
	}
}

/**
 * Search instances by domain or title
 */
export async function searchInstances(query: string, limit = 20) {
	const instances = await prisma.instance.findMany({
		where: {
			AND: [
				{ isBlocked: false },
				{
					OR: [
						{ domain: { contains: query, mode: 'insensitive' } },
						{ title: { contains: query, mode: 'insensitive' } },
						{ description: { contains: query, mode: 'insensitive' } },
					],
				},
			],
		},
		orderBy: { lastActivityAt: 'desc' },
		take: limit,
	})

	return instances
}

/**
 * Get connection statistics for a specific instance
 */
export async function getInstanceStats(domain: string) {
	const urlPatterns = [`://${domain}/`, `://${domain}:`]

	const [remoteUserCount, remoteEventCount, localFollowingCount, localFollowersCount] =
		await Promise.all([
			prisma.user.count({
				where: {
					isRemote: true,
					OR: urlPatterns.map((pattern) => ({
						externalActorUrl: {
							contains: pattern,
						},
					})),
				},
			}),
			prisma.event.count({
				where: {
					OR: urlPatterns.map((pattern) => ({
						externalId: {
							contains: pattern,
						},
					})),
				},
			}),
			prisma.following.count({
				where: {
					OR: urlPatterns.map((pattern) => ({
						actorUrl: {
							contains: pattern,
						},
					})),
				},
			}),
			prisma.follower.count({
				where: {
					OR: urlPatterns.map((pattern) => ({
						actorUrl: {
							contains: pattern,
						},
					})),
				},
			}),
		])

	return {
		remoteUsers: remoteUserCount,
		remoteEvents: remoteEventCount,
		localFollowing: localFollowingCount,
		localFollowers: localFollowersCount,
	}
}
