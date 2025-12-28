import { prisma } from '../lib/prisma.js'
import { SuggestedUsersService } from './SuggestedUsersService.js'
import { SocialGraphService } from './SocialGraphService.js'
import { type TrendingEvent, DEFAULT_TRENDING_WINDOW_DAYS, DAY_IN_MS } from '../lib/trending.js'
import { type FeedActivity } from '../activity.js'
import { canUserViewEvent } from '../lib/eventVisibility.js'
import { EventVisibility } from '@prisma/client'

export type FeedItemType = 'activity' | 'trending_event' | 'suggested_users' | 'onboarding'

export interface SuggestedUser {
	id: string
	username: string
	name: string | null
	displayColor: string
	profileImage: string | null
}

export interface FeedItem {
	type: FeedItemType
	id: string
	timestamp: string // ISO string for sorting
	data: FeedActivity | TrendingEvent | { suggestions: Array<SuggestedUser> }
}

const USER_SUGGESTION_INJECTION_INDEX = 4
const MIN_ITEMS_FOR_SUGGESTION_INJECTION = USER_SUGGESTION_INJECTION_INDEX + 1
const USER_SUGGESTION_COUNT = 3

export class FeedService {
	static async getFeed(userId: string, cursor?: string, limit: number = 20) {
		// 1. Get User Context (Who they follow)
		const following = await SocialGraphService.getFollowing(userId)
		const followedUserIds = await SocialGraphService.resolveFollowedUserIds(following)
		const isNewUser = followedUserIds.length === 0

		if (isNewUser) {
			return this.getNewUserFeed(userId, cursor, limit)
		} else {
			return this.getEstablishedUserFeed(userId, followedUserIds, cursor, limit)
		}
	}

	private static async getNewUserFeed(
		userId: string,
		cursor?: string,
		limit: number = 20
	): Promise<{ items: FeedItem[]; nextCursor?: string }> {
		const items: FeedItem[] = []

		if (!cursor) {
			const suggestions = await SuggestedUsersService.getSuggestions(userId, 5)

			items.push({
				type: 'onboarding',
				id: 'onboarding-hero',
				timestamp: new Date().toISOString(),
				data: { suggestions },
			})

			const trending = await this.fetchTrendingEvents(userId, limit)
			// Only take enough to satisfy the limit
			const remaining = limit - items.length
			if (remaining > 0) {
				items.push(
					...trending.slice(0, remaining).map((t) => ({
						type: 'trending_event' as const,
						id: t.id,
						timestamp: t.updatedAt
							? t.updatedAt.toISOString()
							: t.startTime.toISOString(),
						data: this.mapToTrendingEvent(t),
					}))
				)
			}
		} else {
			const publicEvents = await this.fetchRecentPublicEvents(userId, cursor, limit)
			items.push(
				...publicEvents.map((e) => ({
					type: 'trending_event' as const,
					id: e.id,
					timestamp: e.createdAt.toISOString(),
					data: this.mapToTrendingEvent(e),
				}))
			)
		}

		return this.prepareResult(items)
	}

	private static async getEstablishedUserFeed(
		userId: string,
		followedUserIds: string[],
		cursor?: string,
		limit: number = 20
	): Promise<{ items: FeedItem[]; nextCursor?: string }> {
		const items: FeedItem[] = []
		const cursorDate = cursor ? new Date(cursor) : undefined

		const activities = await this.fetchPagedActivities(
			followedUserIds,
			userId,
			cursorDate,
			limit
		)

		// Filter activities for visibility
		const visibleActivities = await this.filterVisibleActivities(activities, userId)

		visibleActivities.forEach((a) => {
			items.push({
				type: 'activity',
				id: a.id,
				timestamp: a.createdAt,
				data: a,
			})
		})

		// Fill remaining slots with trending if needed
		await this.fillTrendingEvents(items, userId, limit)

		if (!cursor && items.length >= MIN_ITEMS_FOR_SUGGESTION_INJECTION) {
			const suggestions = await SuggestedUsersService.getSuggestions(
				userId,
				USER_SUGGESTION_COUNT
			)
			if (suggestions.length > 0) {
				items.splice(USER_SUGGESTION_INJECTION_INDEX, 0, {
					type: 'suggested_users',
					id: 'suggestions-block',
					timestamp: items[USER_SUGGESTION_INJECTION_INDEX].timestamp,
					data: { suggestions },
				})
			}
		}

		return this.prepareResult(items)
	}

	private static async fillTrendingEvents(items: FeedItem[], userId: string, limit: number) {
		if (items.length < limit) {
			const spacesNeeded = limit - items.length
			const trending = await this.fetchTrendingEvents(userId, spacesNeeded)
			const existingIds = new Set(
				items.map((i) => {
					if (i.type === 'activity' && 'event' in i.data) {
						return (i.data as FeedActivity).event.id
					}
					return i.type === 'trending_event' ? (i.data as TrendingEvent).id : i.id
				})
			)

			for (const t of trending) {
				if (items.length >= limit) break

				if (!existingIds.has(t.id)) {
					// Use updated or start time for trending items
					const ts = t.updatedAt ? t.updatedAt.toISOString() : t.startTime.toISOString()
					items.push({
						type: 'trending_event',
						id: t.id,
						timestamp: ts,
						data: this.mapToTrendingEvent(t),
					})
				}
			}
		}
	}

	private static prepareResult(items: FeedItem[]) {
		let nextCursor: string | undefined = undefined
		if (items.length > 0) {
			const lastItem = items[items.length - 1]
			nextCursor = lastItem.timestamp
		}
		return { items, nextCursor }
	}

	// --- Helpers ---

	private static async fetchTrendingEvents(userId: string, limit: number) {
		const windowDays = DEFAULT_TRENDING_WINDOW_DAYS
		const now = new Date()
		const windowStart = new Date(now.getTime() - windowDays * DAY_IN_MS)

		const candidateEvents = await prisma.event.findMany({
			where: {
				OR: [{ startTime: { gte: windowStart } }, { updatedAt: { gte: windowStart } }],
				visibility: 'PUBLIC',
			},
			include: {
				user: {
					select: {
						id: true,
						username: true,
						name: true,
						displayColor: true,
						profileImage: true,
						isRemote: true,
					},
				},
				tags: true,
			},
			orderBy: [{ updatedAt: 'desc' }],
			take: limit * 2,
		})

		return candidateEvents
	}

	private static async fetchRecentPublicEvents(userId: string, cursor: string, limit: number) {
		return prisma.event.findMany({
			where: {
				visibility: 'PUBLIC',
				createdAt: { lt: cursor },
			},
			include: {
				user: {
					select: {
						id: true,
						username: true,
						name: true,
						displayColor: true,
						profileImage: true,
						isRemote: true,
					},
				},
				tags: true,
			},
			orderBy: { createdAt: 'desc' },
			take: limit,
		})
	}

	private static async fetchPagedActivities(
		followedUserIds: string[],
		viewerId: string,
		cursorDate?: Date,
		limit: number = 20
	) {
		const dateFilter = cursorDate ? { lt: cursorDate } : undefined

		// Fetch more than limit to account for filtering
		const fetchLimit = limit * 2

		const [likes, rsvps, comments, newEvents, shares] = await Promise.all([
			prisma.eventLike.findMany({
				where: {
					userId: { in: followedUserIds },
					createdAt: dateFilter,
				},
				include: {
					user: {
						select: {
							id: true,
							username: true,
							name: true,
							displayColor: true,
							profileImage: true,
						},
					},
					event: {
						include: {
							user: {
								select: {
									id: true,
									username: true,
									name: true,
									displayColor: true,
								},
							},
							tags: true,
						},
					},
				},
				orderBy: { createdAt: 'desc' },
				take: fetchLimit,
			}),
			prisma.eventAttendance.findMany({
				where: {
					userId: { in: followedUserIds },
					status: { in: ['attending', 'maybe'] },
					createdAt: dateFilter,
				},
				include: {
					user: {
						select: {
							id: true,
							username: true,
							name: true,
							displayColor: true,
							profileImage: true,
						},
					},
					event: {
						include: {
							user: {
								select: {
									id: true,
									username: true,
									name: true,
									displayColor: true,
								},
							},
							tags: true,
						},
					},
				},
				orderBy: { createdAt: 'desc' },
				take: fetchLimit,
			}),
			prisma.comment.findMany({
				where: {
					authorId: { in: followedUserIds },
					createdAt: dateFilter,
				},
				include: {
					author: {
						select: {
							id: true,
							username: true,
							name: true,
							displayColor: true,
							profileImage: true,
						},
					},
					event: {
						include: {
							user: {
								select: {
									id: true,
									username: true,
									name: true,
									displayColor: true,
								},
							},
							tags: true,
						},
					},
				},
				orderBy: { createdAt: 'desc' },
				take: fetchLimit,
			}),
			prisma.event.findMany({
				where: {
					userId: { in: followedUserIds },
					sharedEventId: null,
					createdAt: dateFilter,
				},
				include: {
					user: {
						select: {
							id: true,
							username: true,
							name: true,
							displayColor: true,
							profileImage: true,
						},
					},
					tags: true,
				},
				orderBy: { createdAt: 'desc' },
				take: fetchLimit,
			}),
			prisma.event.findMany({
				where: {
					userId: { in: followedUserIds },
					sharedEventId: { not: null },
					createdAt: dateFilter,
				},
				include: {
					user: {
						select: {
							id: true,
							username: true,
							name: true,
							displayColor: true,
							profileImage: true,
						},
					},
					sharedEvent: {
						include: {
							user: {
								select: {
									id: true,
									username: true,
									name: true,
									displayColor: true,
								},
							},
							tags: true,
						},
					},
				},
				orderBy: { createdAt: 'desc' },
				take: fetchLimit,
			}),
		])

		const results: FeedActivity[] = []

		likes.forEach((l) => {
			results.push({
				id: `like-${l.id}`,
				type: 'like',
				createdAt: l.createdAt.toISOString(),
				user: l.user,
				event: this.mapEvent(l.event),
			})
		})

		rsvps.forEach((r) => {
			results.push({
				id: `rsvp-${r.id}`,
				type: 'rsvp',
				createdAt: r.createdAt.toISOString(),
				user: r.user,
				event: this.mapEvent(r.event),
				data: { status: r.status },
			})
		})

		comments.forEach((c) => {
			results.push({
				id: `comment-${c.id}`,
				type: 'comment',
				createdAt: c.createdAt.toISOString(),
				user: c.author,
				event: this.mapEvent(c.event),
				data: { commentContent: c.content },
			})
		})

		newEvents.forEach((e) => {
			results.push({
				id: `event-${e.id}`,
				type: 'event_created',
				createdAt: e.createdAt.toISOString(),
				user: e.user,
				event: this.mapEvent(e),
			})
		})

		shares.forEach((s) => {
			if (s.sharedEvent) {
				results.push({
					id: `share-${s.id}`,
					type: 'event_shared',
					createdAt: s.createdAt.toISOString(),
					user: s.user,
					event: this.mapEvent(s.sharedEvent),
					sharedEvent: this.mapEvent(s),
				})
			}
		})

		results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

		return results.slice(0, limit)
	}

	private static async filterVisibleActivities(
		activities: FeedActivity[],
		userId: string
	): Promise<FeedActivity[]> {
		const visibleActivities: FeedActivity[] = []

		for (const activity of activities) {
			if (await this.isActivityVisible(activity, userId)) {
				visibleActivities.push(activity)
			}
		}

		return visibleActivities
	}

	private static async isActivityVisible(
		activity: FeedActivity,
		userId: string
	): Promise<boolean> {
		// Check visibility of the primary event
		if ('event' in activity && activity.event) {
			const primaryEvent = activity.event
			const canView = await canUserViewEvent(primaryEvent, userId)

			if (canView) {
				// For shared events, check the shared event visibility too
				if (activity.type === 'event_shared' && activity.sharedEvent) {
					const sharedEvent = activity.sharedEvent
					if (!(await canUserViewEvent(sharedEvent, userId))) {
						return false
					}
				}
				return true
			}
		}
		return false
	}

	private static mapToTrendingEvent(e: {
		id: string
		title: string
		startTime: Date
		updatedAt: Date
		user: {
			id: string
			username: string
			name: string | null
			displayColor: string
			profileImage: string | null
		} | null
		tags: Array<{ id: string; tag: string }>
	}): TrendingEvent {
		return {
			id: e.id,
			title: e.title,
			startTime: e.startTime,
			updatedAt: e.updatedAt,
			user: e.user
				? {
						id: e.user.id,
						username: e.user.username,
						name: e.user.name,
						displayColor: e.user.displayColor,
						profileImage: e.user.profileImage,
					}
				: null,
			tags: e.tags.map((t) => ({ id: t.id, tag: t.tag })),
		}
	}

	private static mapEvent(e: {
		id: string
		title: string
		startTime: Date | string
		location: string | null
		visibility?: EventVisibility | null
		tags?: Array<{ id: string; tag: string }>
		user: {
			id: string
			username: string
			name: string | null
			displayColor: string
			profileImage?: string | null
		} | null
	}): FeedActivity['event'] {
		return {
			id: e.id,
			title: e.title,
			startTime: typeof e.startTime === 'string' ? e.startTime : e.startTime.toISOString(),
			location: e.location,
			visibility: e.visibility,
			tags: e.tags || [],
			user: e.user
				? {
						id: e.user.id,
						username: e.user.username,
						name: e.user.name,
						displayColor: e.user.displayColor,
					}
				: null,
		}
	}
}
