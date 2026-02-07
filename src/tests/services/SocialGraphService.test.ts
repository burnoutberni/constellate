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
        vi.restoreAllMocks() // Restore spies
    })

    describe('getFollowing', () => {
        it('should return followed users', async () => {
            const mockFollowing = [{ actorUrl: 'url1', username: 'user1', accepted: true }]
            ;(prisma.following.findMany as any).mockResolvedValue(mockFollowing)

            const result = await SocialGraphService.getFollowing('user1')
            expect(result).toEqual(mockFollowing)
        })
    })

    describe('resolveActorUser', () => {
        it('should resolve local user by username', async () => {
            const baseUrl = 'http://test.local'
            const actorUrl = 'http://test.local/user1'
            const mockUser = { id: 'local1' }
            ;(prisma.user.findUnique as any).mockResolvedValue(mockUser)

            const result = await SocialGraphService.resolveActorUser(actorUrl, baseUrl)
            expect(result).toEqual(mockUser)
            expect(prisma.user.findUnique).toHaveBeenCalledWith({
                where: { username: 'user1', isRemote: false },
                select: { id: true }
            })
        })

        it('should return null for invalid local user format', async () => {
            const baseUrl = 'http://test.local'
            const actorUrl = 'http://test.local/' // No username

            const result = await SocialGraphService.resolveActorUser(actorUrl, baseUrl)
            expect(result).toBeNull()
        })

        it('should resolve remote user by actor url', async () => {
            const baseUrl = 'http://test.local'
            const actorUrl = 'http://remote.com/users/user1'
            const mockUser = { id: 'remote1' }
            ;(prisma.user.findFirst as any).mockResolvedValue(mockUser)

            const result = await SocialGraphService.resolveActorUser(actorUrl, baseUrl)
            expect(result).toEqual(mockUser)
            expect(prisma.user.findFirst).toHaveBeenCalledWith({
                where: { externalActorUrl: actorUrl, isRemote: true },
                select: { id: true }
            })
        })
    })

    describe('resolveFollowedUserIds', () => {
        it('should resolve user IDs from following list', async () => {
            const following = [
                { actorUrl: 'http://test.local/local1' }
            ]

            // Mock resolveActorUser
            vi.spyOn(SocialGraphService, 'resolveActorUser').mockResolvedValue({ id: 'id1' } as any)

            const result = await SocialGraphService.resolveFollowedUserIds(following)
            expect(result).toEqual(['id1'])
        })
    })
})
