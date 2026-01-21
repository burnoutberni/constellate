import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SocialGraphService } from '../../services/SocialGraphService'
import { prisma } from '../../lib/prisma'

vi.mock('../../lib/prisma', () => ({
	prisma: {
		user: {
			findUnique: vi.fn(),
			findFirst: vi.fn(),
			findMany: vi.fn(),
		},
		following: {
			findMany: vi.fn(),
		},
	},
}))

describe('SocialGraphService', () => {
	beforeEach(() => {
		vi.clearAllMocks()
        process.env.BASE_URL = 'http://localhost:3000'
	})

    it('resolveFollowedUserIds should resolve local and remote users using batch queries', async () => {
        const following = [
            { actorUrl: 'http://localhost:3000/users/local1', username: 'local1', accepted: true },
            { actorUrl: 'https://remote.com/users/remote1', username: null, accepted: true },
            { actorUrl: 'http://localhost:3000/users/local2', username: 'local2', accepted: true },
        ]

        vi.mocked(prisma.user.findMany).mockImplementation(async (args) => {
             // Local users query
             if (args?.where?.username && args.where.isRemote === false) {
                 return [{ id: 'id-local1' }, { id: 'id-local2' }] as any
             }
             // Remote users query
             if (args?.where?.externalActorUrl && args.where.isRemote === true) {
                 return [{ id: 'id-remote1' }] as any
             }
             return []
        })

        const result = await SocialGraphService.resolveFollowedUserIds(following)

        expect(result).toHaveLength(3)
        expect(result).toContain('id-local1')
        expect(result).toContain('id-local2')
        expect(result).toContain('id-remote1')

        // Optimized implementation: 2 queries max (1 for local, 1 for remote)
        expect(prisma.user.findMany).toHaveBeenCalledTimes(2)

        // Should NOT call findUnique or findFirst
        expect(prisma.user.findUnique).not.toHaveBeenCalled()
        expect(prisma.user.findFirst).not.toHaveBeenCalled()
    })
})
