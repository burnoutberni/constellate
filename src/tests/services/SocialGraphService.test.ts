import { describe, it, expect, beforeEach } from 'vitest'
import { SocialGraphService } from '../../services/SocialGraphService'
import { prisma } from '../../lib/prisma'

describe('SocialGraphService', () => {
	const baseUrl = process.env.BASE_URL || 'http://localhost:3000'

	beforeEach(async () => {
		// Prismock reset is handled in setupVitest.ts beforeEach
	})

	describe('resolveFollowedUserIds', () => {
		it('should resolve local users by username', async () => {
			// Seed local user
			const localUser = await prisma.user.create({
				data: {
					username: 'localuser',
					email: 'local@example.com',
					isRemote: false,
				},
			})

			const following = [
				{ actorUrl: `${baseUrl}/users/localuser` }
			]

			const result = await SocialGraphService.resolveFollowedUserIds(following)
			expect(result).toEqual([localUser.id])
		})

		it('should resolve remote users by externalActorUrl', async () => {
			// Seed remote user
			const remoteUser = await prisma.user.create({
				data: {
					username: 'remoteuser',
					email: 'remote@example.com',
					isRemote: true,
					externalActorUrl: 'https://remote.instance/users/remoteuser',
				},
			})

			const following = [
				{ actorUrl: 'https://remote.instance/users/remoteuser' }
			]

			const result = await SocialGraphService.resolveFollowedUserIds(following)
			expect(result).toEqual([remoteUser.id])
		})

		it('should handle mixed local and remote users', async () => {
			const localUser = await prisma.user.create({
				data: {
					username: 'localmixed',
					email: 'localmixed@example.com',
					isRemote: false,
				},
			})

			const remoteUser = await prisma.user.create({
				data: {
					username: 'remotemixed',
					email: 'remotemixed@example.com',
					isRemote: true,
					externalActorUrl: 'https://remote.instance/users/remotemixed',
				},
			})

			const following = [
				{ actorUrl: `${baseUrl}/users/localmixed` },
				{ actorUrl: 'https://remote.instance/users/remotemixed' }
			]

			const result = await SocialGraphService.resolveFollowedUserIds(following)
			expect(result).toHaveLength(2)
			expect(result).toContain(localUser.id)
			expect(result).toContain(remoteUser.id)
		})

		it('should ignore users that do not exist', async () => {
			const localUser = await prisma.user.create({
				data: {
					username: 'existing',
					email: 'existing@example.com',
					isRemote: false,
				},
			})

			const following = [
				{ actorUrl: `${baseUrl}/users/existing` },
				{ actorUrl: `${baseUrl}/users/nonexistent` },
				{ actorUrl: 'https://remote.instance/users/missing' }
			]

			const result = await SocialGraphService.resolveFollowedUserIds(following)
			expect(result).toEqual([localUser.id])
		})

		it('should return empty array if following list is empty', async () => {
			const result = await SocialGraphService.resolveFollowedUserIds([])
			expect(result).toEqual([])
		})

        it('should handle duplicates if they exist in input (current behavior)?', async () => {
            const localUser = await prisma.user.create({
				data: {
					username: 'dupe',
					email: 'dupe@example.com',
					isRemote: false,
				},
			})

            const following = [
				{ actorUrl: `${baseUrl}/users/dupe` },
                { actorUrl: `${baseUrl}/users/dupe` }
			]

            const result = await SocialGraphService.resolveFollowedUserIds(following)
            // findMany with { username: { in: ['dupe', 'dupe'] } } returns 1 record.
            // But we might want to verify if the output deduplicates or not.
            // My implementation does NOT deduplicate localUsernames array, but Prisma findMany returns unique records based on ID.
            // So output will contain localUser.id ONCE.
            // This is actually a behavior change!
            // The previous implementation returned duplicates.
            // The new implementation returns unique users.

            expect(result).toEqual([localUser.id])
        })
	})
})
