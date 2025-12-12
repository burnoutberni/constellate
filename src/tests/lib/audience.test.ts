import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { PUBLIC_COLLECTION } from '../../constants/activitypub.js'
import {
	getPublicAddressing,
	getFollowersAddressing,
	getDirectAddressing,
	getFollowerInboxes,
	getActorInboxes,
	resolveInboxes,
} from '../../lib/audience.js'
import { prisma } from '../../lib/prisma.js'

vi.mock('../../lib/prisma.js', () => ({
	prisma: {
		user: {
			findUnique: vi.fn(),
		},
		follower: {
			findMany: vi.fn(),
		},
	},
}))

vi.mock('../../lib/activitypubHelpers.js', () => ({
	getBaseUrl: vi.fn(() => 'http://localhost:3000'),
}))

const mockUserFind = prisma.user.findUnique as unknown as Mock
const mockFollowerFind = prisma.follower.findMany as unknown as Mock

describe('audience helpers', () => {
	beforeEach(() => {
		mockUserFind.mockReset()
		mockFollowerFind.mockReset()
	})

	describe('getPublicAddressing', () => {
		it('should return public addressing with followers', async () => {
			const userId = 'user-123'
			const mockUser = {
				id: userId,
				username: 'alice',
			}

			mockUserFind.mockResolvedValue(mockUser as any)

			const addressing = await getPublicAddressing(userId)

			expect(addressing.to).toEqual([PUBLIC_COLLECTION])
			expect(addressing.cc).toEqual(['http://localhost:3000/users/alice/followers'])
			expect(addressing.bcc).toEqual([])
		})

		it('should throw error when user not found', async () => {
			mockUserFind.mockResolvedValue(null)

			await expect(getPublicAddressing('nonexistent')).rejects.toThrow('User not found')
		})

		it('should query user by id', async () => {
			const userId = 'user-123'
			const mockUser = {
				id: userId,
				username: 'alice',
			}

			mockUserFind.mockResolvedValue(mockUser as any)

			await getPublicAddressing(userId)

			expect(mockUserFind).toHaveBeenCalledWith({
				where: { id: userId },
			})
		})
	})

	describe('getFollowersAddressing', () => {
		it('should return followers-only addressing', async () => {
			const userId = 'user-123'
			const mockUser = {
				id: userId,
				username: 'alice',
			}

			mockUserFind.mockResolvedValue(mockUser as any)

			const addressing = await getFollowersAddressing(userId)

			expect(addressing.to).toEqual(['http://localhost:3000/users/alice/followers'])
			expect(addressing.cc).toEqual([])
			expect(addressing.bcc).toEqual([])
		})

		it('should throw error when user not found', async () => {
			mockUserFind.mockResolvedValue(null)

			await expect(getFollowersAddressing('nonexistent')).rejects.toThrow('User not found')
		})
	})

	describe('getDirectAddressing', () => {
		it('should return direct addressing for specific actors', () => {
			const actorUrls = ['https://example.com/users/alice', 'https://example.com/users/bob']

			const addressing = getDirectAddressing(actorUrls)

			expect(addressing.to).toEqual(actorUrls)
			expect(addressing.cc).toEqual([])
			expect(addressing.bcc).toEqual([])
		})

		it('should handle empty array', () => {
			const addressing = getDirectAddressing([])

			expect(addressing.to).toEqual([])
			expect(addressing.cc).toEqual([])
			expect(addressing.bcc).toEqual([])
		})

		it('should handle single actor', () => {
			const actorUrl = 'https://example.com/users/alice'
			const addressing = getDirectAddressing([actorUrl])

			expect(addressing.to).toEqual([actorUrl])
		})
	})

	describe('getFollowerInboxes', () => {
		it('should return inbox URLs for followers', async () => {
			const userId = 'user-123'
			const mockFollowers = [
				{
					inboxUrl: 'https://example.com/users/alice/inbox',
					sharedInboxUrl: 'https://example.com/shared/inbox',
				},
				{
					inboxUrl: 'https://example.com/users/bob/inbox',
					sharedInboxUrl: null,
				},
			]

			mockFollowerFind.mockResolvedValue(mockFollowers as any)

			const inboxes = await getFollowerInboxes(userId)

			expect(inboxes).toContain('https://example.com/shared/inbox')
			expect(inboxes).toContain('https://example.com/users/bob/inbox')
			expect(inboxes.length).toBe(2)
		})

		it('should prefer shared inbox over personal inbox', async () => {
			const userId = 'user-123'
			const mockFollowers = [
				{
					inboxUrl: 'https://example.com/users/alice/inbox',
					sharedInboxUrl: 'https://example.com/shared/inbox',
				},
			]

			mockFollowerFind.mockResolvedValue(mockFollowers as any)

			const inboxes = await getFollowerInboxes(userId)

			expect(inboxes).toContain('https://example.com/shared/inbox')
			expect(inboxes).not.toContain('https://example.com/users/alice/inbox')
		})

		it('should deduplicate shared inboxes', async () => {
			mockFollowerFind.mockResolvedValue([
				{ inboxUrl: 'https://a/inbox', sharedInboxUrl: null },
				{ inboxUrl: 'https://b/inbox', sharedInboxUrl: 'https://shared/inbox' },
				{ inboxUrl: 'https://c/inbox', sharedInboxUrl: 'https://shared/inbox' },
			])
			const inboxes = await getFollowerInboxes('user_1')
			expect(inboxes).toEqual(['https://a/inbox', 'https://shared/inbox'])
		})

		it('should only return accepted followers', async () => {
			const userId = 'user-123'

			mockFollowerFind.mockResolvedValue([])

			await getFollowerInboxes(userId)

			expect(mockFollowerFind).toHaveBeenCalledWith({
				where: {
					userId,
					accepted: true,
				},
			})
		})

		it('should return empty array when no followers', async () => {
			mockFollowerFind.mockResolvedValue([])

			const inboxes = await getFollowerInboxes('user-123')

			expect(inboxes).toEqual([])
		})
	})

	describe('getActorInboxes', () => {
		it('should return inbox URLs for remote actors', async () => {
			const actorUrls = ['https://example.com/users/alice']
			const mockUser = {
				id: 'user-123',
				inboxUrl: 'https://example.com/users/alice/inbox',
				sharedInboxUrl: 'https://example.com/shared/inbox',
				isRemote: true,
			}

			mockUserFind.mockResolvedValue(mockUser as any)

			const inboxes = await getActorInboxes(actorUrls)

			expect(inboxes).toContain('https://example.com/shared/inbox')
		})

		it('should skip local users', async () => {
			const actorUrls = ['http://localhost:3000/users/alice']
			const mockUser = {
				id: 'user-123',
				isRemote: false,
			}

			mockUserFind.mockResolvedValue(mockUser as any)

			const inboxes = await getActorInboxes(actorUrls)

			expect(inboxes).toEqual([])
		})

		it('should skip local non-remote users and returns remote inboxes', async () => {
			mockUserFind.mockImplementation(
				async ({
					where,
				}: {
					where?: { username?: string; externalActorUrl?: string; isRemote?: boolean }
				}) => {
					if (where?.username === 'localuser') {
						return { id: 'local', isRemote: false }
					}
					if (where?.externalActorUrl === 'https://remote.example/users/bob') {
						return {
							id: 'remote',
							inboxUrl: 'https://remote.example/inbox',
							sharedInboxUrl: null,
						}
					}
					return null
				}
			)

			const inboxes = await getActorInboxes([
				'http://localhost:3000/users/localuser',
				'https://remote.example/users/bob',
			])

			expect(inboxes).toEqual(['https://remote.example/inbox'])
		})

		it('should prefer shared inbox over personal inbox', async () => {
			const actorUrls = ['https://example.com/users/alice']
			const mockUser = {
				id: 'user-123',
				inboxUrl: 'https://example.com/users/alice/inbox',
				sharedInboxUrl: 'https://example.com/shared/inbox',
				isRemote: true,
			}

			mockUserFind.mockResolvedValue(mockUser as any)

			const inboxes = await getActorInboxes(actorUrls)

			expect(inboxes).toContain('https://example.com/shared/inbox')
			expect(inboxes).not.toContain('https://example.com/users/alice/inbox')
		})

		it('should use personal inbox when shared inbox not available', async () => {
			const actorUrls = ['https://example.com/users/alice']
			const mockUser = {
				id: 'user-123',
				inboxUrl: 'https://example.com/users/alice/inbox',
				sharedInboxUrl: null,
				isRemote: true,
			}

			mockUserFind.mockResolvedValue(mockUser as any)

			const inboxes = await getActorInboxes(actorUrls)

			expect(inboxes).toContain('https://example.com/users/alice/inbox')
		})

		it('should return empty array when actor not found', async () => {
			const actorUrls = ['https://example.com/users/nonexistent']

			mockUserFind.mockResolvedValue(null)

			const inboxes = await getActorInboxes(actorUrls)

			expect(inboxes).toEqual([])
		})

		it('should handle multiple actors', async () => {
			const actorUrls = ['https://example.com/users/alice', 'https://example.com/users/bob']

			mockUserFind
				.mockResolvedValueOnce({
					id: 'user-1',
					inboxUrl: 'https://example.com/users/alice/inbox',
					sharedInboxUrl: null,
					isRemote: true,
				} as any)
				.mockResolvedValueOnce({
					id: 'user-2',
					inboxUrl: 'https://example.com/users/bob/inbox',
					sharedInboxUrl: null,
					isRemote: true,
				} as any)

			const inboxes = await getActorInboxes(actorUrls)

			expect(inboxes.length).toBe(2)
			expect(inboxes).toContain('https://example.com/users/alice/inbox')
			expect(inboxes).toContain('https://example.com/users/bob/inbox')
		})
	})

	describe('resolveInboxes', () => {
		it('aggregates inboxes from public, followers, and direct recipients', async () => {
			mockFollowerFind
				.mockResolvedValueOnce([{ inboxUrl: 'sender-follow', sharedInboxUrl: null }])
				.mockResolvedValueOnce([{ inboxUrl: 'target-follow', sharedInboxUrl: null }])

			mockUserFind.mockImplementation(
				async ({
					where,
				}: {
					where?: { username?: string; externalActorUrl?: string; isRemote?: boolean }
				}) => {
					if (where?.externalActorUrl === 'https://remote.example/users/alice') {
						return {
							id: 'remote-alice',
							inboxUrl: 'alice-inbox',
							sharedInboxUrl: null,
						}
					}
					if (where?.externalActorUrl === 'https://remote.example/users/bob') {
						return { id: 'remote-bob', inboxUrl: 'bob-inbox', sharedInboxUrl: null }
					}
					if (where?.username === 'target' && where?.isRemote === false) {
						return { id: 'target-id', username: 'target', isRemote: false }
					}
					return null
				}
			)

			const addressing = {
				to: [PUBLIC_COLLECTION, 'https://remote.example/users/alice'],
				cc: ['http://localhost:3000/users/target/followers'],
				bcc: ['https://remote.example/users/bob'],
			}

			const inboxes = await resolveInboxes(addressing, 'sender-id')

			expect(inboxes).toEqual(
				expect.arrayContaining([
					'sender-follow',
					'target-follow',
					'alice-inbox',
					'bob-inbox',
				])
			)
		})

		it('should resolve PUBLIC_COLLECTION to follower inboxes', async () => {
			const userId = 'user-123'
			const addressing = {
				to: [PUBLIC_COLLECTION],
				cc: [],
				bcc: [],
			}

			const mockFollowers = [
				{
					inboxUrl: 'https://example.com/users/alice/inbox',
					sharedInboxUrl: 'https://example.com/shared/inbox',
				},
			]

			mockFollowerFind.mockResolvedValue(mockFollowers as any)

			const inboxes = await resolveInboxes(addressing, userId)

			expect(inboxes).toContain('https://example.com/shared/inbox')
		})

		it('should resolve followers collection URL', async () => {
			const userId = 'user-123'
			const addressing = {
				to: ['http://localhost:3000/users/alice/followers'],
				cc: [],
				bcc: [],
			}

			const mockUser = {
				id: 'user-alice',
				username: 'alice',
				isRemote: false,
			}

			const mockFollowers = [
				{
					inboxUrl: 'https://example.com/users/follower/inbox',
					sharedInboxUrl: null,
				},
			]

			mockUserFind.mockResolvedValueOnce(mockUser as any)
			mockFollowerFind.mockResolvedValue(mockFollowers as any)

			const inboxes = await resolveInboxes(addressing, userId)

			expect(inboxes).toContain('https://example.com/users/follower/inbox')
		})

		it('should resolve specific actor URLs', async () => {
			const userId = 'user-123'
			const addressing = {
				to: ['https://example.com/users/alice'],
				cc: [],
				bcc: [],
			}

			const mockUser = {
				id: 'user-1',
				inboxUrl: 'https://example.com/users/alice/inbox',
				sharedInboxUrl: null,
				isRemote: true,
			}

			mockUserFind.mockResolvedValue(mockUser as any)

			const inboxes = await resolveInboxes(addressing, userId)

			expect(inboxes).toContain('https://example.com/users/alice/inbox')
		})

		it('should process cc field', async () => {
			const userId = 'user-123'
			const addressing = {
				to: [],
				cc: [PUBLIC_COLLECTION],
				bcc: [],
			}

			const mockFollowers = [
				{
					inboxUrl: 'https://example.com/users/alice/inbox',
					sharedInboxUrl: null,
				},
			]

			mockFollowerFind.mockResolvedValue(mockFollowers as any)

			const inboxes = await resolveInboxes(addressing, userId)

			expect(inboxes).toContain('https://example.com/users/alice/inbox')
		})

		it('should process bcc field', async () => {
			const userId = 'user-123'
			const addressing = {
				to: [],
				cc: [],
				bcc: ['https://example.com/users/alice'],
			}

			const mockUser = {
				id: 'user-1',
				inboxUrl: 'https://example.com/users/alice/inbox',
				sharedInboxUrl: null,
				isRemote: true,
			}

			mockUserFind.mockResolvedValue(mockUser as any)

			const inboxes = await resolveInboxes(addressing, userId)

			expect(inboxes).toContain('https://example.com/users/alice/inbox')
		})

		it('should deduplicate inboxes across all fields', async () => {
			const userId = 'user-123'
			const addressing = {
				to: [PUBLIC_COLLECTION],
				cc: [PUBLIC_COLLECTION], // Same as 'to'
				bcc: [],
			}

			const mockFollowers = [
				{
					inboxUrl: 'https://example.com/shared/inbox',
					sharedInboxUrl: 'https://example.com/shared/inbox',
				},
			]

			mockFollowerFind.mockResolvedValue(mockFollowers as any)

			const inboxes = await resolveInboxes(addressing, userId)

			// Should only appear once even though it's in both 'to' and 'cc'
			expect(inboxes.filter((i) => i === 'https://example.com/shared/inbox').length).toBe(1)
		})

		it('should handle empty addressing', async () => {
			const userId = 'user-123'
			const addressing = {
				to: [],
				cc: [],
				bcc: [],
			}

			const inboxes = await resolveInboxes(addressing, userId)

			expect(inboxes).toEqual([])
		})

		it('should handle non-local followers collection URLs', async () => {
			const userId = 'user-123'
			const addressing = {
				to: ['https://example.com/users/alice/followers'],
				cc: [],
				bcc: [],
			}

			// Should not resolve non-local URLs
			const inboxes = await resolveInboxes(addressing, userId)

			expect(inboxes).toEqual([])
		})
	})
})
