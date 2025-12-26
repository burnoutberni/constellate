import { prisma } from '../lib/prisma.js'
import {
	discoverPublicEndpoint,
	fetchInstancePublicTimeline,
	pollKnownActors,
} from '../lib/instanceHelpers.js'
import { cacheEventFromOutboxActivity } from '../lib/activitypubHelpers.js'

const POLL_INTERVAL = 60 * 60 * 1000 // 1 hour
const BATCH_SIZE = 5 // Process 5 instances concurrently

let pollInterval: NodeJS.Timeout | null = null
let isPolling = false

/**
 * Start the instance poller service
 */
export function startInstancePoller() {
	if (pollInterval) return

	console.log('🚀 Starting Instance Poller service...')

	// Initial poll after short delay
	setTimeout(() => void pollInstances(), 10000)

	// Periodic poll
	pollInterval = setInterval(() => {
		void pollInstances()
	}, POLL_INTERVAL)
}

/**
 * Stop the instance poller service
 */
export function stopInstancePoller() {
	if (pollInterval) {
		clearInterval(pollInterval)
		pollInterval = null
		console.log('🛑 Stopped Instance Poller service')
	}
}

/**
 * Main polling logic
 */
async function pollInstances() {
	if (isPolling) return
	isPolling = true

	try {
		console.log('🔄 Instance Poller: Starting poll cycle...')

		// Find instances that need polling
		// Criteria: Not blocked, and (never fetched OR fetched longer than interval ago)
		const cutoffDate = new Date(Date.now() - POLL_INTERVAL)

		const instances = await prisma.instance.findMany({
			where: {
				isBlocked: false,
				OR: [{ lastFetchedAt: null }, { lastFetchedAt: { lt: cutoffDate } }],
			},
			take: 20, // Process max 20 per cycle to be gentle
			orderBy: {
				lastFetchedAt: 'asc', // Prioritize those waiting longest
			},
		})

		if (instances.length === 0) {
			console.log('Instance Poller: No instances to poll.')
			return
		}

		console.log(`Instance Poller: Processing ${instances.length} instances...`)

		// Process in batches
		for (let i = 0; i < instances.length; i += BATCH_SIZE) {
			const batch = instances.slice(i, i + BATCH_SIZE)
			await Promise.all(batch.map(processInstance))
		}

		console.log('✅ Instance Poller: Cycle complete.')
	} catch (error) {
		console.error('Instance Poller Error:', error)
	} finally {
		isPolling = false
	}
}

/**
 * Process a single instance
 */
async function processInstance(instance: {
	domain: string
	baseUrl: string
	publicEventsUrl: string | null
}) {
	try {
		let publicUrl = instance.publicEventsUrl

		// If we don't have a public URL, try discovery again
		if (!publicUrl) {
			publicUrl = await discoverPublicEndpoint(instance.domain)

			// If discovered, save it
			if (publicUrl) {
				await prisma.instance.update({
					where: { domain: instance.domain },
					data: { publicEventsUrl: publicUrl },
				})
			}
		}

		if (publicUrl) {
			await pollPublicEndpoint(publicUrl)
		} else {
			await pollFallbackKnownActors(instance.domain)
		}

		// Update instance stats
		await prisma.instance.update({
			where: { domain: instance.domain },
			data: {
				lastFetchedAt: new Date(),
				lastError: null,
				lastErrorAt: null,
			},
		})
	} catch (error) {
		console.error(`Error polling ${instance.domain}:`, error)
		await prisma.instance.update({
			where: { domain: instance.domain },
			data: {
				lastError: error instanceof Error ? error.message : 'Unknown polling error',
				lastErrorAt: new Date(),
			},
		})
	}
}

async function pollPublicEndpoint(publicUrl: string) {
	// Poll public collection
	const activities = await fetchInstancePublicTimeline(publicUrl)

	for (const activity of activities) {
		const activityObj = activity as Record<string, unknown>
		const activityActor = (activityObj.actor || activityObj.attributedTo) as string | undefined
		if (activityActor) {
			await cacheEventFromOutboxActivity(activityObj, activityActor)
		}
	}
}

async function pollFallbackKnownActors(domain: string) {
	// Fallback: Poll known actors (Mobilizon style)
	const outboxes = await pollKnownActors(domain)

	for (const outbox of outboxes) {
		// We fetch the outbox... but `fetchInstancePublicTimeline` logic applies to outboxes too (Collection)
		// So we can reuse `fetchInstancePublicTimeline` on the user outbox.
		const activities = await fetchInstancePublicTimeline(outbox)

		// The actor is likely the owner of the outbox.
		// We can derive actor from outbox URL (remove /outbox) or use activity.actor
		const actorUrl = outbox.replace(/\/outbox$/, '')

		for (const activity of activities) {
			await cacheEventFromOutboxActivity(activity as Record<string, unknown>, actorUrl)
		}
	}
}
