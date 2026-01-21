import { prisma } from '../lib/prisma.js'

export class SocialGraphService {
	static async getFollowing(userId: string) {
		// Fetch users the current user follows
		return prisma.following.findMany({
			where: {
				userId,
				accepted: true,
			},
			select: {
				actorUrl: true,
				username: true,
				accepted: true,
			},
		})
	}

	static async resolveFollowedUserIds(following: Array<{ actorUrl: string }>) {
		const baseUrl = process.env.BASE_URL || 'http://localhost:3000'
		const localUsernames: string[] = []
		const remoteActorUrls: string[] = []

		// 1. Split into local and remote
		for (const follow of following) {
			if (follow.actorUrl.startsWith(baseUrl)) {
				const username = follow.actorUrl.split('/').pop()
				if (username) {
					localUsernames.push(username)
				}
			} else {
				remoteActorUrls.push(follow.actorUrl)
			}
		}

		// 2. Batch fetch
		const [localUsers, remoteUsers] = await Promise.all([
			localUsernames.length > 0
				? prisma.user.findMany({
						where: {
							username: { in: localUsernames },
							isRemote: false,
						},
						select: { id: true },
					})
				: Promise.resolve([]),
			remoteActorUrls.length > 0
				? prisma.user.findMany({
						where: {
							externalActorUrl: { in: remoteActorUrls },
							isRemote: true,
						},
						select: { id: true },
					})
				: Promise.resolve([]),
		])

		// 3. Combine results
		return [...localUsers, ...remoteUsers].map((u) => u.id)
	}

	static async resolveActorUser(actorUrl: string, baseUrl: string) {
		if (actorUrl.startsWith(baseUrl)) {
			const username = actorUrl.split('/').pop()
			if (!username) {
				return null
			}
			return prisma.user.findUnique({
				where: {
					username,
					isRemote: false,
				},
				select: { id: true },
			})
		}

		return prisma.user.findFirst({
			where: {
				externalActorUrl: actorUrl,
				isRemote: true,
			},
			select: { id: true },
		})
	}
}
