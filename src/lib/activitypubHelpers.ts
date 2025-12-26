/**
 * ActivityPub Helper Functions
 * Utility functions for ActivityPub operations
 */

import { safeFetch } from './ssrfProtection.js'
import { ACTIVITYPUB_CONTEXTS, CollectionType, ContentType } from '../constants/activitypub.js'
import { config } from '../config.js'
import { prisma } from './prisma.js'
import type { Person } from './activitypubSchemas.js'
import { trackInstance } from './instanceHelpers.js'

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
	try {
		const response = await safeFetch(actorUrl, {
			headers: {
				Accept: ContentType.ACTIVITY_JSON,
			},
		})

		if (!response.ok) {
			return null
		}

		return (await response.json()) as Record<string, unknown>
	} catch (error) {
		console.error('Error fetching actor:', error)
		return null
	}
}

/**
 * Caches a remote user in the database
 * @param actor - Actor object from remote instance
 * @returns User record
 */
export async function cacheRemoteUser(actor: Person) {
	const actorUrl = actor.id

	// Extract username from actor URL or preferredUsername
	const username = actor.preferredUsername || new URL(actorUrl).pathname.split('/').pop()

	// Extract inbox URLs
	const inboxUrl = actor.inbox
	const sharedInboxUrl = actor.endpoints?.sharedInbox || null

	// Extract public key
	const publicKey = actor.publicKey?.publicKeyPem || null

	try {
		// Track the instance this user belongs to
		// This runs in background to not block user interaction
		void trackInstance(actorUrl)
	} catch (error) {
		console.error('Error tracking instance:', error)
	}

	// Upsert user
	return await prisma.user.upsert({
		where: { externalActorUrl: actorUrl },
		update: {
			name: actor.name || username,
			publicKey,
			inboxUrl,
			sharedInboxUrl,
			profileImage: actor.icon?.url || null,
			headerImage: actor.image?.url || null,
			bio: actor.summary || null,
			displayColor: actor.displayColor || '#3b82f6',
		},
		create: {
			username: `${username}@${new URL(actorUrl).hostname}`,
			name: actor.name || username,
			externalActorUrl: actorUrl,
			isRemote: true,
			publicKey,
			inboxUrl,
			sharedInboxUrl,
			profileImage: actor.icon?.url || null,
			headerImage: actor.image?.url || null,
			bio: actor.summary || null,
			displayColor: actor.displayColor || '#3b82f6',
		},
	})
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
	expiresAt.setDate(expiresAt.getDate() + 30) // 30 days TTL

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
 * Fetches follower count from a remote user's ActivityPub followers collection
 * @param actorUrl - Remote user's actor URL
 * @returns Follower count, or null if unable to fetch
 */
export async function fetchRemoteFollowerCount(actorUrl: string): Promise<number | null> {
	try {
		// Construct followers collection URL
		const followersUrl = `${actorUrl}/followers`

		const response = await safeFetch(followersUrl, {
			headers: {
				Accept: ContentType.ACTIVITY_JSON,
			},
		})

		if (!response.ok) {
			console.error(`Failed to fetch followers collection: ${response.status}`)
			return null
		}

		const collection = (await response.json()) as { totalItems?: number | string }

		// Extract totalItems from the collection
		if (collection.totalItems !== undefined) {
			return typeof collection.totalItems === 'number'
				? collection.totalItems
				: parseInt(collection.totalItems, 10)
		}

		return null
	} catch (error) {
		console.error('Error fetching remote follower count:', error)
		return null
	}
}

// Helper function to extract location value from event location
export function extractLocationValue(
	eventLocation: string | Record<string, unknown> | undefined
): string | null {
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

	if (activityType !== 'Create' || !activityObject || activityObject.type !== 'Event') {
		return
	}

	const eventObj = activityObject as Record<string, unknown>
	const eventId = eventObj.id as string | undefined
	const eventName = eventObj.name as string | undefined
	const eventSummary = (eventObj.summary || eventObj.content) as string | undefined
	const eventLocation = eventObj.location as string | Record<string, unknown> | undefined
	const eventStartTime = eventObj.startTime as string | undefined
	const eventEndTime = eventObj.endTime as string | undefined
	const eventDuration = eventObj.duration as string | undefined
	const eventUrl = eventObj.url as string | undefined
	const eventStatus = eventObj.eventStatus as string | undefined
	const eventAttendanceMode = eventObj.eventAttendanceMode as string | undefined
	const eventMaxCapacity = eventObj.maximumAttendeeCapacity as number | undefined
	const eventAttachment = eventObj.attachment as Array<{ url?: string }> | undefined

	if (!eventId || !eventName || !eventStartTime) return

	const locationValue = extractLocationValue(eventLocation)

	await prisma.event.upsert({
		where: { externalId: eventId },
		update: {
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
			attributedTo: userExternalActorUrl,
		},
		create: {
			externalId: eventId,
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
			attributedTo: userExternalActorUrl,
			userId: null,
		},
	})
}
