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

		// 1. Classify URLs
		for (const follow of following) {
			if (follow.actorUrl.startsWith(baseUrl)) {
				// Handle potential trailing slashes
				const cleanUrl = follow.actorUrl.endsWith('/') ? follow.actorUrl.slice(0, -1) : follow.actorUrl
				const username = cleanUrl.split('/').pop()
				if (username) {
					localUsernames.push(username)
				}
			} else {
				remoteActorUrls.push(follow.actorUrl)
			}
		}

		// 2. Batch Fetch
		const [localUsers, remoteUsers] = await Promise.all([
			localUsernames.length > 0
				? prisma.user.findMany({
						where: {
							username: { in: localUsernames },
							isRemote: false,
						},
						select: { id: true, username: true },
					})
				: Promise.resolve([]),
			remoteActorUrls.length > 0
				? prisma.user.findMany({
						where: {
							externalActorUrl: { in: remoteActorUrls },
							isRemote: true,
						},
						select: { id: true, externalActorUrl: true },
					})
				: Promise.resolve([]),
		])

		// 3. Map Results
		const usernameToId = new Map(localUsers.map(u => [u.username, u.id]))
		const externalUrlToId = new Map(remoteUsers.map(u => [u.externalActorUrl!, u.id]))

		const followedUserIds: string[] = []

		// 4. Preserve Order
		for (const follow of following) {
			if (follow.actorUrl.startsWith(baseUrl)) {
				const cleanUrl = follow.actorUrl.endsWith('/') ? follow.actorUrl.slice(0, -1) : follow.actorUrl
				const username = cleanUrl.split('/').pop()
				if (username && usernameToId.has(username)) {
					followedUserIds.push(usernameToId.get(username)!)
				}
			} else {
				if (externalUrlToId.has(follow.actorUrl)) {
					followedUserIds.push(externalUrlToId.get(follow.actorUrl)!)
				}
			}
		}

		return followedUserIds
	}

	static async resolveActorUser(actorUrl: string, baseUrl: string) {
		if (actorUrl.startsWith(baseUrl)) {
			// Handle trailing slash for consistency
			const cleanUrl = actorUrl.endsWith('/') ? actorUrl.slice(0, -1) : actorUrl
			const username = cleanUrl.split('/').pop()
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
