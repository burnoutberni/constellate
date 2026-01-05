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
})
