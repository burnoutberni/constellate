import { prisma } from '../lib/prisma.js'
import {
	discoverPublicEndpoint,
	fetchInstancePublicTimeline,
	pollKnownActors,
} from '../lib/instanceHelpers.js'
import {
	cacheEventFromOutboxActivity,
	fetchActor,
	cacheRemoteUser,
} from '../lib/activitypubHelpers.js'
import type { Person } from '../lib/activitypubSchemas.js'

import { config } from '../config.js'

const POLL_INTERVAL = config.instancePollIntervalMs
const BATCH_SIZE = config.instancePollBatchSize

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
 * Force a hard refresh of an instance
 * Resets pagination to start from the beginning and refreshes user profiles
 */
export async function refreshInstance(domain: string) {
	console.log(`Force refreshing instance: ${domain}`)
	const instance = await prisma.instance.findUnique({
		where: { domain },
	})

	if (!instance) return

	// Reset pagination for hard refresh
	await prisma.instance.update({
		where: { id: instance.id },
		data: { lastPageUrl: null },
	})

	// Refresh all remote users from this instance
	await refreshInstanceUsers(domain)

	// Process immediately
	await processInstance({
		...instance,
		lastPageUrl: null,
	})
}

/**
 * Refresh profile data for all users from a specific instance
 */
async function refreshInstanceUsers(domain: string) {
	// Find all remote users from this instance

	// Find all remote users from this instance
	const users = await prisma.user.findMany({
		where: {
			isRemote: true,
			OR: [
				{ externalActorUrl: { startsWith: `https://${domain}/` } },
				{ externalActorUrl: { startsWith: `http://${domain}/` } },
			],
		},
	})

	console.log(`  Refreshing ${users.length} users from ${domain}...`)

	// Refresh each user's profile
	for (const user of users) {
		if (!user.externalActorUrl) continue

		try {
			const actor = await fetchActor(user.externalActorUrl)
			if (actor) {
				await cacheRemoteUser(actor as unknown as Person)
			}
		} catch (error) {
			console.warn(`Failed to refresh user ${user.username}:`, error)
		}
	}

	console.log(`  ✅ Refreshed ${users.length} user profiles from ${domain}`)
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
			// Check if we have any instances at all
			const totalInstances = await prisma.instance.count({
				where: { isBlocked: false },
			})

			if (totalInstances > 0) {
				console.log(
					`Instance Poller: All ${totalInstances} instances are up to date (next poll due later).`
				)
			} else {
				console.log('Instance Poller: No instances tracked.')
			}
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

async function processInstance(instance: {
	id: string
	domain: string
	baseUrl: string
	publicEventsUrl: string | null
	lastPageUrl: string | null
}) {
	try {
		let publicUrl = instance.publicEventsUrl

		// If we don't have a public endpoint, try to discover it
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
			// Use the helper to fetch the timeline raw data, avoiding the local wrapper's
			// instance-object requirement since we might have just discovered the URL
			// and want to use it immediately without re-fetching the instance.
			const { activities, lastPageUrl } = await fetchInstancePublicTimeline(
				publicUrl,
				instance.lastPageUrl
			)

			if (activities.length > 0) {
				const cachedCount = await cacheActivities(activities, publicUrl, instance.baseUrl)

				console.log(
					`  Fetched ${activities.length} activities for ${instance.domain}, cached ${cachedCount} events.`
				)

				// Update instance stats
				if (lastPageUrl) {
					await prisma.instance.update({
						where: { id: instance.id },
						data: {
							lastPageUrl,
							lastFetchedAt: new Date(),
							lastError: null,
							lastErrorAt: null,
						},
					})
				} else {
					await prisma.instance.update({
						where: { id: instance.id },
						data: {
							lastFetchedAt: new Date(),
							lastError: null,
							lastErrorAt: null,
						},
					})
				}
			}
		} else {
			await pollFallbackKnownActors(instance.domain)
			// Update instance stats for fallback polling
			await prisma.instance.update({
				where: { id: instance.id },
				data: {
					lastFetchedAt: new Date(),
					lastError: null,
					lastErrorAt: null,
				},
			})
		}
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
} /**
 * Process and cache a batch of activities
 */
async function cacheActivities(
	activities: unknown[],
	publicEventsUrl: string,
	instanceBaseUrl: string
): Promise<number> {
	let cachedCount = 0
	// The actor is likely the owner of the outbox.
	// We can derive actor from outbox URL (remove /outbox) or use activity.actor
	const derivedActorUrl = publicEventsUrl.replace(/\/outbox$/, '')

	for (const activity of activities) {
		try {
			const activityObj = activity as Record<string, unknown>
			const activityActor = (activityObj.actor || activityObj.attributedTo) as
				| string
				| undefined
			// Prefer actor from the activity, but fall back to the derived URL, or instanceBaseUrl.
			const actorForEvent = activityActor || derivedActorUrl || instanceBaseUrl

			await cacheEventFromOutboxActivity(activityObj, actorForEvent)
			cachedCount++
		} catch (err) {
			// Ignore individual errors
			console.warn(`Error caching activity:`, err)
		}
	}
	return cachedCount
}

async function pollFallbackKnownActors(domain: string) {
	// Fallback: Poll known actors (Mobilizon style)
	const outboxes = await pollKnownActors(domain)

	for (const outbox of outboxes) {
		// We fetch the outbox... but `fetchInstancePublicTimeline` logic applies to outboxes too (Collection)
		// So we can reuse `fetchInstancePublicTimeline` on the user outbox.
		const { activities } = await fetchInstancePublicTimeline(outbox)

		// The actor is likely the owner of the outbox.
		// We can derive actor from outbox URL (remove /outbox) or use activity.actor
		const derivedActorUrl = outbox.replace(/\/outbox$/, '')

		for (const activity of activities) {
			const activityObj = activity as Record<string, unknown>
			const activityActor = (activityObj.actor || activityObj.attributedTo) as
				| string
				| undefined
			// Prefer actor from the activity, but fall back to the derived URL.
			const actorForEvent = activityActor || derivedActorUrl

			await cacheEventFromOutboxActivity(activityObj, actorForEvent)
		}
	}
}
