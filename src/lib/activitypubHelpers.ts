/**
 * ActivityPub Helper Functions
 * Utility functions for ActivityPub operations
 */

import { safeFetch } from './ssrfProtection.js'
import {
    ACTIVITYPUB_CONTEXTS,
    CollectionType,
    ContentType,
    PAGINATION,
} from '../constants/activitypub.js'
import { config } from '../config.js'
import { prisma } from './prisma.js'

/**
 * Gets the base URL for this instance
 * @returns Base URL (e.g., http://localhost:3000)
 */
export function getBaseUrl(): string {
    return config.baseUrl
}

/**
 * Resolves a WebFinger resource
 * @param resource - Resource identifier (e.g., acct:user@domain)
 * @returns Actor URL
 */
export async function resolveWebFinger(resource: string): Promise<string | null> {
    try {
        // Parse resource (acct:username@domain)
        const match = resource.match(/^acct:([^@]+)@(.+)$/)
        if (!match) {
            return null
        }

        const [, username, domain] = match

        // Use http:// for .local domains in development, https:// otherwise
        const protocol = (process.env.NODE_ENV === 'development' && domain.endsWith('.local')) ? 'http' : 'https'
        const webfingerUrl = `${protocol}://${domain}/.well-known/webfinger?resource=${encodeURIComponent(resource)}`

        const response = await safeFetch(webfingerUrl, {
            headers: {
                Accept: ContentType.JSON,
            },
        })

        if (!response.ok) {
            return null
        }

        const data: any = await response.json()

        // Find the ActivityPub link
        const apLink = data.links?.find(
            (link: any) => link.rel === 'self' && link.type === ContentType.ACTIVITY_JSON
        )

        return apLink?.href || null
    } catch (error) {
        console.error('WebFinger resolution error:', error)
        return null
    }
}

/**
 * Fetches an actor from a remote instance
 * @param actorUrl - Actor URL
 * @returns Actor object
 */
export async function fetchActor(actorUrl: string): Promise<any | null> {
    try {
        const response = await safeFetch(actorUrl, {
            headers: {
                Accept: ContentType.ACTIVITY_JSON,
            },
        })

        if (!response.ok) {
            return null
        }

        return await response.json()
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
export async function cacheRemoteUser(actor: any) {
    const actorUrl = actor.id

    // Extract username from actor URL or preferredUsername
    const username = actor.preferredUsername || actorUrl.split('/').pop()

    // Extract inbox URLs
    const inboxUrl = actor.inbox
    const sharedInboxUrl = actor.endpoints?.sharedInbox || null

    // Extract public key
    const publicKey = actor.publicKey?.publicKeyPem || null

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
export function createOrderedCollection(
    id: string,
    items: any[],
    totalItems?: number
) {
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
    items: any[],
    partOf: string,
    next?: string,
    prev?: string
) {
    const page: any = {
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
    } catch (error) {
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
export async function isUserBlocked(
    userId: string,
    blockedUserId: string
): Promise<boolean> {
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

        const collection = await response.json()

        // Extract totalItems from the collection
        if (collection.totalItems !== undefined) {
            return typeof collection.totalItems === 'number' ? collection.totalItems : parseInt(collection.totalItems, 10)
        }

        return null
    } catch (error) {
        console.error('Error fetching remote follower count:', error)
        return null
    }
}
