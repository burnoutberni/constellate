import { prisma } from '../lib/prisma.js'

export class SuggestedUsersService {
	static async getSuggestions(userId: string, limit: number = 5) {
		// 1. Get users already followed (to exclude them)
		const following = await prisma.following.findMany({
			where: { userId },
			select: { actorUrl: true },
		})
		const followingActorUrls = following.map((f) => f.actorUrl)

		// 2. Find active users (who have posted events in the last 30 days)
		const thirtyDaysAgo = new Date()
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

		// Find users who have created events recently
		const recentEventCreators = await prisma.event.groupBy({
			by: ['userId'],
			where: {
				createdAt: { gte: thirtyDaysAgo },
				user: {}, // Ensure the user relation is valid/exists
			},
			_count: {
				id: true,
			},
			take: 50,
			orderBy: {
				_count: {
					id: 'desc',
				},
			},
		})

		const creatorIds = recentEventCreators
			.map((c) => c.userId)
			.filter((id): id is string => id !== null)

		// Fetch user details for these creators
		const candidateUsers = await prisma.user.findMany({
			where: {
				id: { in: creatorIds, not: userId },
			},
			select: {
				id: true,
				username: true,
				name: true,
				displayColor: true,
				profileImage: true,
				externalActorUrl: true,
				isRemote: true,
				bio: true,
				_count: {
					select: {
						followers: true,
						events: true,
					},
				},
			},
			take: limit * 3, // Fetch more to filter
		})

		const { getBaseUrl } = await import('../lib/activitypubHelpers.js')
		const baseUrl = getBaseUrl()

		const suggestions = candidateUsers.filter((candidate) => {
			const candidateActorUrl =
				candidate.isRemote && candidate.externalActorUrl
					? candidate.externalActorUrl
					: `${baseUrl}/users/${candidate.username}`

			return !followingActorUrls.includes(candidateActorUrl)
		})

		// Sort by followers count (Popularity)
		suggestions.sort((a, b) => {
			const countA = a._count?.followers ?? 0
			const countB = b._count?.followers ?? 0
			return countB - countA
		})

		return suggestions.slice(0, limit)
	}
}
