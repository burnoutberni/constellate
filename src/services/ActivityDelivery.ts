/**
 * Activity Delivery Service
 * Handles delivery of ActivityPub activities to remote inboxes
 */

import { signRequest, createDigest } from '../lib/httpSignature.js'
import { safeFetch } from '../lib/ssrfProtection.js'
import { getBaseUrl } from '../lib/activitypubHelpers.js'
import { resolveInboxes } from '../lib/audience.js'
import type { Addressing } from '../lib/audience.js'
import { ContentType } from '../constants/activitypub.js'
import { decryptPrivateKey } from '../lib/encryption.js'
import { prisma } from '../lib/prisma.js'
import type { Prisma } from '../generated/prisma/client.js'
import type { Activity } from '../lib/activitypubSchemas.js'

interface DeliveryError {
	message: string
	code?: string
	statusCode?: number
}

/**
 * Logs a structured error for federation issues
 */
function logFederationError(
	context: string,
	inboxUrl: string,
	activity: Activity,
	error: DeliveryError
): void {
	console.error(`[Federation Error] ${context}`, {
		timestamp: new Date().toISOString(),
		inboxUrl,
		activityId: activity.id,
		activityType: activity.type,
		error: {
			message: error.message,
			code: error.code,
			statusCode: error.statusCode,
		},
	})
}

/**
 * Adds a failed delivery to the dead letter queue
 */
async function addToDeadLetterQueue(
	activity: Activity,
	inboxUrl: string,
	userId: string,
	error: DeliveryError,
	attemptCount: number = 0
): Promise<void> {
	try {
		const nextRetryAt = calculateNextRetry(attemptCount)

		await prisma.failedDelivery.create({
			data: {
				activityId: activity.id,
				activityType: activity.type,
				activity: activity as Prisma.InputJsonValue,
				inboxUrl,
				userId,
				lastError: error.message,
				lastErrorCode: error.code || error.statusCode?.toString(),
				lastAttemptAt: new Date(),
				attemptCount,
				nextRetryAt,
				status: attemptCount < 3 ? 'PENDING' : 'FAILED',
			},
		})

		console.log(`[Dead Letter Queue] Added failed delivery: ${activity.id} -> ${inboxUrl}`)
	} catch (err) {
		console.error('[Dead Letter Queue] Failed to add to queue:', err)
	}
}

/**
 * Calculates the next retry time using exponential backoff
 */
function calculateNextRetry(attemptCount: number): Date {
	const baseDelay = 1000 // 1 second
	const maxDelay = 3600000 // 1 hour
	const delay = Math.min(baseDelay * Math.pow(2, attemptCount), maxDelay)
	return new Date(Date.now() + delay)
}

/**
 * Delivers an activity to a single inbox
 * @param activity - ActivityPub activity
 * @param inboxUrl - Inbox URL
 * @param user - User sending the activity
 * @param recordFailure - Whether to record failures in dead letter queue
 */
export async function deliverToInbox(
	activity: Activity,
	inboxUrl: string,
	user: { id?: string; username: string; privateKey: string | null },
	recordFailure: boolean = false
): Promise<boolean> {
	try {
		if (!user.privateKey) {
			const error: DeliveryError = {
				message: 'User has no private key for signing',
				code: 'NO_PRIVATE_KEY',
			}
			logFederationError('Delivery failed', inboxUrl, activity, error)
			return false
		}

		// Decrypt private key before use
		const decryptedPrivateKey = decryptPrivateKey(user.privateKey)
		if (!decryptedPrivateKey) {
			const error: DeliveryError = {
				message: 'Failed to decrypt private key for signing',
				code: 'DECRYPTION_FAILED',
			}
			logFederationError('Delivery failed', inboxUrl, activity, error)
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
		const hostHeader =
			url.port && url.port !== '80' && url.port !== '443'
				? `${url.hostname}:${url.port}`
				: url.hostname

		const headers: Record<string, string> = {
			host: hostHeader,
			date,
			digest,
			'content-type': ContentType.ACTIVITY_JSON,
		}

		// Sign request with decrypted key
		const signature = signRequest(
			decryptedPrivateKey,
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
			const error: DeliveryError = {
				message: `HTTP ${response.status}: ${response.statusText}`,
				statusCode: response.status,
			}
			logFederationError('Delivery failed', inboxUrl, activity, error)

			if (recordFailure && user.id) {
				await addToDeadLetterQueue(activity, inboxUrl, user.id, error, 0)
			}

			return false
		}

		return true
	} catch (error) {
		const deliveryError: DeliveryError = {
			message: error instanceof Error ? error.message : 'Unknown error',
			code: 'NETWORK_ERROR',
		}
		logFederationError('Delivery failed', inboxUrl, activity, deliveryError)

		if (recordFailure && user.id) {
			await addToDeadLetterQueue(activity, inboxUrl, user.id, deliveryError, 0)
		}

		return false
	}
}

/**
 * Delivers an activity to multiple inboxes with retry logic
 * @param activity - ActivityPub activity
 * @param inboxUrls - Array of inbox URLs
 * @param user - User sending the activity
 * @param useRetry - Whether to use retry logic (default: true)
 */
export async function deliverToInboxes(
	activity: Activity,
	inboxUrls: string[],
	user: { id?: string; username: string; privateKey: string | null },
	useRetry: boolean = true
): Promise<void> {
	// Deduplicate inboxes
	const uniqueInboxes = Array.from(new Set(inboxUrls))

	// Deliver to all inboxes in parallel with retry
	const promises = uniqueInboxes.map((inbox) =>
		useRetry
			? deliverWithRetry(activity, inbox, user, 3, true)
			: deliverToInbox(activity, inbox, user, false)
	)

	await Promise.allSettled(promises)
}

/**
 * Delivers an activity to a user's followers
 * @param activity - ActivityPub activity
 * @param userId - User ID
 */
export async function deliverToFollowers(activity: Activity, userId: string): Promise<void> {
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
	activity: Activity,
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
	activity: Activity,
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
 * @param recordFailure - Whether to record final failure in dead letter queue
 */
export async function deliverWithRetry(
	activity: Activity,
	inboxUrl: string,
	user: { id?: string; username: string; privateKey: string | null },
	maxRetries: number = 3,
	recordFailure: boolean = true
): Promise<boolean> {
	for (let attempt = 0; attempt < maxRetries; attempt++) {
		const success = await deliverToInbox(activity, inboxUrl, user, false)
		if (success) {
			return true
		}

		// Exponential backoff
		if (attempt < maxRetries - 1) {
			const delay = Math.pow(2, attempt) * 1000
			await new Promise((resolve) => setTimeout(resolve, delay))
		}
	}

	// After all retries failed, add to dead letter queue
	if (recordFailure && user.id) {
		await addToDeadLetterQueue(
			activity,
			inboxUrl,
			user.id,
			{ message: 'All retry attempts failed', code: 'MAX_RETRIES_EXCEEDED' },
			maxRetries
		)
	}

	return false
}

async function fetchPendingDeadLetters(now: Date) {
	const allPendingDeliveries = await prisma.failedDelivery.findMany({
		where: {
			status: 'PENDING',
			nextRetryAt: {
				lte: now,
			},
		},
		take: 100,
	})

	return allPendingDeliveries.filter((d) => d.attemptCount < d.maxAttempts).slice(0, 50)
}

async function markRetryingDelivery(id: string) {
	await prisma.failedDelivery.update({
		where: { id },
		data: { status: 'RETRYING' },
	})
}

async function findDeliveryUser(userId: string) {
	return prisma.user.findUnique({
		where: { id: userId },
		select: { id: true, username: true, privateKey: true },
	})
}

async function markDeliveryFailedMissingUser(id: string) {
	await prisma.failedDelivery.update({
		where: { id },
		data: {
			status: 'FAILED',
			lastError: 'User not found',
			resolvedAt: new Date(),
		},
	})
}

async function deleteSuccessfulDelivery(deliveryId: string, activityId: string, inboxUrl: string) {
	await prisma.failedDelivery.delete({
		where: { id: deliveryId },
	})
	console.log(`[Dead Letter Queue] Successfully delivered: ${activityId} -> ${inboxUrl}`)
}

async function updateAttemptFailure(delivery: {
	id: string
	attemptCount: number
	maxAttempts: number
}) {
	const newAttemptCount = delivery.attemptCount + 1
	const nextRetryAt = calculateNextRetry(newAttemptCount)
	const status = newAttemptCount >= delivery.maxAttempts ? 'FAILED' : 'PENDING'

	await prisma.failedDelivery.update({
		where: { id: delivery.id },
		data: {
			attemptCount: newAttemptCount,
			nextRetryAt: status === 'PENDING' ? nextRetryAt : null,
			status,
			lastAttemptAt: new Date(),
			resolvedAt: status === 'FAILED' ? new Date() : null,
		},
	})
}

async function markDeliveryError(id: string, error: unknown) {
	await prisma.failedDelivery.update({
		where: { id },
		data: {
			status: 'PENDING',
			lastError: error instanceof Error ? error.message : 'Unknown error',
			lastAttemptAt: new Date(),
		},
	})
}

async function processSingleDeadLetter(
	delivery: Awaited<ReturnType<typeof prisma.failedDelivery.findFirst>>
) {
	if (!delivery) return

	try {
		await markRetryingDelivery(delivery.id)

		const user = await findDeliveryUser(delivery.userId)
		if (!user) {
			await markDeliveryFailedMissingUser(delivery.id)
			return
		}

		const success = await deliverToInbox(
			delivery.activity as Activity,
			delivery.inboxUrl,
			user,
			false
		)

		if (success) {
			await deleteSuccessfulDelivery(delivery.id, delivery.activityId, delivery.inboxUrl)
			return
		}

		await updateAttemptFailure(delivery)
	} catch (error) {
		console.error(`[Dead Letter Queue] Error processing delivery ${delivery.id}:`, error)
		await markDeliveryError(delivery.id, error)
	}
}

/**
 * Processes pending deliveries in the dead letter queue
 * Retries failed deliveries that are ready for retry
 */
export async function processDeadLetterQueue(): Promise<void> {
	try {
		const pendingDeliveries = await fetchPendingDeadLetters(new Date())
		if (pendingDeliveries.length === 0) return

		console.log(`[Dead Letter Queue] Processing ${pendingDeliveries.length} pending deliveries`)

		for (const delivery of pendingDeliveries) {
			await processSingleDeadLetter(delivery)
		}
	} catch (error) {
		console.error('[Dead Letter Queue] Error processing queue:', error)
	}
}

/**
 * Manually retry a failed delivery
 */
export async function retryFailedDelivery(deliveryId: string): Promise<boolean> {
	const delivery = await prisma.failedDelivery.findUnique({
		where: { id: deliveryId },
	})

	if (!delivery) {
		throw new Error('Delivery not found')
	}

	const user = await prisma.user.findUnique({
		where: { id: delivery.userId },
		select: { id: true, username: true, privateKey: true },
	})

	if (!user) {
		throw new Error('User not found')
	}

	const success = await deliverToInbox(
		delivery.activity as Activity,
		delivery.inboxUrl,
		user,
		false
	)

	if (success) {
		// Delete successful delivery from queue (no need to keep it)
		await prisma.failedDelivery.delete({
			where: { id: deliveryId },
		})
	}

	return success
}

/**
 * Discard a failed delivery (mark as discarded)
 */
export async function discardFailedDelivery(
	deliveryId: string,
	resolvedBy?: string
): Promise<void> {
	await prisma.failedDelivery.update({
		where: { id: deliveryId },
		data: {
			status: 'DISCARDED',
			resolvedAt: new Date(),
			resolvedBy,
		},
	})
}
