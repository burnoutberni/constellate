import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '../../lib/prisma.js'
import { SuggestedUsersService } from '../../services/SuggestedUsersService.js'

// Mock dependencies
vi.mock('../../lib/prisma.js', () => ({
	prisma: {
		following: {
			findMany: vi.fn(),
		},
		event: {
			groupBy: vi.fn(),
		},
		user: {
			findMany: vi.fn(),
		},
	},
}))

vi.mock('../../lib/activitypubHelpers.js', () => ({
	getBaseUrl: vi.fn(() => 'https://constellate.app'),
}))

describe('SuggestedUsersService', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('should return suggestions excluding followed users', async () => {
		const userId = 'user-1'

		// Mock following
		vi.mocked(prisma.following.findMany).mockResolvedValue([
			{ actorUrl: 'https://other.instance/users/followed' } as any,
		])

		// Mock recent event creators
		vi.mocked(prisma.event.groupBy).mockResolvedValue([
			{ userId: 'suggested-1', _count: { id: 5 } },
			{ userId: 'suggested-2', _count: { id: 3 } },
		] as any)

		// Mock candidate users
		const candidates = [
			{
				id: 'suggested-1',
				username: 'alice',
				name: 'Alice',
				isRemote: false,
				externalActorUrl: null, // should default to base url construction
				_count: { followers: 10, events: 5 },
			},
			{
				id: 'suggested-2',
				username: 'bob',
				name: 'Bob',
				isRemote: true,
				externalActorUrl: 'https://other.instance/users/bob',
				_count: { followers: 20, events: 3 },
			},
		]
		vi.mocked(prisma.user.findMany).mockResolvedValue(candidates as any)

		const suggestions = await SuggestedUsersService.getSuggestions(userId)

		// Verification
		expect(prisma.following.findMany).toHaveBeenCalledWith({
			where: { userId },
			select: { actorUrl: true },
		})

		expect(prisma.event.groupBy).toHaveBeenCalled()
		expect(prisma.user.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					id: { in: ['suggested-1', 'suggested-2'], not: userId },
				},
			})
		)

		// Should define correct ordering based on followers count (desc)
		// Bob (20 followers) should be before Alice (10 followers)
		expect(suggestions).toHaveLength(2)
		expect(suggestions[0].username).toBe('bob')
		expect(suggestions[1].username).toBe('alice')
	})

	it('should exclude users that are already followed', async () => {
		const userId = 'user-1'

		// Mock following Alice
		vi.mocked(prisma.following.findMany).mockResolvedValue([
			{ actorUrl: 'https://constellate.app/users/alice' } as any,
		])

		// Mock recent creators
		vi.mocked(prisma.event.groupBy).mockResolvedValue([
			{ userId: 'suggested-1', _count: { id: 5 } }, // Alice
		] as any)

		// Mock candidate users
		const candidates = [
			{
				id: 'suggested-1',
				username: 'alice',
				isRemote: false,
				externalActorUrl: null,
				_count: { followers: 10 },
			},
		]
		vi.mocked(prisma.user.findMany).mockResolvedValue(candidates as any)

		const suggestions = await SuggestedUsersService.getSuggestions(userId)

		expect(suggestions).toHaveLength(0)
	})

	it('should handle remote users with externalActorUrl correctly', async () => {
		const userId = 'user-1'

		// Mock following
		vi.mocked(prisma.following.findMany).mockResolvedValue([
			{ actorUrl: 'https://remote.instance/users/charlie' } as any,
		])

		vi.mocked(prisma.event.groupBy).mockResolvedValue([
			{ userId: 'suggested-3', _count: { id: 1 } },
		] as any)

		const candidates = [
			{
				id: 'suggested-3',
				username: 'charlie',
				isRemote: true,
				externalActorUrl: 'https://remote.instance/users/charlie',
				_count: { followers: 5 },
			},
		]
		vi.mocked(prisma.user.findMany).mockResolvedValue(candidates as any)

		const suggestions = await SuggestedUsersService.getSuggestions(userId)

		// Should be excluded because we follow 'https://remote.instance/users/charlie'
		expect(suggestions).toHaveLength(0)
	})

	it('should handle sorting when _count is undefined', async () => {
		const userId = 'user-1'
		vi.mocked(prisma.following.findMany).mockResolvedValue([])
		vi.mocked(prisma.event.groupBy).mockResolvedValue([{ userId: 'a' }, { userId: 'b' }] as any)

		const candidates = [
			{
				id: 'a',
				username: 'a',
				_count: undefined, // No counts
			},
			{
				id: 'b',
				username: 'b',
				_count: { followers: 5 },
			},
		]
		vi.mocked(prisma.user.findMany).mockResolvedValue(candidates as any)

		const suggestions = await SuggestedUsersService.getSuggestions(userId)

		// b (5) > a (0)
		expect(suggestions[0].username).toBe('b')
		expect(suggestions[1].username).toBe('a')
	})

	it('should filter out null userIds from event creators', async () => {
		const userId = 'user-1'
		vi.mocked(prisma.following.findMany).mockResolvedValue([])

		// Mock null userId
		vi.mocked(prisma.event.groupBy).mockResolvedValue([
			{ userId: null, _count: { id: 1 } },
			{ userId: 'valid-id', _count: { id: 5 } },
		] as any)

		vi.mocked(prisma.user.findMany).mockResolvedValue([
			{ id: 'valid-id', username: 'valid' },
		] as any)

		await SuggestedUsersService.getSuggestions(userId)

		expect(prisma.user.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					id: { in: ['valid-id'], not: userId },
				},
			})
		)
	})
})
