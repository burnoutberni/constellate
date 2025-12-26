/**
 * Tests for Instance Poller Service
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { prisma } from '../../lib/prisma.js'
import { startInstancePoller, stopInstancePoller } from '../../services/instancePoller.js'
import {
	discoverPublicEndpoint,
	fetchInstancePublicTimeline,
	pollKnownActors,
} from '../../lib/instanceHelpers.js'
import { cacheEventFromOutboxActivity } from '../../lib/activitypubHelpers.js'

// Mock dependencies
vi.mock('../../lib/prisma.js', () => ({
	prisma: {
		instance: {
			findMany: vi.fn(),
			update: vi.fn(),
		},
	},
}))

vi.mock('../../lib/instanceHelpers.js', () => ({
	discoverPublicEndpoint: vi.fn(),
	fetchInstancePublicTimeline: vi.fn(),
	pollKnownActors: vi.fn(),
}))

vi.mock('../../lib/activitypubHelpers.js', () => ({
	cacheEventFromOutboxActivity: vi.fn(),
}))

describe('Instance Poller Service', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.useFakeTimers()
	})

	afterEach(() => {
		stopInstancePoller()
		vi.useRealTimers()
	})

	it('should check for instances to poll', async () => {
		// Start poller
		startInstancePoller()

		// Mock empty result
		vi.mocked(prisma.instance.findMany).mockResolvedValue([])

		// Advance time to trigger poll
		await vi.advanceTimersByTimeAsync(11000)

		expect(prisma.instance.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					isBlocked: false,
				}),
				take: 20,
			})
		)
	})

	it('should process instances with publicEventsUrl', async () => {
		// Mock instances
		const mockInstance = {
			domain: 'mastodon.social',
			baseUrl: 'https://mastodon.social',
			publicEventsUrl: 'https://mastodon.social/users/events/outbox',
			lastFetchedAt: null,
		}
		vi.mocked(prisma.instance.findMany).mockResolvedValue([mockInstance as any])

		// Mock timeline fetch
		const mockActivity = {
			id: 'https://mastodon.social/activities/1',
			type: 'Create',
			object: {
				type: 'Event',
				id: 'https://mastodon.social/events/1',
			},
			actor: 'https://mastodon.social/users/alice',
		}
		vi.mocked(fetchInstancePublicTimeline).mockResolvedValue([mockActivity])

		// Start poller and trigger
		startInstancePoller()
		await vi.advanceTimersByTimeAsync(11000)

		// Verification
		expect(fetchInstancePublicTimeline).toHaveBeenCalledWith(
			'https://mastodon.social/users/events/outbox'
		)
		expect(cacheEventFromOutboxActivity).toHaveBeenCalledWith(
			mockActivity,
			'https://mastodon.social/users/alice'
		)
		expect(prisma.instance.update).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { domain: 'mastodon.social' },
				data: expect.objectContaining({
					lastFetchedAt: expect.any(Date),
				}),
			})
		)
	})

	it('should discover public endpoint if missing', async () => {
		const mockInstance = {
			domain: 'discover.me',
			baseUrl: 'https://discover.me',
			publicEventsUrl: null,
		}
		vi.mocked(prisma.instance.findMany).mockResolvedValue([mockInstance as any])

		// Mock discovery
		vi.mocked(discoverPublicEndpoint).mockResolvedValue('https://discover.me/events')
		vi.mocked(fetchInstancePublicTimeline).mockResolvedValue([])

		// Start poller and trigger
		startInstancePoller()
		await vi.advanceTimersByTimeAsync(11000)

		expect(discoverPublicEndpoint).toHaveBeenCalledWith('discover.me')
		expect(prisma.instance.update).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { domain: 'discover.me' },
				data: { publicEventsUrl: 'https://discover.me/events' },
			})
		)
		expect(fetchInstancePublicTimeline).toHaveBeenCalledWith('https://discover.me/events')
	})

	it('should fallback to polling known actors if discovery fails', async () => {
		const mockInstance = {
			domain: 'fallback.net',
			baseUrl: 'https://fallback.net',
			publicEventsUrl: null,
		}
		vi.mocked(prisma.instance.findMany).mockResolvedValue([mockInstance as any])

		// Mock discovery failure
		vi.mocked(discoverPublicEndpoint).mockResolvedValue(null)

		// Mock known actors fallback
		vi.mocked(pollKnownActors).mockResolvedValue(['https://fallback.net/users/bob/outbox'])
		vi.mocked(fetchInstancePublicTimeline).mockResolvedValue([])

		// Start poller and trigger
		startInstancePoller()
		await vi.advanceTimersByTimeAsync(11000)

		expect(pollKnownActors).toHaveBeenCalledWith('fallback.net')
		expect(fetchInstancePublicTimeline).toHaveBeenCalledWith(
			'https://fallback.net/users/bob/outbox'
		)
	})

	it('should handle errors gracefully', async () => {
		const mockInstance = {
			domain: 'error.com',
			baseUrl: 'https://error.com',
			publicEventsUrl: 'https://error.com/outbox',
		}
		vi.mocked(prisma.instance.findMany).mockResolvedValue([mockInstance as any])

		vi.mocked(fetchInstancePublicTimeline).mockRejectedValue(new Error('Network error'))

		// Start poller and trigger
		startInstancePoller()
		await vi.advanceTimersByTimeAsync(11000)

		expect(prisma.instance.update).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { domain: 'error.com' },
				data: expect.objectContaining({
					lastError: 'Network error',
				}),
			})
		)
	})
})
