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
})
