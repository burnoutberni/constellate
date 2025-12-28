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
})
