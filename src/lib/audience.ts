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
async function processRecipient(recipient: string, senderUserId: string, inboxes: Set<string>): Promise<void> {
    if (recipient === PUBLIC_COLLECTION) {
        const followerInboxes = await getFollowerInboxes(senderUserId);
        followerInboxes.forEach(inbox => inboxes.add(inbox));
    } else if (recipient.endsWith('/followers')) {
        const baseUrl = getBaseUrl();
        if (recipient.startsWith(baseUrl)) {
            const username = recipient.replace(`${baseUrl}/users/`, '').replace('/followers', '');
            const targetUser = await prisma.user.findUnique({
                where: { username, isRemote: false },
            });
            if (targetUser) {
                const followerInboxes = await getFollowerInboxes(targetUser.id);
                followerInboxes.forEach(inbox => inboxes.add(inbox));
            }
        }
    } else {
        const actorInboxes = await getActorInboxes([recipient]);
        actorInboxes.forEach(inbox => inboxes.add(inbox));
    }
}

export async function resolveInboxes(
    addressing: Addressing,
    userId: string
): Promise<string[]> {
    const inboxes = new Set<string>()

    const toAndCc = [...addressing.to, ...addressing.cc]

    for (const recipient of toAndCc) {
        await processRecipient(recipient, userId, inboxes)
    }

    // Process 'bcc' field (same as 'to' but not included in activity)
    for (const recipient of addressing.bcc) {
        const actorInboxes = await getActorInboxes([recipient])
        actorInboxes.forEach((inbox) => inboxes.add(inbox))
    }

    return Array.from(inboxes)
}
