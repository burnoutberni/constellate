import { prisma } from '../lib/prisma.js'

export class SuggestedUsersService {
	static async getSuggestions(userId: string, limit: number = 5) {
		// 1. Get users already followed (to exclude them)
		const following = await prisma.following.findMany({
			where: { userId },
			select: { actorUrl: true },
		})
		const followingActorUrls = following
			.map((f) => f.actorUrl)
			.filter((url): url is string => url !== null)

		// 2. Find active users (who have posted events in the last 30 days)
		// We can't easily join on "last post date" efficiently in one go without raw SQL or heavy operations,
		// so we'll fetch popular users and then filter/rank them, or find recent events and pick users from them.

		// Approach: Find users with most followers first (Popularity) as a base, then maybe filter?
		// Or better for "Active": Find users who created events recently.

		const thirtyDaysAgo = new Date()
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

		// Find users who have created events recently
		const recentEventCreators = await prisma.event.groupBy({
			by: ['userId'],
			where: {
				createdAt: { gte: thirtyDaysAgo },
				user: {
					isRemote: false, // prioritizing local users for now? or maybe not? let's stick to local for speed/relevance first or all?
					// Let's include all, but we need to join with User table which groupBy doesn't fully support for fetching user details.
				},
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
				// We initially filter by ID, but we also must ensure we don't return people already followed.
				// However, 'following' uses actorUrl. For local users, actorUrl is based on username.
				// It's safer to filter after fetching or match actorUrl if possible.
				// Let's simpler: Exclude if their actorUrl is in followingActorUrls.
				// AND exclude self.
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

		// Filter out those already followed
		// We know local user actorUrl = base + /users/username, remote = externalActorUrl
		// But for robust comparison, we should probably check if we have a Following record.
		// The `followingActorUrls` check is good for remote, but for local we need to construct it or look up.
		// Actually, simpler:
		// We ALREADY fetched `following` for the `userId`.
		// We can just check against that list.

		// Wait, `following` table stores `actorUrl`.
		// For local users in `candidateUsers`, we may not have `externalActorUrl` populated if they are purely local?
		// Actually `externalActorUrl` is usually null for local users? No, it should be set?
		// Let's check `user.ts` or `activitypubHelpers.ts`.
		// Usually local users have `externalActorUrl` null? Or generated?
		// Let's assume we can filter by ID if we did a join, but we didn't.

		// Correct approach: Exclude users where ID is in the "followed user IDs" list.
		// But `Following` table only has `actorUrl`.
		// So we need to resolve `following` to IDs to exclude them efficiently OR check actorUrls.

		// Let's do the "exclude by Actor URL" check.
		// We need to know the actorUrl of the candidates.
		// For remote: candidate.externalActorUrl
		// For local: we need to construct it or assume we can skip them if we just follow logic.

		// Actually, let's just use `userId` if we can resolve the following list to IDs first.
		// But that might be expensive if following is huge.
		// Let's filter in memory for now, assuming N (candidates) is small (15).

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
