import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SocialGraphService } from '../../services/SocialGraphService'
import { prisma } from '../../lib/prisma'

vi.mock('../../lib/prisma', () => ({
    prisma: {
        following: {
            findMany: vi.fn(),
        },
        user: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
        }
    }
}))

describe('SocialGraphService', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('getFollowing', () => {
        it('should return followed users', async () => {
            const mockFollowing = [{ actorUrl: 'url1', username: 'user1', accepted: true }]
            ;(prisma.following.findMany as any).mockResolvedValue(mockFollowing)

            const result = await SocialGraphService.getFollowing('user1')
            expect(result).toEqual(mockFollowing)
        })
    })

    describe('resolveFollowedUserIds', () => {
        it('should resolve user IDs from following list', async () => {
            const following = [
                { actorUrl: 'http://test.local/local1' }
            ]

            // Mock resolveActorUser internally since we are testing the loop logic
            vi.spyOn(SocialGraphService, 'resolveActorUser').mockResolvedValue({ id: 'id1' } as any)

            const result = await SocialGraphService.resolveFollowedUserIds(following)
            expect(result).toEqual(['id1'])
        })
    })
})
