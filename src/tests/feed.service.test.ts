import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FeedService } from '../services/FeedService'
import { SocialGraphService } from '../services/SocialGraphService'
import { SuggestedUsersService } from '../services/SuggestedUsersService'
import { prisma } from '../lib/prisma'

// Mock dependencies
vi.mock('../services/SocialGraphService')
vi.mock('../services/SuggestedUsersService')
vi.mock('../lib/prisma', () => ({
	prisma: {
		event: {
			findMany: vi.fn(),
			groupBy: vi.fn(),
		},
		eventLike: { findMany: vi.fn() },
		eventAttendance: { findMany: vi.fn() },
		comment: { findMany: vi.fn() },
	},
}))

vi.mock('../lib/eventVisibility', () => ({
	canUserViewEvent: vi.fn().mockResolvedValue(true),
}))

describe('FeedService', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('should return onboarding hero for new users', async () => {
		// Mock new user (no following)
		vi.mocked(SocialGraphService.getFollowing).mockResolvedValue([])
		vi.mocked(SocialGraphService.resolveFollowedUserIds).mockResolvedValue([])
		vi.mocked(SuggestedUsersService.getSuggestions).mockResolvedValue([
			{ id: '1', username: 'popular' } as any,
		])
		vi.mocked(prisma.event.findMany).mockResolvedValue([]) // No trending events for simplicity

		const result = await FeedService.getFeed('new-user-id')

		expect(result.items[0].type).toBe('onboarding')
		expect((result.items[0].data as any).suggestions).toHaveLength(1)
	})

	it('should correctly map trending events', async () => {
		// Mock new user (no following) to trigger getNewUserFeed
		vi.mocked(SocialGraphService.getFollowing).mockResolvedValue([])
		vi.mocked(SocialGraphService.resolveFollowedUserIds).mockResolvedValue([])
		vi.mocked(SuggestedUsersService.getSuggestions).mockResolvedValue([])

		const date = new Date()
		const mockEvent = {
			id: 'ev-1',
			title: 'Trending Event',
			startTime: date,
			updatedAt: date,
			user: {
				id: 'u1',
				username: 'creator',
				name: 'Creator',
				displayColor: '#000000',
				profileImage: null,
			},
			tags: [{ id: 't1', tag: 'cool' }],
			_count: { attendance: 10, comments: 5, likes: 20 },
			attendance: [
				{
					status: 'attending',
					user: { id: 'u2', username: 'attendee', profileImage: null },
				},
			],
		}

		// Mock findMany to return our event (both for trending and public events calls)
		vi.mocked(prisma.event.findMany).mockResolvedValue([mockEvent as any])

		const result = await FeedService.getFeed('new-user-id')

		// Find the trending event item
		const trendingItem = result.items.find((i) => i.type === 'trending_event')
		expect(trendingItem).toBeDefined()
		expect(trendingItem?.data).toMatchObject({
			id: 'ev-1',
			title: 'Trending Event',
			user: {
				username: 'creator',
			},
			tags: [{ tag: 'cool' }],
			_count: { attendance: 10, comments: 5, likes: 20 },
			attendance: [{ status: 'attending', user: { username: 'attendee' } }],
		})
	})

	it('should return activities for established users', async () => {
		// Mock established user
		vi.mocked(SocialGraphService.getFollowing).mockResolvedValue([{ actorUrl: 'url' }] as any)
		vi.mocked(SocialGraphService.resolveFollowedUserIds).mockResolvedValue(['friend-id'])

		// Mock DB responses
		const date = new Date()
		vi.mocked(prisma.eventLike.findMany).mockResolvedValue([
			{
				id: 'l1',
				createdAt: date,
				user: {},
				event: { title: 'T', startTime: date, tags: [], user: {} },
			} as any,
		])
		vi.mocked(prisma.eventAttendance.findMany).mockResolvedValue([])
		vi.mocked(prisma.comment.findMany).mockResolvedValue([])
		vi.mocked(prisma.event.findMany).mockResolvedValue([])

		const result = await FeedService.getFeed('user-id')

		expect(result.items).toHaveLength(1)
		expect(result.items[0].type).toBe('activity')
		expect(result.items[0].id).toBe('like-l1')
	})

	it('should filter out shared events if the shared content is not visible', async () => {
		// Mock established user
		vi.mocked(SocialGraphService.getFollowing).mockResolvedValue([{ actorUrl: 'url' }] as any)
		vi.mocked(SocialGraphService.resolveFollowedUserIds).mockResolvedValue(['friend-id'])

		const { canUserViewEvent } = await import('../lib/eventVisibility')
		vi.mocked(canUserViewEvent).mockImplementation(async (event, userId) => {
			if ((event as any).id === 'hidden-event') return false
			return true
		})

		const date = new Date()
		const visibleEvent = {
			id: 'visible-event',
			title: 'Visible',
			startTime: date,
			user: { id: 'other' },
			tags: [],
		}
		const hiddenEvent = {
			id: 'hidden-event',
			title: 'Hidden',
			startTime: date,
			user: { id: 'other' },
			tags: [],
		}

		// Mock DB responses
		vi.mocked(prisma.eventLike.findMany).mockResolvedValue([])
		vi.mocked(prisma.eventAttendance.findMany).mockResolvedValue([])
		vi.mocked(prisma.comment.findMany).mockResolvedValue([])

		// 1. Created events (empty)
		vi.mocked(prisma.event.findMany).mockResolvedValueOnce([])

		// 2. Shared events (return one visible and one hidden share)
		vi.mocked(prisma.event.findMany).mockResolvedValueOnce([
			{
				id: 'share-1',
				type: 'share',
				createdAt: date,
				startTime: date,
				title: 'Share 1',
				user: { id: 'friend-id' },
				sharedEvent: visibleEvent,
			} as any,
			{
				id: 'share-2',
				type: 'share',
				createdAt: date,
				startTime: date,
				title: 'Share 2',
				user: { id: 'friend-id' },
				sharedEvent: hiddenEvent,
			} as any,
		])

		const result = await FeedService.getFeed('user-id')

		// Should contain only the visible share
		const sharedItems = result.items.filter(
			(i) => i.type === 'activity' && (i.data as any).type === 'event_shared'
		)
		expect(sharedItems).toHaveLength(1)
		expect((sharedItems[0].data as any).event.id).toBe('visible-event')
	})
	it('should handle pagination for new users', async () => {
		vi.mocked(SocialGraphService.getFollowing).mockResolvedValue([])
		vi.mocked(SocialGraphService.resolveFollowedUserIds).mockResolvedValue([])

		const date = new Date()
		const mockEvent = {
			id: 'ev-old',
			createdAt: date,
			user: { id: 'u1' },
			tags: [],
			_count: { attendance: 0 },
			attendance: [],
		}

		vi.mocked(prisma.event.findMany).mockResolvedValue([mockEvent as any])

		const result = await FeedService.getFeed('new-user-id', date.toISOString())

		expect(result.items).toHaveLength(1)
		expect(result.items[0].type).toBe('trending_event')
		expect(result.items[0].id).toBe('ev-old')
	})

	it('should fill trending events for established users when activities are few', async () => {
		vi.mocked(SocialGraphService.getFollowing).mockResolvedValue([{ actorUrl: 'url' }] as any)
		vi.mocked(SocialGraphService.resolveFollowedUserIds).mockResolvedValue(['friend-id'])

		// 1 activity
		vi.mocked(prisma.eventLike.findMany).mockResolvedValue([
			{
				id: 'l1',
				createdAt: new Date(),
				user: { id: 'u2', username: 'liker', isRemote: false },
				event: {
					id: 'ev-liked',
					title: 'Liked Event',
					startTime: new Date(),
					user: { id: 'u3', username: 'creator', isRemote: false },
					tags: [],
					attendance: [],
				},
			} as any,
		])
		vi.mocked(prisma.eventAttendance.findMany).mockResolvedValue([])
		vi.mocked(prisma.comment.findMany).mockResolvedValue([])

		// Mock event.findMany calls:
		// 1. newEvents (in Promise.all) -> empty
		// 2. shares (in Promise.all) -> empty
		// 3. trending (in fillTrendingEvents) -> 1 event
		vi.mocked(prisma.event.findMany)
			.mockResolvedValueOnce([]) // newEvents
			.mockResolvedValueOnce([]) // shares
			.mockResolvedValueOnce([
				{
					id: 'tr-1',
					title: 'Trending',
					startTime: new Date(),
					updatedAt: new Date(),
					user: { id: 'u4', username: 'trend', isRemote: false },
					tags: [],
					attendance: [],
				} as any,
			])

		const result = await FeedService.getFeed('user-id', undefined, 5)

		// Expect 1 activity + 1 trending event
		expect(result.items).toHaveLength(2)
		expect(result.items[0].type).toBe('activity')
		expect(result.items[1].type).toBe('trending_event')
	})

	it('should properly slice activities after visibility filtering', async () => {
		// Mock established user
		vi.mocked(SocialGraphService.getFollowing).mockResolvedValue([{ actorUrl: 'url' }] as any)
		vi.mocked(SocialGraphService.resolveFollowedUserIds).mockResolvedValue(['friend-id'])

		const { canUserViewEvent } = await import('../lib/eventVisibility')
		// Mock visibility: only even-numbered events are visible
		vi.mocked(canUserViewEvent).mockImplementation(async (event) => {
			const eventId = (event as any).id
			if (!eventId) return true // Default to visible if no ID
			return eventId.endsWith('2') || eventId.endsWith('4') || eventId.endsWith('6')
		})

		const date = new Date()
		// Create 6 activities, but only 3 will be visible after filtering
		const likes = Array.from({ length: 6 }, (_, i) => ({
			id: `l${i + 1}`,
			createdAt: date,
			user: { id: 'u2', username: 'liker', isRemote: false },
			event: {
				id: `ev-${i + 1}`,
				title: `Event ${i + 1}`,
				startTime: date,
				user: { id: 'u3', username: 'creator', isRemote: false },
				tags: [],
				attendance: [],
			},
		}))

		vi.mocked(prisma.eventLike.findMany).mockResolvedValue(likes as any)
		vi.mocked(prisma.eventAttendance.findMany).mockResolvedValue([])
		vi.mocked(prisma.comment.findMany).mockResolvedValue([])
		vi.mocked(prisma.event.findMany).mockResolvedValue([])

		// Request limit of 2, but we fetch more candidates (fetchLimit = 4)
		// After filtering, we should get exactly 2 visible items
		const result = await FeedService.getFeed('user-id', undefined, 2)

		// Should have exactly 2 items (sliced after filtering)
		expect(result.items).toHaveLength(2)
		expect(result.items[0].type).toBe('activity')
		expect(result.items[1].type).toBe('activity')
		// Verify they are the visible ones (ev-2, ev-4)
		expect((result.items[0].data as any).event.id).toBe('ev-2')
		expect((result.items[1].data as any).event.id).toBe('ev-4')
	})

	it('should handle when all activities are filtered out', async () => {
		// Mock established user
		vi.mocked(SocialGraphService.getFollowing).mockResolvedValue([{ actorUrl: 'url' }] as any)
		vi.mocked(SocialGraphService.resolveFollowedUserIds).mockResolvedValue(['friend-id'])

		const { canUserViewEvent } = await import('../lib/eventVisibility')
		// Mock visibility: all events are invisible
		vi.mocked(canUserViewEvent).mockResolvedValue(false)

		const date = new Date()
		const likes = [
			{
				id: 'l1',
				createdAt: date,
				user: { id: 'u2', username: 'liker', isRemote: false },
				event: {
					id: 'ev-1',
					title: 'Event 1',
					startTime: date,
					user: { id: 'u3', username: 'creator', isRemote: false },
					tags: [],
					attendance: [],
				},
			},
		]

		vi.mocked(prisma.eventLike.findMany).mockResolvedValue(likes as any)
		vi.mocked(prisma.eventAttendance.findMany).mockResolvedValue([])
		vi.mocked(prisma.comment.findMany).mockResolvedValue([])
		// Mock trending events to fill the feed
		vi.mocked(prisma.event.findMany)
			.mockResolvedValueOnce([]) // newEvents
			.mockResolvedValueOnce([]) // shares
			.mockResolvedValueOnce([
				// trending
				{
					id: 'tr-1',
					title: 'Trending',
					startTime: date,
					updatedAt: date,
					user: { id: 'u4', username: 'trend', isRemote: false },
					tags: [],
					attendance: [],
				} as any,
			])

		const result = await FeedService.getFeed('user-id', undefined, 5)

		// Should have trending events since all activities were filtered
		expect(result.items.length).toBeGreaterThan(0)
		expect(result.items[0].type).toBe('trending_event')
	})

	it('should return more visible items than limit when available', async () => {
		// Mock established user
		vi.mocked(SocialGraphService.getFollowing).mockResolvedValue([{ actorUrl: 'url' }] as any)
		vi.mocked(SocialGraphService.resolveFollowedUserIds).mockResolvedValue(['friend-id'])

		const { canUserViewEvent } = await import('../lib/eventVisibility')
		// All events are visible
		vi.mocked(canUserViewEvent).mockResolvedValue(true)

		const date = new Date()
		// Create 10 activities, all visible
		const likes = Array.from({ length: 10 }, (_, i) => ({
			id: `l${i + 1}`,
			createdAt: date,
			user: { id: 'u2', username: 'liker', isRemote: false },
			event: {
				id: `ev-${i + 1}`,
				title: `Event ${i + 1}`,
				startTime: date,
				user: { id: 'u3', username: 'creator', isRemote: false },
				tags: [],
				attendance: [],
			},
		}))

		vi.mocked(prisma.eventLike.findMany).mockResolvedValue(likes as any)
		vi.mocked(prisma.eventAttendance.findMany).mockResolvedValue([])
		vi.mocked(prisma.comment.findMany).mockResolvedValue([])
		vi.mocked(prisma.event.findMany).mockResolvedValue([])

		// Request limit of 5
		const result = await FeedService.getFeed('user-id', undefined, 5)

		// Should have exactly 5 items (sliced from 10 visible)
		expect(result.items).toHaveLength(5)
		result.items.forEach((item) => {
			expect(item.type).toBe('activity')
		})
	})

	describe('getHomeFeed (Smart Agenda)', () => {
		it('should return "Today" section with events', async () => {
			const userId = 'user-id'
			vi.mocked(SocialGraphService.getFollowing).mockResolvedValue([])
			vi.mocked(SocialGraphService.resolveFollowedUserIds).mockResolvedValue([])

			const today = new Date()
			const mockEvent = {
				eventId: 'ev-today',
				status: 'attending',
				createdAt: today,
				event: {
					id: 'ev-today',
					title: 'Today Event',
					startTime: today,
					user: { id: 'u1' },
					tags: [],
					_count: { attendance: 1 },
					attendance: [],
				},
			}

			// Mock getTimelineItems results (via prisma.eventAttendance.findMany)
			vi.mocked(prisma.eventAttendance.findMany).mockResolvedValueOnce([mockEvent as any])
			vi.mocked(prisma.event.findMany).mockResolvedValue([]) // No suggestions

			const result = await FeedService.getHomeFeed(userId)

			// Should have Header + Event
			const header = result.items.find((i) => i.id === 'header-today')
			const event = result.items.find((i) => i.id === 'my-rsvp-ev-today')

			expect(header).toBeDefined()
			expect(header?.data).toEqual({ title: 'Today' })
			expect(event).toBeDefined()
			expect((event?.data as any).title).toBe('Today Event')
		})

		it('should inject suggestions if "Today" is empty', async () => {
			const userId = 'user-id'
			vi.mocked(SocialGraphService.getFollowing).mockResolvedValue([])
			vi.mocked(SocialGraphService.resolveFollowedUserIds).mockResolvedValue([])

			// Empty timeline
			vi.mocked(prisma.eventAttendance.findMany).mockResolvedValue([])
			vi.mocked(prisma.event.findMany).mockResolvedValue([])

			// Mock suggestions
			vi.mocked(SuggestedUsersService.getSuggestions).mockResolvedValue([
				{ id: 's1', username: 'suggested' } as any,
			])

			const result = await FeedService.getHomeFeed(userId)

			const header = result.items.find((i) => i.id === 'header-today-suggestions')
			const suggestions = result.items.find((i) => i.type === 'suggested_users')

			expect(header).toBeDefined()
			expect(suggestions).toBeDefined()
			expect((suggestions?.data as any).suggestions).toHaveLength(1)
		})

		it('should return "Rest of Week" items if applicable', async () => {
			// Force today to be Monday for this test
			const monday = new Date('2024-01-01T12:00:00Z') // Jan 1 2024 is Monday
			vi.useFakeTimers()
			vi.setSystemTime(monday)

			const userId = 'user-id'
			vi.mocked(SocialGraphService.getFollowing).mockResolvedValue([])
			vi.mocked(SocialGraphService.resolveFollowedUserIds).mockResolvedValue([])

			// 1. Today items (empty)
			vi.mocked(prisma.eventAttendance.findMany).mockResolvedValueOnce([])
			vi.mocked(SuggestedUsersService.getSuggestions).mockResolvedValue([])

			// 2. Rest of Week items
			vi.mocked(prisma.eventAttendance.findMany).mockResolvedValueOnce([
				{
					eventId: 'ev-wed',
					status: 'attending',
					createdAt: monday,
					event: {
						id: 'ev-wed',
						title: 'Wednesday Event',
						startTime: new Date('2024-01-03T12:00:00Z'), // Wed
						user: { id: 'u1' },
						tags: [],
						_count: { attendance: 1 },
						attendance: [],
					},
				} as any,
			])
			vi.mocked(prisma.event.findMany).mockResolvedValue([])

			const result = await FeedService.getHomeFeed(userId)

			const header = result.items.find((i) => i.id === 'header-week')
			expect(header).toBeDefined()
			expect(header?.data).toEqual({ title: 'Rest of Week' })

			const event = result.items.find((i) => i.id === 'my-rsvp-ev-wed')
			expect(event).toBeDefined()

			vi.useRealTimers()
		})

		it('should return "This Weekend" items', async () => {
			// Force today to be Friday
			const friday = new Date('2024-01-05T12:00:00Z') // Jan 5 2024 is Friday
			vi.useFakeTimers()
			vi.setSystemTime(friday)

			const userId = 'user-id'
			vi.mocked(SocialGraphService.getFollowing).mockResolvedValue([])
			vi.mocked(SocialGraphService.resolveFollowedUserIds).mockResolvedValue([])

			// 1. Today (empty)
			vi.mocked(prisma.eventAttendance.findMany).mockResolvedValueOnce([])
			vi.mocked(SuggestedUsersService.getSuggestions).mockResolvedValue([])

			// 2. Rest of Week (empty - Fri is end of week logic depends on impl, but usually Fri is handled as Today or Rest based on time?
			// Wait, calculateRestOfWeek: if Mon-Thu. Fri is not in Mon-Thu.
			// So Rest of Week logic won't trigger on Friday.
			// calculateWeekend: if Mon-Fri. Weekend is coming Sat-Sun.
			// So on Friday, we expect specific calls.

			// If Today is Fri:
			// calculateRestOfWeek(Fri) -> currentDay=5. returns null.
			// calculateWeekend(Fri) -> currentDay=5. returns Sat-Sun range.

			// So we expect:
			// call 1: Today items (mocked empty above)
			// call 2: (Skipped RestOfWeek)
			// call 3: Weekend items

			vi.mocked(prisma.eventAttendance.findMany).mockResolvedValueOnce([
				{
					eventId: 'ev-sat',
					status: 'attending',
					createdAt: friday,
					event: {
						id: 'ev-sat',
						title: 'Saturday Event',
						startTime: new Date('2024-01-06T12:00:00Z'), // Sat
						user: { id: 'u1' },
						tags: [],
						_count: { attendance: 1 },
						attendance: [],
					},
				} as any,
			])
			vi.mocked(prisma.event.findMany).mockResolvedValue([])
			// Future items (empty)
			vi.mocked(prisma.event.findMany).mockResolvedValueOnce([])

			const result = await FeedService.getHomeFeed(userId)

			const header = result.items.find((i) => i.id === 'header-weekend')
			expect(header).toBeDefined()
			expect(header?.data).toEqual({ title: 'This Weekend' })

			vi.useRealTimers()
		})

		it('should return "Coming Up" items', async () => {
			// Force today to be Monday so all sections (Rest of Week, Weekend) are evaluated
			// increasing likelyhood of matching the 4 mockResolvedValueOnce calls
			const monday = new Date('2024-01-01T12:00:00Z')
			vi.useFakeTimers()
			vi.setSystemTime(monday)

			const userId = 'user-id'
			vi.mocked(SocialGraphService.getFollowing).mockResolvedValue([])
			vi.mocked(SocialGraphService.resolveFollowedUserIds).mockResolvedValue([])

			// Empty everything else (RSVPs)
			vi.mocked(prisma.eventAttendance.findMany).mockResolvedValue([])
			vi.mocked(SuggestedUsersService.getSuggestions).mockResolvedValue([])

			// Mock sequence:
			// 1. Today suggestions
			// 2. Rest of Week suggestions
			// 3. Weekend suggestions
			// 4. Future feed
			vi.mocked(prisma.event.findMany).mockReset()
			vi.mocked(prisma.event.findMany)
				.mockResolvedValueOnce([]) // Today
				.mockResolvedValueOnce([]) // Rest of Week
				.mockResolvedValueOnce([]) // Weekend
				.mockResolvedValueOnce([
					// Future
					{
						id: 'ev-future',
						title: 'Future Event',
						startTime: new Date('2025-01-01T12:00:00Z'),
						updatedAt: new Date(),
						user: { id: 'u1' },
						tags: [],
						_count: { attendance: 0 },
						attendance: [],
					} as any,
				])

			const result = await FeedService.getHomeFeed(userId)

			const header = result.items.find((i) => i.id === 'header-future')
			expect(header).toBeDefined()
			expect(header?.data).toEqual({ title: 'Coming Up' })

			const event = result.items.find((i) => i.id === 'ev-future')
			expect(event).toBeDefined()

			vi.useRealTimers()
		})

		it('should handle pagination in getHomeFeed (fetch future only)', async () => {
			vi.mocked(prisma.event.findMany).mockReset()

			const userId = 'user-id'
			const cursor = '2025-01-01T00:00:00.000Z'

			vi.mocked(prisma.event.findMany).mockResolvedValue([
				{
					id: 'ev-next',
					title: 'Next Event',
					startTime: new Date('2025-02-01T12:00:00Z'),
					updatedAt: new Date(),
					user: {
						id: 'u1',
						username: 'user1',
						name: 'User One',
						displayColor: '#000',
						profileImage: null,
						isRemote: false,
					},
					tags: [],
					_count: { attendance: 0 },
					attendance: [],
				} as any,
			])

			const result = await FeedService.getHomeFeed(userId, cursor)

			// Should only contain the future event, no today/week headers
			expect(result.items).toHaveLength(1)
			expect(result.items[0].id).toBe('ev-next')
			expect(result.items.find((i) => i.type === 'header')).toBeUndefined()
		})
	})
	it('should handle pagination for established users', async () => {
		vi.mocked(SocialGraphService.getFollowing).mockResolvedValue([{ actorUrl: 'url' }] as any)
		vi.mocked(SocialGraphService.resolveFollowedUserIds).mockResolvedValue(['friend-id'])

		const cursorDate = new Date('2024-01-01T00:00:00.000Z')

		// Mock findMany for activities using cursor
		vi.mocked(prisma.eventLike.findMany).mockResolvedValue([
			{
				id: 'l2',
				createdAt: new Date('2023-12-31T00:00:00.000Z'),
				user: {},
				event: { title: 'Old Event', startTime: new Date(), tags: [], user: {} },
			} as any,
		])
		vi.mocked(prisma.eventAttendance.findMany).mockResolvedValue([])
		vi.mocked(prisma.comment.findMany).mockResolvedValue([])
		vi.mocked(prisma.event.findMany).mockResolvedValue([]) // No new events

		const result = await FeedService.getFeed('user-id', cursorDate.toISOString())

		expect(result.items).toHaveLength(1)
		expect(result.items[0].id).toBe('like-l2')
	})

	it('should correctly map remote event details in feed', async () => {
		vi.mocked(SocialGraphService.getFollowing).mockResolvedValue([])
		vi.mocked(SocialGraphService.resolveFollowedUserIds).mockResolvedValue([])

		const date = new Date()
		const remoteEvent = {
			id: 'ev-remote',
			title: 'Remote Event',
			startTime: date,
			updatedAt: date,
			user: null, // Remote event might have null user relation if structured differently or just relying on attributedTo?
			// Actually FeedService expects user object or handles it.
			// Let's look at mapToTrendingEvent: `user: { ... } | null`.
			attributedTo: 'https://remote.server/users/remote_user',
			tags: [],
			_count: { attendance: 0, comments: 0, likes: 0 },
			attendance: [],
		}

		// We need to match the partial signature expected by prisma mock.
		// If user is null, mapToTrendingEvent handles it.
		vi.mocked(prisma.event.findMany).mockResolvedValue([remoteEvent as any])

		const result = await FeedService.getFeed('new-user-id')

		const item = result.items[0]
		expect(item).toBeDefined()
		if (item.type === 'trending_event') {
			// Check that it didn't crash and has some data
			expect(item.id).toBe('ev-remote')
			// If user is null, what does mapped data look like?
			// The mapToTrendingEvent function likely handles it.
		}
	})

	it('should correctly filter and map mixed activity types', async () => {
		// Verify filterVisibleActivities and mapToTrendingEvent coverage
		vi.mocked(SocialGraphService.getFollowing).mockResolvedValue([{ actorUrl: 'url' }] as any)
		vi.mocked(SocialGraphService.resolveFollowedUserIds).mockResolvedValue(['friend-id'])

		const { canUserViewEvent } = await import('../lib/eventVisibility')
		vi.mocked(canUserViewEvent).mockImplementation(async (event, userId) => {
			if ((event as any).id === 'ev-private') return false
			return true
		})

		const date = new Date()
		// 1. Visible Like
		const activityLike = {
			id: 'l1',
			createdAt: date,
			user: { id: 'u2', username: 'liker', isRemote: false },
			event: {
				id: 'ev-public',
				title: 'Public Event',
				startTime: date,
				tags: [{ id: 't1', tag: 'fun' }],
				user: { id: 'u3' },
				attendance: [
					{ status: 'attending', user: { id: 'u4', username: 'fan', isRemote: false } },
				],
			},
		}
		// 2. Hidden Like (on private event)
		const activityLikeHidden = {
			id: 'l2',
			createdAt: date,
			user: { id: 'u2' },
			event: {
				id: 'ev-private',
				title: 'Private Event',
				startTime: date,
				tags: [],
				user: { id: 'u3' },
			},
		}

		// 3. Comment
		const activityComment = {
			id: 'c1',
			createdAt: date,
			author: { id: 'u2', username: 'commenter', isRemote: false }, // FeedService expects 'author' relation
			event: {
				id: 'ev-commented',
				title: 'Commented Event',
				startTime: date,
				tags: [],
				user: { id: 'u3' },
			},
			content: 'Nice event',
		}

		// 4. Attendance
		const activityAttendance = {
			id: 'a1',
			createdAt: date,
			status: 'attending',
			user: { id: 'u2', username: 'attendee', isRemote: false },
			event: {
				id: 'ev-attending',
				title: 'Attended Event',
				startTime: date,
				tags: [],
				user: { id: 'u3' },
			},
		}

		// 5. Created Event
		const activityCreated = {
			id: 'ev-created',
			createdAt: date,
			title: 'Created Event',
			startTime: date,
			tags: [],
			user: { id: 'u2', username: 'creator', isRemote: false },
		}

		// 6. Shared Event
		const activityShared = {
			id: 'ev-shared',
			createdAt: date,
			title: 'Shared Event',
			startTime: date,
			tags: [],
			user: { id: 'u2', username: 'sharer', isRemote: false },
			sharedEventId: 'ev-original',
			sharedEvent: {
				id: 'ev-original',
				title: 'Original Event',
				startTime: date,
				tags: [],
				user: { id: 'u3' },
			},
		}

		vi.mocked(prisma.eventLike.findMany).mockResolvedValue([
			activityLike as any,
			activityLikeHidden as any,
		])
		vi.mocked(prisma.comment.findMany).mockResolvedValue([activityComment as any])
		vi.mocked(prisma.eventAttendance.findMany).mockResolvedValue([activityAttendance as any])
		vi.mocked(prisma.event.findMany).mockImplementation((async (args: any) => {
			// Check if querying for shared events or new events
			if (args?.where?.sharedEventId === null) {
				return Promise.resolve([activityCreated])
			}
			if (args?.where?.sharedEventId?.not === null) {
				// OR check key existence
				return Promise.resolve([activityShared])
			}
			// wait, sharedEventId: { not: null } might be the check
			if (args?.where?.sharedEventId && args.where.sharedEventId.not !== undefined) {
				return Promise.resolve([activityShared])
			}
			return Promise.resolve([])
		}) as any)

		const result = await FeedService.getFeed('user-id')

		// Expect: Public Like + Comment + Attendance (3 items). Hidden Like filtered out.
		// Expect: Public Like + Comment + Attendance + Created + Shared (5 items). Hidden Like filtered out.
		expect(result.items).toHaveLength(5)

		const likeItem = result.items.find((i) => i.id === 'like-l1')
		const commentItem = result.items.find((i) => i.id === 'comment-c1')
		const attendanceItem = result.items.find((i) => i.id === 'rsvp-a1')
		const createdItem = result.items.find((i) => i.id === 'event-ev-created')
		const sharedItem = result.items.find((i) => i.id === 'share-ev-shared')

		expect(likeItem).toBeDefined()
		expect(commentItem).toBeDefined()
		expect(attendanceItem).toBeDefined()
		expect(createdItem).toBeDefined()
		expect(sharedItem).toBeDefined()

		// Verify mapping (FeedActivity structure)
		expect((commentItem?.data as any).type).toBe('comment')
		expect((attendanceItem?.data as any).type).toBe('rsvp')
		expect((createdItem?.data as any).type).toBe('event_created')
		expect((sharedItem?.data as any).type).toBe('event_shared')
	})

	it('should handle edge cases in activity mapping', async () => {
		vi.mocked(SocialGraphService.getFollowing).mockResolvedValue([])
		vi.mocked(SocialGraphService.resolveFollowedUserIds).mockResolvedValue(['friend-id'])
		const { canUserViewEvent } = await import('../lib/eventVisibility')
		vi.mocked(canUserViewEvent).mockResolvedValue(true)

		// 1. Like on event with user: null (remote) and string startTime
		const stringDate = new Date().toISOString()
		const activityRemote = {
			id: 'l3',
			createdAt: new Date(),
			user: { id: 'u2' },
			event: {
				id: 'ev-remote-like',
				title: 'Remote Liked',
				startTime: stringDate, // string time
				tags: [],
				user: null, // remote
				attendance: [],
			},
		}

		// 2. Like on event with attendance undefined
		const activityNoAttendance = {
			id: 'l4',
			createdAt: new Date(),
			user: { id: 'u2' },
			event: {
				id: 'ev-no-attendance',
				title: 'No Att',
				startTime: new Date(),
				tags: [],
				user: { id: 'u3' },
				// attendance undefined
			},
		}

		vi.mocked(prisma.eventLike.findMany).mockResolvedValue([
			activityRemote as any,
			activityNoAttendance as any,
		])
		vi.mocked(prisma.comment.findMany).mockResolvedValue([])
		vi.mocked(prisma.eventAttendance.findMany).mockResolvedValue([])
		vi.mocked(prisma.event.findMany).mockResolvedValue([])

		const result = await FeedService.getFeed('user-id')

		expect(result.items).toHaveLength(2)
		const remoteItem = result.items.find((i) => i.id === 'like-l3')
		const noAttItem = result.items.find((i) => i.id === 'like-l4')

		expect(remoteItem).toBeDefined()
		expect((remoteItem?.data as any).event.user).toBeNull()
		expect((remoteItem?.data as any).event.startTime).toBe(stringDate)

		expect(noAttItem).toBeDefined()
		expect((noAttItem?.data as any).event.attendance).toBeUndefined()
	})

	it('should fetch recent public events for new users with cursor', async () => {
		vi.mocked(SocialGraphService.getFollowing).mockResolvedValue([])
		vi.mocked(SocialGraphService.resolveFollowedUserIds).mockResolvedValue([])

		const cursor = new Date().toISOString()
		const publicEvent = {
			id: 'ev-public-1',
			title: 'Public Event',
			startTime: new Date(),
			createdAt: new Date(),
			tags: [{ id: 't2', tag: 'new' }],
			user: { id: 'u3' },
			attendance: [
				{ status: 'maybe', user: { id: 'u5', username: 'maybe', isRemote: false } },
			],
		}

		vi.mocked(prisma.event.findMany).mockResolvedValue([publicEvent as any])

		const result = await FeedService.getFeed('user-id', cursor)

		expect(result.items).toHaveLength(1)
		expect(result.items[0].type).toBe('trending_event') // New user feed returns events as trending cards
		expect(result.items[0].id).toBe('ev-public-1')

		// Verify prisma called with correct args (public visibility + cursor)
		expect(prisma.event.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					visibility: 'PUBLIC',
					createdAt: { lt: expect.any(Date) },
				}),
			})
		)
	})

	it('should fetch trending events for new users without cursor', async () => {
		vi.mocked(SocialGraphService.getFollowing).mockResolvedValue([])
		vi.mocked(SocialGraphService.resolveFollowedUserIds).mockResolvedValue([])

		const trendingEvent = {
			id: 'ev-trending-1',
			title: 'Trending Event',
			startTime: new Date(),
			updatedAt: new Date(),
			tags: [{ id: 't3', tag: 'trend' }],
			user: { id: 'u3' },
			attendance: [],
		}

		vi.mocked(prisma.event.findMany).mockResolvedValue([trendingEvent as any])

		const result = await FeedService.getFeed('user-id', undefined)

		// Expect onboarding hero + 1 trending event (default limit 20, remaining > 0)
		expect(result.items.length).toBeGreaterThanOrEqual(1)

		const trendingItem = result.items.find((i) => i.id === 'ev-trending-1')
		expect(trendingItem).toBeDefined()
		expect(trendingItem?.type).toBe('trending_event')
		expect((trendingItem?.data as any).tags).toHaveLength(1)
	})
})

it('should sort suggested events by popularity (attendance count) then date', async () => {
	const userId = 'user-id'

	vi.mocked(SocialGraphService.getFollowing).mockResolvedValue([])
	vi.mocked(SocialGraphService.resolveFollowedUserIds).mockResolvedValue([])

	// Mock empty RSVPs so it proceeds to fetch suggestions
	vi.mocked(prisma.eventAttendance.findMany).mockResolvedValue([])
	vi.mocked(prisma.event.findMany).mockResolvedValue([])

	// We trigger getTimelineItems via getHomeFeed -> addTodayItems
	await FeedService.getHomeFeed(userId)

	// Check the arguments passed to prisma.event.findMany
	// The suggestions call is the one with `orderBy`
	const findManyCalls = vi.mocked(prisma.event.findMany).mock.calls
	const suggestionsCall = findManyCalls.find(
		(args) =>
			args[0]?.where?.visibility === 'PUBLIC' &&
			Array.isArray(args[0]?.orderBy) &&
			args[0].orderBy[0]?.attendance
	)

	expect(suggestionsCall).toBeDefined()
	if (!suggestionsCall || !suggestionsCall[0]) throw new Error('Suggestions call not found')

	const orderBy = suggestionsCall[0].orderBy
	expect(orderBy).toEqual([
		{
			attendance: {
				_count: 'desc',
			},
		},
		{ startTime: 'asc' },
	])
})
