/**
 * ActivityPub Helper Functions
 * Utility functions for ActivityPub operations
 */

import { safeFetch } from './ssrfProtection.js'
import { ACTIVITYPUB_CONTEXTS, CollectionType, ContentType } from '../constants/activitypub.js'
import { config } from '../config.js'
import { prisma } from './prisma.js'
import type { Actor } from './activitypubSchemas.js'
import { trackInstance } from './instanceHelpers.js'

const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000
const THIRTY_DAYS_IN_MS = 30 * ONE_DAY_IN_MS

/**
 * Gets the base URL for this instance
 * @returns Base URL (e.g., http://localhost:3000)
 */
export function getBaseUrl(): string {
	return config.baseUrl
}

// resolveWebFinger moved to ./webfinger.ts

/**
 * Fetches an actor from a remote instance
 * @param actorUrl - Actor URL
 * @returns Actor object
 */
export async function fetchActor(actorUrl: string): Promise<Record<string, unknown> | null> {
	const startTime = Date.now()
	try {
		const response = await safeFetch(actorUrl, {
			headers: {
				Accept: `${ContentType.ACTIVITY_JSON}, ${ContentType.LD_JSON}, application/json`,
			},
		})

		const duration = Date.now() - startTime

		if (!response.ok) {
			console.log(`[fetchActor] ${actorUrl} → ${response.status} (${duration}ms)`)
			return null
		}

		// Check content-type before parsing
		const contentType = response.headers.get('content-type') || ''
		if (
			!contentType.includes('application/activity+json') &&
			!contentType.includes('application/ld+json') &&
			!contentType.includes('application/json')
		) {
			console.log(
				`[fetchActor] Skipping non-JSON response from ${actorUrl}: ${contentType} (${duration}ms)`
			)
			return null
		}

		const actor = (await response.json()) as Record<string, unknown>
		console.log(`[fetchActor] ${actorUrl} → OK (${duration}ms)`)
		return actor
	} catch (error) {
		const duration = Date.now() - startTime
		console.log(
			`[fetchActor] ${actorUrl} → ERROR (${duration}ms)`,
			error instanceof Error ? error.message : 'Unknown'
		)
		return null
	}
}

/**
 * Caches a remote user in the database
 * @param actor - Actor object from remote instance
 * @returns User record
 */
export async function cacheRemoteUser(actor: Actor) {
	const actorUrl = actor.id

	// Extract username from actor URL or preferredUsername
	const username = actor.preferredUsername || new URL(actorUrl).pathname.split('/').pop()

	// Extract inbox URLs
	const inboxUrl = actor.inbox
	const sharedInboxUrl = actor.endpoints?.sharedInbox || null

	// Extract public key
	const publicKey = actor.publicKey?.publicKeyPem || null

	// Track the instance this user belongs to
	// This runs in background to not block user interaction
	trackInstance(actorUrl).catch((error) => {
		console.error('Error tracking instance:', error)
	})

	// Extract icon URL - handle both string and object formats
	const getIconUrl = (icon: unknown): string | null => {
		if (!icon) return null
		if (typeof icon === 'string') return icon
		if (icon && typeof icon === 'object' && 'url' in icon) {
			return typeof (icon as { url: unknown }).url === 'string'
				? ((icon as { url: unknown }).url as string)
				: null
		}
		return null
	}

	const profileImageUrl = getIconUrl(actor.icon)
	const headerImageUrl = getIconUrl(actor.image)

	const createdAt = actor.published ? new Date(actor.published) : undefined

	// Upsert user
	return await prisma.user.upsert({
		where: { externalActorUrl: actorUrl },
		update: {
			name: actor.name || username,
			publicKey,
			inboxUrl,
			sharedInboxUrl,
			profileImage: profileImageUrl,
			headerImage: headerImageUrl,
			bio: actor.summary || null,
			displayColor: actor.displayColor || '#3b82f6',
			createdAt: createdAt,
			profileSync: new Date(),
		},
		create: {
			username: `${username}@${new URL(actorUrl).hostname}`,
			name: actor.name || username,
			externalActorUrl: actorUrl,
			isRemote: true,
			publicKey,
			inboxUrl,
			sharedInboxUrl,
			profileImage: profileImageUrl,
			headerImage: headerImageUrl,
			bio: actor.summary || null,
			displayColor: actor.displayColor || '#3b82f6',
			createdAt: createdAt || undefined,
			profileSync: new Date(),
		},
	})
}

/**
 * Caches a remote user by URL - checks cache first before fetching
 * @param actorUrl - URL of the remote actor
 * @returns User record or null if unable to fetch
 */
export async function cacheRemoteUserByUrl(actorUrl: string) {
	// First check if user is already cached in our database
	const startTime = Date.now()
	const cachedUser = await prisma.user.findUnique({
		where: { externalActorUrl: actorUrl },
		select: {
			id: true,
			username: true,
			name: true,
			profileImage: true,
			displayColor: true,
			isRemote: true,
		},
	})

	if (cachedUser) {
		const duration = Date.now() - startTime
		console.log(`[cacheUser] ${actorUrl} → CACHED (${duration}ms) @${cachedUser.username}`)
		return cachedUser
	}

	// If not cached, fetch from remote and cache
	const fetchStartTime = Date.now()
	try {
		const actor = await fetchActor(actorUrl)
		if (actor) {
			const cached = await cacheRemoteUser(actor as Actor)
			const fetchDuration = Date.now() - fetchStartTime
			console.log(
				`[cacheUser] ${actorUrl} → FETCHED (${fetchDuration}ms) @${cached.username}`
			)
			return cached
		}
		console.log(`[cacheUser] ${actorUrl} → NULL (no actor)`)
		return null
	} catch (error) {
		const fetchDuration = Date.now() - fetchStartTime
		console.log(
			`[cacheUser] ${actorUrl} → ERROR (${fetchDuration}ms)`,
			error instanceof Error ? error.message : 'Unknown'
		)
		return null
	}
}

/**
 * Creates an OrderedCollection
 * @param id - Collection ID
 * @param items - Collection items
 * @param totalItems - Total number of items
 * @returns OrderedCollection object
 */
export function createOrderedCollection(id: string, items: unknown[], totalItems?: number) {
	return {
		'@context': ACTIVITYPUB_CONTEXTS,
		id,
		type: CollectionType.ORDERED_COLLECTION,
		totalItems: totalItems ?? items.length,
		orderedItems: items,
	}
}

/**
 * Creates an OrderedCollectionPage
 * @param id - Page ID
 * @param items - Page items
 * @param partOf - Parent collection ID
 * @param next - Next page URL
 * @param prev - Previous page URL
 * @returns OrderedCollectionPage object
 */
export function createOrderedCollectionPage(
	id: string,
	items: unknown[],
	partOf: string,
	next?: string,
	prev?: string
) {
	const page: Record<string, unknown> = {
		'@context': ACTIVITYPUB_CONTEXTS,
		id,
		type: CollectionType.ORDERED_COLLECTION_PAGE,
		partOf,
		orderedItems: items,
	}

	if (next) page.next = next
	if (prev) page.prev = prev

	return page
}

/**
 * Parses an ActivityPub ID to extract components
 * @param id - ActivityPub ID
 * @returns Parsed components
 */
export function parseActivityId(id: string): {
	domain: string
	path: string
	protocol: string
} | null {
	try {
		const url = new URL(id)
		return {
			domain: url.hostname,
			path: url.pathname,
			protocol: url.protocol,
		}
	} catch {
		return null
	}
}

/**
 * Checks if an activity has already been processed
 * @param activityId - Activity ID
 * @returns True if already processed
 */
export async function isActivityProcessed(activityId: string): Promise<boolean> {
	const processed = await prisma.processedActivity.findUnique({
		where: { activityId },
	})
	return processed !== null
}

/**
 * Marks an activity as processed
 * @param activityId - Activity ID
 */
export async function markActivityProcessed(activityId: string): Promise<void> {
	const expiresAt = new Date()
	expiresAt.setTime(expiresAt.getTime() + THIRTY_DAYS_IN_MS) // 30 days TTL

	await prisma.processedActivity.create({
		data: {
			activityId,
			expiresAt,
		},
	})
}

/**
 * Cleans up expired processed activities
 */
export async function cleanupProcessedActivities(): Promise<void> {
	await prisma.processedActivity.deleteMany({
		where: {
			expiresAt: {
				lt: new Date(),
			},
		},
	})
}

/**
 * Checks if a user is blocked
 * @param userId - User ID
 * @param blockedUserId - Potentially blocked user ID
 * @returns True if blocked
 */
export async function isUserBlocked(userId: string, blockedUserId: string): Promise<boolean> {
	const block = await prisma.blockedUser.findUnique({
		where: {
			blockingUserId_blockedUserId: {
				blockingUserId: userId,
				blockedUserId,
			},
		},
	})
	return block !== null
}

/**
 * Checks if a domain is blocked
 * @param domain - Domain name
 * @returns True if blocked
 */
export async function isDomainBlocked(domain: string): Promise<boolean> {
	const block = await prisma.blockedDomain.findUnique({
		where: { domain },
	})
	return block !== null
}

/**
 * Fetches the count of items in a remote collection
 * @param collectionUrl - URL of the collection
 * @returns Count, or null if unable to fetch
 */
export async function fetchRemoteCollectionCount(collectionUrl: string): Promise<number | null> {
	const startTime = Date.now()
	try {
		const response = await safeFetch(collectionUrl, {
			headers: {
				Accept: `${ContentType.ACTIVITY_JSON}, ${ContentType.LD_JSON}, application/json`,
			},
		})

		const duration = Date.now() - startTime

		if (!response.ok) {
			console.log(`[collectionCount] ${collectionUrl} → ${response.status} (${duration}ms)`)
			return null
		}

		const collection = (await response.json()) as { totalItems?: number | string }

		// Extract totalItems from the collection
		if (collection.totalItems !== undefined) {
			const count =
				typeof collection.totalItems === 'number'
					? collection.totalItems
					: parseInt(collection.totalItems, 10)
			console.log(`[collectionCount] ${collectionUrl} → ${count} (${duration}ms)`)
			return count
		}

		console.log(`[collectionCount] ${collectionUrl} → null (no totalItems) (${duration}ms)`)
		return null
	} catch (error) {
		const duration = Date.now() - startTime
		console.log(
			`[collectionCount] ${collectionUrl} → ERROR (${duration}ms)`,
			error instanceof Error ? error.message : 'Unknown'
		)
		return null
	}
}

/**
 * Fetches items from a remote collection (followers, following, etc)
 * @param collectionUrl - URL of the collection
 * @returns Array of items, or empty array if unable to fetch
 */
export async function fetchRemoteCollectionItems<T = unknown>(collectionUrl: string): Promise<T[]> {
	const startTime = Date.now()
	try {
		const response = await safeFetch(collectionUrl, {
			headers: {
				Accept: `${ContentType.ACTIVITY_JSON}, ${ContentType.LD_JSON}, application/json`,
			},
		})

		const duration = Date.now() - startTime

		if (!response.ok) {
			console.log(`[collectionItems] ${collectionUrl} → ${response.status} (${duration}ms)`)
			return []
		}

		const collection = (await response.json()) as {
			orderedItems?: T[]
			items?: T[]
			first?: { orderedItems?: T[]; items?: T[] }
			totalItems?: number
		}

		// Get items from the collection
		let items = collection.orderedItems || collection.items || []

		// If there's a 'first' page, fetch it (common for paged collections)
		if (collection.first && items.length === 0) {
			const firstUrl =
				typeof collection.first === 'string'
					? collection.first
					: (collection.first as { id?: string }).id
			if (firstUrl) {
				const firstStartTime = Date.now()
				const firstResponse = await safeFetch(firstUrl, {
					headers: {
						Accept: ContentType.ACTIVITY_JSON,
					},
				})
				const firstDuration = Date.now() - firstStartTime
				if (firstResponse.ok) {
					const firstPage = (await firstResponse.json()) as {
						orderedItems?: T[]
						items?: T[]
					}
					items = firstPage.orderedItems || firstPage.items || []
					console.log(
						`[collectionItems] ${firstUrl} → ${items.length} items (${firstDuration}ms)`
					)
				} else {
					console.log(
						`[collectionItems] ${firstUrl} → ${firstResponse.status} (${firstDuration}ms)`
					)
				}
			}
		}

		console.log(`[collectionItems] ${collectionUrl} → ${items.length} items (${duration}ms)`)
		return items
	} catch (error) {
		const duration = Date.now() - startTime
		console.log(
			`[collectionItems] ${collectionUrl} → ERROR (${duration}ms)`,
			error instanceof Error ? error.message : 'Unknown'
		)
		return []
	}
}

// Helper function to extract location value from event location
type EventLocationType = string | Record<string, unknown> | undefined

export function extractLocationValue(eventLocation: EventLocationType): string | null {
	if (!eventLocation) return null
	if (typeof eventLocation === 'string') return eventLocation
	if (typeof eventLocation === 'object' && 'name' in eventLocation) {
		return eventLocation.name as string
	}
	return null
}

// Helper function to cache event from remote outbox activity
export async function cacheEventFromOutboxActivity(
	activityObj: Record<string, unknown>,
	userExternalActorUrl: string
) {
	const activityType = activityObj.type
	const activityObject = activityObj.object as Record<string, unknown> | undefined

	if (!isValidEventCreateActivity(activityType, activityObject)) {
		return
	}

	if (!activityObject) return

	const eventObj = (activityObject.object || activityObject) as Record<string, unknown>
	const eventId = eventObj.id as string | undefined
	const eventName = eventObj.name as string | undefined
	const eventStartTime = eventObj.startTime as string | undefined

	if (!eventId || !eventName || !eventStartTime) {
		return
	}

	const eventEndTime = eventObj.endTime as string | undefined
	const eventDuration = eventObj.duration as string | undefined
	const eventUrl = eventObj.url as string | undefined
	const eventStatus = eventObj.eventStatus as string | undefined
	const eventAttendanceMode = eventObj.eventAttendanceMode as string | undefined
	const eventMaxCapacity = eventObj.maximumAttendeeCapacity as number | undefined
	const eventAttachment = eventObj.attachment as Array<{ url?: string }> | undefined
	const eventSummary = (eventObj.summary || eventObj.content) as string | undefined
	const eventLocation = eventObj.location as string | Record<string, unknown> | undefined

	const locationValue = extractLocationValue(eventLocation)

	const organizerData = extractOrganizerData(eventObj, userExternalActorUrl)

	const eventData = {
		title: eventName,
		summary: eventSummary || null,
		location: locationValue,
		startTime: new Date(eventStartTime),
		endTime: eventEndTime ? new Date(eventEndTime) : null,
		duration: eventDuration || null,
		url: eventUrl || null,
		eventStatus: eventStatus || null,
		eventAttendanceMode: eventAttendanceMode || null,
		maximumAttendeeCapacity: eventMaxCapacity || null,
		headerImage: eventAttachment?.[0]?.url || null,
		attributedTo: organizerData.primaryAttributedTo,
		organizers: organizerData.organizers.length > 0 ? organizerData.organizers : undefined,
	}

	await prisma.event.upsert({
		where: { externalId: eventId },
		update: eventData,
		create: {
			...eventData,
			externalId: eventId,
			userId: null,
		},
	})
}

function isValidEventCreateActivity(
	activityType: unknown,
	activityObject: Record<string, unknown> | undefined
): boolean {
	if (activityType !== 'Create' || !activityObject || activityObject.type !== 'Event') {
		return false
	}
	if ((activityObject as unknown as { type?: unknown }).type === 'Announce') {
		return false
	}
	return true
}

function extractOrganizerData(eventObj: Record<string, unknown>, userExternalActorUrl: string) {
	const rawAttributedTo = extractStringArray(eventObj.attributedTo)
	const rawContacts = extractStringArray(eventObj.contacts)
	const organizerUrls = [...new Set([...rawAttributedTo, ...rawContacts])] as string[]

	let primaryAttributedTo = userExternalActorUrl
	if (rawAttributedTo.length > 0) {
		primaryAttributedTo = rawAttributedTo[0]
	}

	const organizerObj = eventObj.organizer as Record<string, unknown> | string | undefined
	if (organizerObj) {
		if (typeof organizerObj === 'string') {
			primaryAttributedTo = organizerObj
			if (!organizerUrls.includes(organizerObj)) organizerUrls.unshift(organizerObj)
		} else if (
			typeof organizerObj === 'object' &&
			'id' in organizerObj &&
			typeof organizerObj.id === 'string'
		) {
			primaryAttributedTo = organizerObj.id
			if (!organizerUrls.includes(organizerObj.id)) organizerUrls.unshift(organizerObj.id)
		}
	}

	const organizers = formatOrganizers(organizerUrls)

	return { primaryAttributedTo, organizers }
}

function extractStringArray(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.filter((item): item is string => typeof item === 'string')
	}
	if (typeof value === 'string') {
		return [value]
	}
	return []
}

function formatOrganizers(organizerUrls: string[]) {
	return organizerUrls.map((url) => {
		try {
			const u = new URL(url)
			const pathParts = u.pathname.split('/').filter(Boolean)
			const username =
				pathParts.find((p) => p.startsWith('@'))?.replace('@', '') ||
				pathParts[pathParts.length - 1]
			return {
				url,
				username: username || 'unknown',
				host: u.hostname,
				display: username ? `@${username}@${u.hostname}` : u.hostname,
			}
		} catch (error) {
			console.error(`Failed to parse organizer URL: ${url}`, error)
			return { url, username: 'unknown', host: 'unknown', display: url }
		}
	})
}
