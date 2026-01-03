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
		const followedUserIds: string[] = []

		for (const follow of following) {
			const user = await this.resolveActorUser(follow.actorUrl, baseUrl)
			if (user) {
				followedUserIds.push(user.id)
			}
		}

		return followedUserIds
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
