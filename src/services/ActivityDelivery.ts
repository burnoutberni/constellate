/**
 * Activity Delivery Service
 * Handles delivery of ActivityPub activities to remote inboxes
 */

import { PrismaClient } from '@prisma/client'
import { signRequest, createDigest } from '../lib/httpSignature.js'
import { safeFetch } from '../lib/ssrfProtection.js'
import { getBaseUrl } from '../lib/activitypubHelpers.js'
import { resolveInboxes } from '../lib/audience.js'
import type { Addressing } from '../lib/audience.js'
import { ContentType } from '../constants/activitypub.js'

const prisma = new PrismaClient()

/**
 * Delivers an activity to a single inbox
 * @param activity - ActivityPub activity
 * @param inboxUrl - Inbox URL
 * @param user - User sending the activity
 */
export async function deliverToInbox(
    activity: any,
    inboxUrl: string,
    user: { username: string; privateKey: string | null }
): Promise<boolean> {
    try {
        if (!user.privateKey) {
            console.error('User has no private key for signing')
            return false
        }

        const baseUrl = getBaseUrl()
        const actorUrl = `${baseUrl}/users/${user.username}`
        const keyId = `${actorUrl}#main-key`

        // Prepare request
        const url = new URL(inboxUrl)
        const body = JSON.stringify(activity)
        const digest = await createDigest(body)
        const date = new Date().toUTCString()

        // Use host:port if port is not default, otherwise just hostname
        const hostHeader = url.port && url.port !== '80' && url.port !== '443'
            ? `${url.hostname}:${url.port}`
            : url.hostname

        const headers: Record<string, string> = {
            host: hostHeader,
            date,
            digest,
            'content-type': ContentType.ACTIVITY_JSON,
        }

        // Sign request
        const signature = signRequest(
            user.privateKey,
            keyId,
            'POST',
            url.pathname + url.search,
            headers
        )

        // Send request
        const response = await safeFetch(inboxUrl, {
            method: 'POST',
            headers: {
                ...headers,
                signature,
            },
            body,
        })

        if (!response.ok) {
            console.error(
                `Failed to deliver to ${inboxUrl}: ${response.status} ${response.statusText}`
            )
            return false
        }

        return true
    } catch (error) {
        console.error(`Error delivering to ${inboxUrl}:`, error)
        return false
    }
}

/**
 * Delivers an activity to multiple inboxes
 * @param activity - ActivityPub activity
 * @param inboxUrls - Array of inbox URLs
 * @param user - User sending the activity
 */
export async function deliverToInboxes(
    activity: any,
    inboxUrls: string[],
    user: { username: string; privateKey: string | null }
): Promise<void> {
    // Deduplicate inboxes
    const uniqueInboxes = Array.from(new Set(inboxUrls))

    // Deliver to all inboxes in parallel
    const promises = uniqueInboxes.map((inbox) =>
        deliverToInbox(activity, inbox, user)
    )

    await Promise.allSettled(promises)
}

/**
 * Delivers an activity to a user's followers
 * @param activity - ActivityPub activity
 * @param userId - User ID
 */
export async function deliverToFollowers(
    activity: any,
    userId: string
): Promise<void> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
    })

    if (!user) {
        throw new Error('User not found')
    }

    // Get follower inboxes
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

    const inboxUrls = Array.from(inboxMap.values())

    await deliverToInboxes(activity, inboxUrls, user)
}

/**
 * Delivers an activity to specific actors
 * @param activity - ActivityPub activity
 * @param actorUrls - Array of actor URLs
 * @param userId - User ID sending the activity
 */
export async function deliverToActors(
    activity: any,
    actorUrls: string[],
    userId: string
): Promise<void> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
    })

    if (!user) {
        throw new Error('User not found')
    }

    const baseUrl = getBaseUrl()
    const inboxUrls: string[] = []

    for (const actorUrl of actorUrls) {
        // Skip local users
        if (actorUrl.startsWith(baseUrl)) {
            continue
        }

        // Get cached user
        const remoteUser = await prisma.user.findUnique({
            where: { externalActorUrl: actorUrl },
        })

        if (remoteUser && remoteUser.inboxUrl) {
            inboxUrls.push(remoteUser.sharedInboxUrl || remoteUser.inboxUrl)
        }
    }

    await deliverToInboxes(activity, inboxUrls, user)
}

/**
 * Delivers an activity using addressing
 * @param activity - ActivityPub activity
 * @param addressing - Addressing object
 * @param userId - User ID sending the activity
 */
export async function deliverActivity(
    activity: any,
    addressing: Addressing,
    userId: string
): Promise<void> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
    })

    if (!user) {
        throw new Error('User not found')
    }

    // Resolve addressing to inbox URLs
    const inboxUrls = await resolveInboxes(addressing, userId)

    await deliverToInboxes(activity, inboxUrls, user)
}

/**
 * Delivers an activity with retry logic
 * @param activity - ActivityPub activity
 * @param inboxUrl - Inbox URL
 * @param user - User sending the activity
 * @param maxRetries - Maximum number of retries
 */
export async function deliverWithRetry(
    activity: any,
    inboxUrl: string,
    user: { username: string; privateKey: string | null },
    maxRetries: number = 3
): Promise<boolean> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const success = await deliverToInbox(activity, inboxUrl, user)
        if (success) {
            return true
        }

        // Exponential backoff
        if (attempt < maxRetries - 1) {
            const delay = Math.pow(2, attempt) * 1000
            await new Promise((resolve) => setTimeout(resolve, delay))
        }
    }

    return false
}
