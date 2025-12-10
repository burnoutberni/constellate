/**
 * Audience Addressing Logic
 * Determines recipients for ActivityPub activities
 */

import { PUBLIC_COLLECTION } from '../constants/activitypub.js'
import { getBaseUrl } from './activitypubHelpers.js'
import { prisma } from './prisma.js'

export interface Addressing {
    to: string[]
    cc: string[]
    bcc: string[]
}

/**
 * Gets addressing for a public activity
 * @param userId - User ID
 * @returns Addressing with public collection and followers
 */
export async function getPublicAddressing(userId: string): Promise<Addressing> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
    })

    if (!user) {
        throw new Error('User not found')
    }

    const baseUrl = getBaseUrl()
    const followersUrl = `${baseUrl}/users/${user.username}/followers`

    return {
        to: [PUBLIC_COLLECTION],
        cc: [followersUrl],
        bcc: [],
    }
}

/**
 * Gets addressing for followers-only activity
 * @param userId - User ID
 * @returns Addressing with followers collection
 */
export async function getFollowersAddressing(userId: string): Promise<Addressing> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
    })

    if (!user) {
        throw new Error('User not found')
    }

    const baseUrl = getBaseUrl()
    const followersUrl = `${baseUrl}/users/${user.username}/followers`

    return {
        to: [followersUrl],
        cc: [],
        bcc: [],
    }
}

/**
 * Gets addressing for a direct activity to specific actors
 * @param actorUrls - Array of actor URLs
 * @returns Addressing with specific actors
 */
export function getDirectAddressing(actorUrls: string[]): Addressing {
    return {
        to: actorUrls,
        cc: [],
        bcc: [],
    }
}

/**
 * Gets all inbox URLs for a user's followers
 * @param userId - User ID
 * @returns Array of inbox URLs (preferring shared inbox)
 */
export async function getFollowerInboxes(userId: string): Promise<string[]> {
    const followers = await prisma.follower.findMany({
        where: {
            userId,
            accepted: true,
        },
    })

    // Deduplicate by shared inbox
    const inboxMap = new Map<string, string>()

    for (const follower of followers) {
        const inbox = follower.sharedInboxUrl || follower.inboxUrl
        inboxMap.set(inbox, inbox)
    }

    return Array.from(inboxMap.values())
}

/**
 * Gets inbox URLs for specific actors
 * @param actorUrls - Array of actor URLs
 * @returns Array of inbox URLs
 */
export async function getActorInboxes(actorUrls: string[]): Promise<string[]> {
    const inboxes: string[] = []

    for (const actorUrl of actorUrls) {
        // Check if it's a local user
        const baseUrl = getBaseUrl()
        if (actorUrl.startsWith(baseUrl)) {
            const username = actorUrl.split('/').pop()
            const user = await prisma.user.findUnique({
                where: { username },
            })
            if (user && !user.isRemote) {
                // Local user - skip (handle locally)
                continue
            }
        }

        // Check if we have the user cached
        const user = await prisma.user.findUnique({
            where: { externalActorUrl: actorUrl },
        })

        if (user && user.inboxUrl) {
            inboxes.push(user.sharedInboxUrl || user.inboxUrl)
        }
    }

    return inboxes
}

/**
 * Resolves addressing to actual inbox URLs
 * @param addressing - Addressing object
 * @param userId - User ID (for followers collection)
 * @returns Array of inbox URLs
 */

/**
 * Processes a single recipient and adds their inbox(es) to the set.
 * 
 * Handles three recipient types:
 * - PUBLIC_COLLECTION: Resolves to all follower inboxes
 * - Followers collection URL: Resolves to specific user's follower inboxes
 * - Actor URL: Resolves to the specific actor's inbox
 * 
 * @param recipient - The recipient URL or collection identifier
 * @param senderUserId - The user ID of the sender (for resolving follower collections)
 * @param inboxes - Set to accumulate inbox URLs (modified in place)
 */
async function processRecipient(recipient: string, senderUserId: string, inboxes: Set<string>): Promise<void> {
    if (recipient === PUBLIC_COLLECTION) {
        const followerInboxes = await getFollowerInboxes(senderUserId)
        followerInboxes.forEach(inbox => inboxes.add(inbox))
    } else if (recipient.endsWith('/followers')) {
        const baseUrl = getBaseUrl()
        if (recipient.startsWith(baseUrl)) {
            const username = recipient.replace(`${baseUrl}/users/`, '').replace('/followers', '')
            const targetUser = await prisma.user.findUnique({
                where: { username, isRemote: false },
            })
            if (targetUser) {
                const followerInboxes = await getFollowerInboxes(targetUser.id)
                followerInboxes.forEach(inbox => inboxes.add(inbox))
            }
        }
    } else {
        const actorInboxes = await getActorInboxes([recipient])
        actorInboxes.forEach(inbox => inboxes.add(inbox))
    }
}

// Maximum number of recipients to process concurrently to avoid overwhelming the database
const MAX_CONCURRENT_RECIPIENTS = 10

/**
 * Processes recipients in batches to prevent overwhelming the database connection pool.
 * 
 * @param recipients - Array of recipient URLs to process
 * @param senderUserId - The user ID of the sender
 * @param inboxes - Set to accumulate inbox URLs
 */
async function processRecipientsInBatches(
    recipients: string[],
    senderUserId: string,
    inboxes: Set<string>
): Promise<void> {
    // Process recipients in batches to limit concurrent database queries
    for (let i = 0; i < recipients.length; i += MAX_CONCURRENT_RECIPIENTS) {
        const batch = recipients.slice(i, i + MAX_CONCURRENT_RECIPIENTS)
        
        // Use Promise.allSettled instead of Promise.all to ensure one failed recipient
        // doesn't block processing of others. In federation, it's better to deliver to
        // some recipients than to fail completely if one recipient resolution fails.
        const results = await Promise.allSettled(
            batch.map(recipient => processRecipient(recipient, senderUserId, inboxes))
        )
        
        // Log any failures but continue processing
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                console.error(`Failed to process recipient ${batch[index]}:`, result.reason)
            }
        })
    }
}

/**
 * Resolves addressing to actual inbox URLs for activity delivery.
 * 
 * Performance considerations:
 * - Uses batched concurrent processing to balance speed and resource usage
 * - Limits concurrent database queries to MAX_CONCURRENT_RECIPIENTS to prevent
 *   overwhelming the connection pool
 * - Uses Promise.allSettled to handle partial failures gracefully (ensures delivery
 *   to available recipients even if some fail)
 * 
 * @param addressing - Addressing object with to, cc, and bcc arrays
 * @param userId - User ID of the sender (for resolving follower collections)
 * @returns Array of unique inbox URLs to deliver to
 */
export async function resolveInboxes(
    addressing: Addressing,
    userId: string
): Promise<string[]> {
    const inboxes = new Set<string>()

    // Process 'to' and 'cc' recipients in batches
    const toAndCc = [...addressing.to, ...addressing.cc]
    await processRecipientsInBatches(toAndCc, userId, inboxes)

    // Process 'bcc' recipients in batches (same as 'to' but not included in activity)
    // Note: bcc is typically used for direct messages or private addressing
    if (addressing.bcc.length > 0) {
        await processRecipientsInBatches(addressing.bcc, userId, inboxes)
    }

    return Array.from(inboxes)
}
