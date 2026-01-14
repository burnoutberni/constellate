/**
 * Tests for Instance Poller Service
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { prisma } from '../../lib/prisma.js'
import {
	startInstancePoller,
	stopInstancePoller,
	refreshInstance,
} from '../../services/instancePoller.js'
import {
	discoverPublicEndpoint,
	fetchInstancePublicTimeline,
	pollKnownActors,
} from '../../lib/instanceHelpers.js'
import { cacheEventFromOutboxActivity, fetchActor } from '../../lib/activitypubHelpers.js'

// Mock dependencies
vi.mock('../../lib/prisma.js', () => ({
	prisma: {
		instance: {
			findMany: vi.fn(),
			update: vi.fn(),
			findUnique: vi.fn(),
			count: vi.fn(),
		},
		user: {
			findMany: vi.fn(),
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
	fetchActor: vi.fn(),
	cacheRemoteUser: vi.fn(),
}))

describe('Instance Poller Service', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.useFakeTimers()
		vi.mocked(prisma.user.findMany).mockResolvedValue([])
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
			id: 'instance-1',
			domain: 'mastodon.social',
			baseUrl: 'https://mastodon.social',
			publicEventsUrl: 'https://mastodon.social/users/events/outbox',
			lastFetchedAt: null,
			lastPageUrl: null,
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
		vi.mocked(fetchInstancePublicTimeline).mockResolvedValue({ activities: [mockActivity] })

		// Start poller and trigger
		startInstancePoller()
		await vi.advanceTimersByTimeAsync(11000)

		// Verification
		expect(fetchInstancePublicTimeline).toHaveBeenCalledWith(
			'https://mastodon.social/users/events/outbox',
			null
		)
		expect(cacheEventFromOutboxActivity).toHaveBeenCalledWith(
			mockActivity,
			'https://mastodon.social/users/alice'
		)
		expect(prisma.instance.update).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: 'instance-1' },
				data: expect.objectContaining({
					lastFetchedAt: expect.any(Date),
				}),
			})
		)
	})

	it('should strictly match user domains', async () => {
		const domain = 'example.com'
		const mockUsers = [
			{ username: 'valid', externalActorUrl: 'https://example.com/u/valid' },
			{ username: 'invalid', externalActorUrl: 'https://not-example.com/u/invalid' },
		]

		// We mock the findMany call to return what we want to verify the *query* arguments
		// validation happens in the implementation via prisma.user.findMany args
		vi.mocked(prisma.user.findMany).mockResolvedValue([mockUsers[0]] as any)
		vi.mocked(prisma.instance.findUnique).mockResolvedValue({
			id: 'inst-1',
			domain,
			lastPageUrl: null,
		} as any)

		await refreshInstance(domain)

		// Verify the query construction
		expect(prisma.user.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					isRemote: true,
					OR: [
						{ externalActorUrl: { startsWith: `https://${domain}/` } },
						{ externalActorUrl: { startsWith: `http://${domain}/` } },
					],
				},
			})
		)
	})

	it('should discover public endpoint if missing', async () => {
		const mockInstance = {
			domain: 'discover.me',
			baseUrl: 'https://discover.me',
			publicEventsUrl: null,
			lastPageUrl: null,
		}
		vi.mocked(prisma.instance.findMany).mockResolvedValue([mockInstance as any])

		// Mock discovery
		vi.mocked(discoverPublicEndpoint).mockResolvedValue('https://discover.me/events')
		vi.mocked(fetchInstancePublicTimeline).mockResolvedValue({ activities: [] })

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
		expect(fetchInstancePublicTimeline).toHaveBeenCalledWith('https://discover.me/events', null)
	})

	it('should fallback to polling known actors if discovery fails', async () => {
		const mockInstance = {
			domain: 'fallback.net',
			baseUrl: 'https://fallback.net',
			publicEventsUrl: null,
			lastPageUrl: null,
		}
		vi.mocked(prisma.instance.findMany).mockResolvedValue([mockInstance as any])

		// Mock discovery failure
		vi.mocked(discoverPublicEndpoint).mockResolvedValue(null)

		// Mock known actors fallback
		vi.mocked(pollKnownActors).mockResolvedValue(['https://fallback.net/users/bob/outbox'])
		vi.mocked(fetchInstancePublicTimeline).mockResolvedValue({ activities: [] })

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
			lastPageUrl: null,
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

	describe('refreshInstance', () => {
		it('should force refresh an instance', async () => {
			const mockInstance = {
				id: 'instance-refresh',
				domain: 'refresh.me',
				baseUrl: 'https://refresh.me',
				publicEventsUrl: 'https://refresh.me/outbox',
				lastPageUrl: 'https://refresh.me/outbox?page=old',
			}

			vi.mocked(prisma.instance.findUnique).mockResolvedValue(mockInstance as any)
			vi.mocked(prisma.instance.update).mockResolvedValue(mockInstance as any)
			vi.mocked(fetchInstancePublicTimeline).mockResolvedValue({ activities: [] })

			await refreshInstance('refresh.me')

			// Should find instance
			expect(prisma.instance.findUnique).toHaveBeenCalledWith({
				where: { domain: 'refresh.me' },
			})

			// Should reset pagination
			expect(prisma.instance.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: 'instance-refresh' },
					data: { lastPageUrl: null },
				})
			)

			// Should fetch fresh timeline (with null page url)
			expect(fetchInstancePublicTimeline).toHaveBeenCalledWith(
				'https://refresh.me/outbox',
				null
			)
		})

		it('should do nothing if instance not found', async () => {
			vi.mocked(prisma.instance.findUnique).mockResolvedValue(null)

			await refreshInstance('unknown.me')

			expect(prisma.instance.findUnique).toHaveBeenCalledWith({
				where: { domain: 'unknown.me' },
			})
			expect(prisma.instance.update).not.toHaveBeenCalled()
			expect(fetchInstancePublicTimeline).not.toHaveBeenCalled()
		})

		it('should discover endpoint if missing during refresh', async () => {
			const mockInstance = {
				id: 'instance-discovery',
				domain: 'discovery.me',
				baseUrl: 'https://discovery.me',
				publicEventsUrl: null,
				lastPageUrl: null,
			}

			vi.mocked(prisma.instance.findUnique).mockResolvedValue(mockInstance as any)
			vi.mocked(prisma.instance.update).mockResolvedValue(mockInstance as any)
			vi.mocked(discoverPublicEndpoint).mockResolvedValue('https://discovery.me/events')
			vi.mocked(fetchInstancePublicTimeline).mockResolvedValue({ activities: [] })

			await refreshInstance('discovery.me')

			expect(discoverPublicEndpoint).toHaveBeenCalledWith('discovery.me')
			expect(prisma.instance.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { domain: 'discovery.me' },
					data: { publicEventsUrl: 'https://discovery.me/events' },
				})
			)
		})

		it('should process and cache activities during refresh', async () => {
			const mockInstance = {
				id: 'instance-caching',
				domain: 'caching.me',
				baseUrl: 'https://caching.me',
				publicEventsUrl: 'https://caching.me/outbox',
				lastPageUrl: null,
			}

			const mockActivity = {
				id: 'https://caching.me/activities/1',
				type: 'Create',
				object: { type: 'Event' },
				actor: 'https://caching.me/users/carl',
			}

			vi.mocked(prisma.instance.findUnique).mockResolvedValue(mockInstance as any)
			vi.mocked(prisma.instance.update).mockResolvedValue(mockInstance as any)
			vi.mocked(fetchInstancePublicTimeline).mockResolvedValue({ activities: [mockActivity] })

			await refreshInstance('caching.me')

			expect(cacheEventFromOutboxActivity).toHaveBeenCalledWith(
				mockActivity,
				'https://caching.me/users/carl'
			)
		})

		it('should skip users without externalActorUrl', async () => {
			const domain = 'example.com'
			const mockUsers = [
				{ username: 'valid', externalActorUrl: 'https://example.com/u/valid' },
				{ username: 'invalid', externalActorUrl: null },
			]

			vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any)
			vi.mocked(prisma.instance.findUnique).mockResolvedValue({
				id: 'inst-1',
				domain,
				lastPageUrl: null,
			} as any)

			await refreshInstance(domain)

			expect(fetchActor).toHaveBeenCalledWith('https://example.com/u/valid')
			expect(fetchActor).toHaveBeenCalledTimes(1)
		})

		it('should handle empty instances list with no tracked instances', async () => {
			vi.mocked(prisma.instance.findMany).mockResolvedValue([])
			vi.mocked(prisma.instance.count).mockResolvedValue(0)

			startInstancePoller()
			await vi.advanceTimersByTimeAsync(11000)

			expect(prisma.instance.count).toHaveBeenCalled()
		})

		it('should log message when all instances are up to date', async () => {
			vi.mocked(prisma.instance.findMany).mockResolvedValue([])
			vi.mocked(prisma.instance.count).mockResolvedValue(5)

			const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

			startInstancePoller()
			await vi.advanceTimersByTimeAsync(11000)

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('up to date'))

			consoleSpy.mockRestore()
		})

		it('should update instance without lastPageUrl when activities are cached', async () => {
			const mockInstance = {
				id: 'instance-1',
				domain: 'test.com',
				baseUrl: 'https://test.com',
				publicEventsUrl: 'https://test.com/outbox',
				lastPageUrl: null,
			}

			vi.mocked(prisma.instance.findMany).mockResolvedValue([mockInstance as any])
			vi.mocked(fetchInstancePublicTimeline).mockResolvedValue({
				activities: [{ id: 'act1', type: 'Create' }] as unknown as any[],
				lastPageUrl: null as string | null,
			} as any)

			startInstancePoller()
			await vi.advanceTimersByTimeAsync(11000)

			expect(prisma.instance.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						lastFetchedAt: expect.any(Date),
						lastError: null,
						lastErrorAt: null,
					}),
				})
			)
		})

		it('should handle user refresh errors gracefully', async () => {
			const domain = 'error.com'
			const mockUsers = [{ username: 'user1', externalActorUrl: 'https://error.com/u/user1' }]

			vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any)
			vi.mocked(prisma.instance.findUnique).mockResolvedValue({
				id: 'inst-1',
				domain,
				lastPageUrl: null,
			} as any)
			vi.mocked(fetchActor).mockRejectedValue(new Error('Network error'))
			vi.mocked(fetchInstancePublicTimeline).mockResolvedValue({ activities: [] })

			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

			await refreshInstance(domain)

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('Failed to refresh user'),
				expect.any(Error)
			)

			consoleSpy.mockRestore()
		})

		it('should update instance with error when processing fails', async () => {
			const mockInstance = {
				id: 'instance-1',
				domain: 'fail.com',
				baseUrl: 'https://fail.com',
				publicEventsUrl: 'https://fail.com/outbox',
				lastPageUrl: null,
			}

			vi.mocked(prisma.instance.findMany).mockResolvedValue([mockInstance as any])
			vi.mocked(fetchInstancePublicTimeline).mockRejectedValue(new Error('Processing failed'))

			startInstancePoller()
			await vi.advanceTimersByTimeAsync(11000)

			expect(prisma.instance.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { domain: 'fail.com' },
					data: expect.objectContaining({
						lastError: 'Processing failed',
						lastErrorAt: expect.any(Date),
					}),
				})
			)
		})

		it('should handle caching errors gracefully', async () => {
			const mockInstance = {
				id: 'instance-cache-err',
				domain: 'cacheerr.com',
				baseUrl: 'https://cacheerr.com',
				publicEventsUrl: 'https://cacheerr.com/outbox',
				lastPageUrl: null,
			}

			const mockActivity = {
				id: 'https://cacheerr.com/activities/1',
				type: 'Create',
				object: { type: 'Event' },
				actor: 'https://cacheerr.com/users/actor',
			}

			vi.mocked(prisma.instance.findMany).mockResolvedValue([mockInstance as any])
			vi.mocked(fetchInstancePublicTimeline).mockResolvedValue({
				activities: [mockActivity] as unknown as any[],
				lastPageUrl: 'https://cacheerr.com/outbox?page=2',
			})
			vi.mocked(cacheEventFromOutboxActivity).mockRejectedValue(new Error('Cache error'))

			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

			startInstancePoller()
			await vi.advanceTimersByTimeAsync(11000)

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('Error caching activity'),
				expect.any(Error)
			)

			consoleSpy.mockRestore()
		})

		it('should use both actor and attributedTo for events', async () => {
			const mockInstance = {
				id: 'instance-1',
				domain: 'test.com',
				baseUrl: 'https://test.com',
				publicEventsUrl: 'https://test.com/outbox',
				lastPageUrl: null,
			}

			const mockActivity = {
				id: 'https://test.com/activities/1',
				type: 'Create',
				actor: 'https://test.com/users/actor1',
				attributedTo: 'https://test.com/users/actor2',
				object: { type: 'Event' },
			}

			vi.mocked(prisma.instance.findMany).mockResolvedValue([mockInstance as any])
			vi.mocked(fetchInstancePublicTimeline).mockResolvedValue({
				activities: [mockActivity],
				lastPageUrl: null,
			} as any)

			startInstancePoller()
			await vi.advanceTimersByTimeAsync(11000)

			expect(cacheEventFromOutboxActivity).toHaveBeenCalledWith(
				mockActivity,
				'https://test.com/users/actor1'
			)
		})

		it('should fallback to derived actor when activity has no actor', async () => {
			const mockInstance = {
				id: 'instance-1',
				domain: 'test.com',
				baseUrl: 'https://test.com',
				publicEventsUrl: 'https://test.com/outbox',
				lastPageUrl: null,
			}

			const mockActivity = {
				id: 'https://test.com/activities/1',
				type: 'Create',
				object: { type: 'Event' },
			}

			vi.mocked(prisma.instance.findMany).mockResolvedValue([mockInstance as any])
			vi.mocked(fetchInstancePublicTimeline).mockResolvedValue({
				activities: [mockActivity] as unknown as any[],
				lastPageUrl: null as string | null,
			} as any)

			startInstancePoller()
			await vi.advanceTimersByTimeAsync(11000)

			expect(cacheEventFromOutboxActivity).toHaveBeenCalledWith(
				mockActivity,
				'https://test.com/outbox'.replace(/\/outbox$/, '')
			)
		})

		it('should use attributedTo when actor is not present', async () => {
			const mockInstance = {
				id: 'instance-1',
				domain: 'test.com',
				baseUrl: 'https://test.com',
				publicEventsUrl: 'https://test.com/outbox',
				lastPageUrl: null,
			}

			const mockActivity = {
				id: 'https://test.com/activities/1',
				type: 'Create',
				attributedTo: 'https://test.com/users/attributed',
				object: { type: 'Event' },
			}

			vi.mocked(prisma.instance.findMany).mockResolvedValue([mockInstance as any])
			vi.mocked(fetchInstancePublicTimeline).mockResolvedValue({
				activities: [mockActivity] as unknown as any[],
				lastPageUrl: null as string | null,
			} as any)

			startInstancePoller()
			await vi.advanceTimersByTimeAsync(11000)

			expect(cacheEventFromOutboxActivity).toHaveBeenCalledWith(
				mockActivity,
				'https://test.com/users/attributed'
			)
		})

		it('should process fallback known actors for activities', async () => {
			const mockInstance = {
				id: 'instance-1',
				domain: 'fallback.net',
				baseUrl: 'https://fallback.net',
				publicEventsUrl: null,
				lastPageUrl: null,
			}

			vi.mocked(prisma.instance.findMany).mockResolvedValue([mockInstance as any])
			vi.mocked(discoverPublicEndpoint).mockResolvedValue(null)
			vi.mocked(pollKnownActors).mockResolvedValue([
				'https://fallback.net/users/alice/outbox',
			])

			const mockActivity = {
				id: 'https://fallback.net/activities/1',
				type: 'Create',
				actor: 'https://fallback.net/users/alice',
				object: { type: 'Event' },
			}

			vi.mocked(fetchInstancePublicTimeline).mockResolvedValue({
				activities: [mockActivity] as unknown as any[],
			} as any)

			startInstancePoller()
			await vi.advanceTimersByTimeAsync(11000)

			expect(cacheEventFromOutboxActivity).toHaveBeenCalledWith(
				mockActivity,
				'https://fallback.net/users/alice'
			)
		})

		it('should not start poller twice', async () => {
			startInstancePoller()
			startInstancePoller()

			await vi.advanceTimersByTimeAsync(11000)

			expect(prisma.instance.findMany).toHaveBeenCalledTimes(1)
		})

		it('should stop poller correctly', async () => {
			vi.mocked(prisma.instance.findMany).mockResolvedValue([])
			startInstancePoller()

			await vi.advanceTimersByTimeAsync(11000)
			expect(prisma.instance.findMany).toHaveBeenCalled()

			stopInstancePoller()
			stopInstancePoller()

			vi.mocked(prisma.instance.findMany).mockClear()

			await vi.advanceTimersByTimeAsync(60 * 60 * 1000 + 1000)

			expect(prisma.instance.findMany).not.toHaveBeenCalled()
		})

		it('should update instance with lastPageUrl when provided', async () => {
			const mockInstance = {
				id: 'instance-1',
				domain: 'paged.com',
				baseUrl: 'https://paged.com',
				publicEventsUrl: 'https://paged.com/outbox',
				lastPageUrl: null,
			}

			vi.mocked(prisma.instance.findMany).mockResolvedValue([mockInstance as any])
			vi.mocked(fetchInstancePublicTimeline).mockResolvedValue({
				activities: [{ id: 'act1', type: 'Create' }] as unknown as any[],
				lastPageUrl: 'https://paged.com/outbox?page=2',
			} as any)

			startInstancePoller()
			await vi.advanceTimersByTimeAsync(11000)

			expect(prisma.instance.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						lastPageUrl: 'https://paged.com/outbox?page=2',
					}),
				})
			)
		})

		it('should process instances in batches', async () => {
			const mockInstances = Array.from({ length: 15 }, (_, i) => ({
				id: `instance-${i}`,
				domain: `domain${i}.com`,
				baseUrl: `https://domain${i}.com`,
				publicEventsUrl: `https://domain${i}.com/outbox`,
				lastPageUrl: null,
			}))

			vi.mocked(prisma.instance.findMany).mockResolvedValue(mockInstances as any)
			vi.mocked(fetchInstancePublicTimeline).mockResolvedValue({
				activities: [],
			} as any)

			startInstancePoller()
			await vi.advanceTimersByTimeAsync(11000)

			expect(prisma.instance.findMany).toHaveBeenCalled()
		})

		it('should handle non-Error exceptions when processing', async () => {
			const mockInstance = {
				id: 'instance-1',
				domain: 'nonError.com',
				baseUrl: 'https://nonError.com',
				publicEventsUrl: 'https://nonError.com/outbox',
				lastPageUrl: null,
			}

			vi.mocked(prisma.instance.findMany).mockResolvedValue([mockInstance as any])
			vi.mocked(fetchInstancePublicTimeline).mockRejectedValue('String error')

			startInstancePoller()
			await vi.advanceTimersByTimeAsync(11000)

			expect(prisma.instance.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { domain: 'nonError.com' },
					data: expect.objectContaining({
						lastError: 'Unknown polling error',
					}),
				})
			)
		})

		it('should update instance after fallback polling', async () => {
			const mockInstance = {
				id: 'instance-1',
				domain: 'fallback-update.net',
				baseUrl: 'https://fallback-update.net',
				publicEventsUrl: null,
				lastPageUrl: null,
			}

			vi.mocked(prisma.instance.findMany).mockResolvedValue([mockInstance as any])
			vi.mocked(discoverPublicEndpoint).mockResolvedValue(null)
			vi.mocked(pollKnownActors).mockResolvedValue([])

			startInstancePoller()
			await vi.advanceTimersByTimeAsync(11000)

			expect(prisma.instance.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: 'instance-1' },
					data: expect.objectContaining({
						lastFetchedAt: expect.any(Date),
						lastError: null,
						lastErrorAt: null,
					}),
				})
			)
		})
	})
})
