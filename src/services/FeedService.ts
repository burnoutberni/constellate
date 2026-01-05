import { prisma } from '../lib/prisma.js'
import { SuggestedUsersService } from './SuggestedUsersService.js'
import { SocialGraphService } from './SocialGraphService.js'
import { type TrendingEvent, DEFAULT_TRENDING_WINDOW_DAYS, DAY_IN_MS } from '../lib/trending.js'
import { type FeedActivity } from '../activity.js'
import { canUserViewEvent } from '../lib/eventVisibility.js'
import { EventVisibility } from '@prisma/client'

export type FeedItemType =
	| 'activity'
	| 'trending_event'
	| 'suggested_users'
	| 'onboarding'
	| 'header'

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
	data: FeedActivity | TrendingEvent | { suggestions: Array<SuggestedUser> } | { title: string }
}

type ViewerStatus = 'attending' | 'maybe' | 'not_attending' | null

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

	// --- Home Feed (Smart Agenda) ---

	static async getHomeFeed(userId: string, cursor?: string) {
		// If cursor is present, we only fetch the "Future" section or continue pagination
		if (cursor) {
			return this.getFutureFeed(userId, cursor)
		}

		// Otherwise, build the initial view:
		// 1. Today
		// 2. Rest of Week (if applicable)
		// 3. Weekend (if applicable)
		// 4. Initial chunk of Future

		const now = new Date()
		const items: FeedItem[] = []

		// Helper to define time windows
		const todayStart = new Date(now)
		const todayEnd = new Date(now)
		todayEnd.setHours(23, 59, 59, 999)

		// Get user's followed IDs for suggestions context
		const following = await SocialGraphService.getFollowing(userId)
		const followedUserIds = await SocialGraphService.resolveFollowedUserIds(following)

		// --- TODAY ---
		await this.addTodayItems(items, userId, followedUserIds, todayStart, todayEnd)

		// --- REST OF WEEK (Work week) ---
		const { restOfWeekStart, restOfWeekEnd } = this.calculateRestOfWeek(now, todayEnd)
		if (restOfWeekStart && restOfWeekEnd) {
			await this.addRestOfWeekItems(
				items,
				userId,
				followedUserIds,
				restOfWeekStart,
				restOfWeekEnd
			)
		}

		// --- WEEKEND ---
		const { weekendStart, weekendEnd } = this.calculateWeekend(now, todayEnd)
		const timelineMark = restOfWeekEnd || todayEnd

		if (weekendStart && weekendEnd && weekendStart > timelineMark) {
			await this.addWeekendItems(items, userId, followedUserIds, weekendStart, weekendEnd)
		}

		// --- FUTURE ---
		await this.addFutureItems(items, userId, weekendEnd, timelineMark)

		return this.prepareResult(items)
	}

	private static async addTodayItems(
		items: FeedItem[],
		userId: string,
		followedUserIds: string[],
		todayStart: Date,
		todayEnd: Date
	) {
		const todayItems = await this.getTimelineItems(
			userId,
			followedUserIds,
			todayStart,
			todayEnd
		)
		if (todayItems.length > 0) {
			items.push({
				type: 'header',
				id: 'header-today',
				timestamp: todayStart.toISOString(),
				data: { title: 'Today' },
			})
			items.push(...todayItems)
		} else {
			// If no events today, maybe show some suggestions "for tonight"
			const suggestions = await SuggestedUsersService.getSuggestions(userId, 3)
			if (suggestions.length > 0) {
				items.push({
					type: 'header',
					id: 'header-today-suggestions',
					timestamp: todayStart.toISOString(),
					data: { title: 'Today' },
				})
				items.push({
					type: 'suggested_users',
					id: 'today-suggestions',
					timestamp: new Date().toISOString(),
					data: { suggestions },
				})
			}
		}
	}

	private static calculateRestOfWeek(now: Date, todayEnd: Date) {
		const currentDay = now.getDay() // 0 = Sun, 1 = Mon ...
		let restOfWeekStart: Date | null = null
		let restOfWeekEnd: Date | null = null

		if (currentDay >= 1 && currentDay < 5) {
			// It's Mon-Thu
			restOfWeekStart = new Date(todayEnd)
			restOfWeekStart.setMilliseconds(restOfWeekStart.getMilliseconds() + 1) // Start of tomorrow

			// Find coming Friday
			const daysUntilFriday = 5 - currentDay
			restOfWeekEnd = new Date(now)
			restOfWeekEnd.setDate(now.getDate() + daysUntilFriday)
			restOfWeekEnd.setHours(23, 59, 59, 999)
		}
		return { restOfWeekStart, restOfWeekEnd }
	}

	private static async addRestOfWeekItems(
		items: FeedItem[],
		userId: string,
		followedUserIds: string[],
		restOfWeekStart: Date,
		restOfWeekEnd: Date
	) {
		const weekItems = await this.getTimelineItems(
			userId,
			followedUserIds,
			restOfWeekStart,
			restOfWeekEnd
		)
		if (weekItems.length > 0) {
			items.push({
				type: 'header',
				id: 'header-week',
				timestamp: restOfWeekStart.toISOString(),
				data: { title: 'Rest of Week' },
			})
			items.push(...weekItems)
		}
	}

	private static calculateWeekend(now: Date, todayEnd: Date) {
		const currentDay = now.getDay()
		let weekendStart: Date | null = null
		let weekendEnd: Date | null = null

		const daysUntilSaturday = (6 - currentDay + 7) % 7
		const nextSaturday = new Date(now)
		nextSaturday.setDate(now.getDate() + (daysUntilSaturday === 0 ? 0 : daysUntilSaturday))

		if (currentDay === 6) {
			// Today is Sat. Weekend is Sat+Sun. Today covers Sat.
			// Maybe "Rest of Weekend" (Sunday)?
			weekendStart = new Date(todayEnd)
			weekendStart.setMilliseconds(1)
			weekendEnd = new Date(now)
			weekendEnd.setDate(now.getDate() + 1) // Sunday
			weekendEnd.setHours(23, 59, 59, 999)
		} else if (currentDay === 0) {
			// Today is Sun. Weekend is over.
		} else {
			// Mon-Fri. Weekend is coming Sat-Sun.
			weekendStart = new Date(nextSaturday)
			weekendStart.setHours(0, 0, 0, 0)
			weekendEnd = new Date(weekendStart)
			weekendEnd.setDate(weekendStart.getDate() + 1) // Sunday
			weekendEnd.setHours(23, 59, 59, 999)
		}
		return { weekendStart, weekendEnd }
	}

	private static async addWeekendItems(
		items: FeedItem[],
		userId: string,
		followedUserIds: string[],
		weekendStart: Date,
		weekendEnd: Date
	) {
		const weekendItems = await this.getTimelineItems(
			userId,
			followedUserIds,
			weekendStart,
			weekendEnd
		)
		if (weekendItems.length > 0) {
			items.push({
				type: 'header',
				id: 'header-weekend',
				timestamp: weekendStart.toISOString(),
				data: { title: 'This Weekend' },
			})
			items.push(...weekendItems)
		}
	}

	private static async addFutureItems(
		items: FeedItem[],
		userId: string,
		weekendEnd: Date | null,
		timelineMark: Date
	) {
		const futureStart = weekendEnd && weekendEnd > timelineMark ? weekendEnd : timelineMark
		const futureQueryStart = new Date(futureStart.getTime() + 1)

		const { items: futureItems } = await this.getFutureFeed(
			userId,
			futureQueryStart.toISOString(),
			10
		)

		if (futureItems.length > 0) {
			items.push({
				type: 'header',
				id: 'header-future',
				timestamp: futureQueryStart.toISOString(),
				data: { title: 'Coming Up' },
			})
			items.push(...futureItems)
		}
	}

	private static async getFutureFeed(userId: string, cursor: string, limit: number = 20) {
		const cursorDate = new Date(cursor)

		// Fetch public/followed events after this date
		// Simple fetch for now, can be complex logic later
		const events = await prisma.event.findMany({
			where: {
				startTime: { gt: cursorDate },
				OR: [
					{ visibility: 'PUBLIC' },
					{ visibility: 'UNLISTED' },
					{
						visibility: 'PRIVATE',
						userId,
					},
					{
						// simplistic visibility for now - optimize later
						user: { followers: { some: { userId } } },
					},
				],
			},
			orderBy: { startTime: 'asc' },
			take: limit,
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
				attendance: {
					where: { userId },
					select: {
						status: true,
						user: {
							select: {
								id: true,
								username: true,
								profileImage: true,
								isRemote: true,
							},
						},
					},
				},
			},
		})

		const items: FeedItem[] = events.map((e) => ({
			type: 'trending_event', // Reusing this type for generic event cards for now
			id: e.id,
			timestamp: e.startTime.toISOString(),
			data: this.mapToTrendingEvent({ ...e, updatedAt: e.updatedAt }),
		}))

		return this.prepareResult(items)
	}

	private static async getTimelineItems(
		userId: string,
		followedUserIds: string[],
		start: Date,
		end: Date
	): Promise<FeedItem[]> {
		// 1. Get Events user is Going/Maybe to
		const rsvps = await prisma.eventAttendance.findMany({
			where: {
				userId,
				status: { in: ['attending', 'maybe'] },
				event: {
					startTime: { gte: start, lte: end },
				},
			},
			take: 50,
			include: {
				event: {
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
						_count: {
							select: { attendance: true },
						},
						attendance: {
							take: 5,
							select: {
								status: true,
								user: {
									select: {
										id: true,
										username: true,
										profileImage: true,
										isRemote: true,
									},
								},
							},
						},
					},
				},
			},
			orderBy: { event: { startTime: 'asc' } },
		})

		// 2. Get Suggested Events (Friends going, or Trending public)
		// For simplicity, let's grab top trending in this window that aren't RSVPd
		const rsvpEventIds = rsvps.map((r) => r.eventId)

		const suggestions = await prisma.event.findMany({
			where: {
				startTime: { gte: start, lte: end },
				id: { notIn: rsvpEventIds },
				visibility: 'PUBLIC',
			},
			orderBy: [
				// rudimentary "trending" sort by checking if friends are going?
				// For now just recent or soonest?
				// Let's rely on creation/updates or just proximity
				{ startTime: 'asc' },
			],
			take: 5,
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
				_count: {
					select: { attendance: true },
				},
				attendance: {
					take: 5,
					select: {
						status: true,
						user: {
							select: {
								id: true,
								username: true,
								profileImage: true,
								isRemote: true,
							},
						},
					},
				},
			},
		})

		const items: FeedItem[] = []

		// RSVPS first
		rsvps.forEach((r) => {
			items.push({
				// Using trending_event to show "Event Card" context.
				// We inject the status via a custom id or data if needed, but for now standar card.
				type: 'trending_event',
				id: `my-rsvp-${r.eventId}`,
				timestamp: r.event.startTime.toISOString(),
				data: this.mapToTrendingEvent({
					...r.event,
					updatedAt: r.createdAt,
					viewerStatus: r.status as 'attending' | 'maybe',
				}),
			})
		})

		// Suggestions next
		suggestions.forEach((s) => {
			items.push({
				type: 'trending_event',
				id: s.id,
				timestamp: s.startTime.toISOString(),
				data: this.mapToTrendingEvent({ ...s, updatedAt: s.updatedAt }),
			})
		})

		return items
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
				attendance: {
					where: { userId },
					select: {
						status: true,
						user: {
							select: {
								id: true,
								username: true,
								profileImage: true,
								isRemote: true,
							},
						},
					},
				},
			},
			orderBy: [{ updatedAt: 'desc' }],
			take: limit * 2,
		})

		return candidateEvents
	}

	private static async fetchRecentPublicEvents(userId: string, cursor: string, limit: number) {
		const cursorDate = new Date(cursor)
		return prisma.event.findMany({
			where: {
				visibility: 'PUBLIC',
				createdAt: { lt: cursorDate },
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
				attendance: {
					where: { userId },
					select: {
						status: true,
						user: {
							select: {
								id: true,
								username: true,
								profileImage: true,
								isRemote: true,
							},
						},
					},
				},
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
							isRemote: true,
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
									profileImage: true,
									isRemote: true,
								},
							},
							tags: true,
							attendance: {
								where: { userId: viewerId },
								select: {
									status: true,
									user: {
										select: {
											id: true,
											username: true,
											profileImage: true,
											isRemote: true,
										},
									},
								},
							},
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
							isRemote: true,
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
									profileImage: true,
									isRemote: true,
								},
							},
							tags: true,
							attendance: {
								where: { userId: viewerId },
								select: {
									status: true,
									user: {
										select: {
											id: true,
											username: true,
											profileImage: true,
											isRemote: true,
										},
									},
								},
							},
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
							isRemote: true,
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
									profileImage: true,
									isRemote: true,
								},
							},
							tags: true,
							attendance: {
								where: { userId: viewerId },
								select: {
									status: true,
									user: {
										select: {
											id: true,
											username: true,
											profileImage: true,
											isRemote: true,
										},
									},
								},
							},
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
							isRemote: true,
						},
					},
					tags: true,
					attendance: {
						where: { userId: viewerId },
						select: {
							status: true,
							user: {
								select: {
									id: true,
									username: true,
									profileImage: true,
									isRemote: true,
								},
							},
						},
					},
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
							isRemote: true,
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
									profileImage: true,
									isRemote: true,
								},
							},
							tags: true,
							attendance: {
								where: { userId: viewerId },
								select: {
									status: true,
									user: {
										select: {
											id: true,
											username: true,
											profileImage: true,
											isRemote: true,
										},
									},
								},
							},
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
				event: this.mapEvent({
					...l.event,
					user: l.event.user
						? {
								...l.event.user,
								profileImage: l.event.user.profileImage,
								isRemote: l.event.user.isRemote,
							}
						: null,
				}),
			})
		})

		rsvps.forEach((r) => {
			results.push({
				id: `rsvp-${r.id}`,
				type: 'rsvp',
				createdAt: r.createdAt.toISOString(),
				user: r.user,
				event: this.mapEvent({
					...r.event,
					user: r.event.user
						? {
								...r.event.user,
								profileImage: r.event.user.profileImage,
								isRemote: r.event.user.isRemote,
							}
						: null,
				}),
				data: { status: r.status },
			})
		})

		comments.forEach((c) => {
			results.push({
				id: `comment-${c.id}`,
				type: 'comment',
				createdAt: c.createdAt.toISOString(),
				user: c.author,
				event: this.mapEvent({
					...c.event,
					user: c.event.user
						? {
								...c.event.user,
								profileImage: c.event.user.profileImage,
								isRemote: c.event.user.isRemote,
							}
						: null,
				}),
				data: { commentContent: c.content },
			})
		})

		newEvents.forEach((e) => {
			results.push({
				id: `event-${e.id}`,
				type: 'event_created',
				createdAt: e.createdAt.toISOString(),
				user: e.user,
				event: this.mapEvent({
					...e,
					user: e.user
						? {
								...e.user,
								profileImage: e.user.profileImage,
								isRemote: e.user.isRemote,
							}
						: null,
				}),
			})
		})

		shares.forEach((s) => {
			if (s.sharedEvent) {
				results.push({
					id: `share-${s.id}`,
					type: 'event_shared',
					createdAt: s.createdAt.toISOString(),
					user: s.user,
					event: this.mapEvent({
						...s.sharedEvent,
						user: s.sharedEvent.user
							? {
									...s.sharedEvent.user,
									isRemote: s.sharedEvent.user.isRemote,
								}
							: null,
					}),
					sharedEvent: this.mapEvent({
						...s,
						user: s.user
							? {
									...s.user,
									isRemote: s.user.isRemote,
								}
							: null,
					}),
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
			isRemote: boolean
		} | null
		tags: Array<{ id: string; tag: string }>
		viewerStatus?: 'attending' | 'maybe' | 'not_attending' | null
		attendance?: Array<{
			status: string
			user: {
				id: string
				username: string
				profileImage?: string | null
				isRemote: boolean
			}
		}>
		_count?: { attendance?: number; comments?: number; likes?: number }
		headerImage?: string | null
	}): TrendingEvent {
		const computedStatus =
			(e.viewerStatus as ViewerStatus) ?? (e.attendance?.[0]?.status as ViewerStatus) ?? null

		return {
			id: e.id,
			title: e.title,
			startTime: e.startTime,
			updatedAt: e.updatedAt,
			_count: e._count,
			headerImage: e.headerImage,
			user: e.user
				? {
						id: e.user.id,
						username: e.user.username,
						name: e.user.name,
						displayColor: e.user.displayColor,
						profileImage: e.user.profileImage,
						isRemote: e.user.isRemote,
					}
				: null,
			tags: e.tags.map((t) => ({ id: t.id, tag: t.tag })),
			viewerStatus: computedStatus,
			attendance: e.attendance,
		}
	}

	private static mapEvent(e: {
		id: string
		title: string
		startTime: Date | string
		location: string | null
		visibility?: EventVisibility | null
		tags?: Array<{ id: string; tag: string }>
		attendance?: Array<{
			status: string
			user: {
				id: string
				username: string
				profileImage?: string | null
				isRemote: boolean
			}
		}>
		user: {
			id: string
			username: string
			name: string | null
			displayColor: string
			profileImage?: string | null
			isRemote: boolean
		} | null
	}): FeedActivity['event'] {
		const computedStatus = (e.attendance?.[0]?.status as ViewerStatus) ?? null

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
						profileImage: e.user.profileImage,
						isRemote: e.user.isRemote,
					}
				: null,
			viewerStatus: computedStatus,
			attendance: e.attendance?.map((a) => ({
				status: a.status,
				user: {
					id: a.user.id,
					username: a.user.username,
					profileImage: a.user.profileImage,
					isRemote: a.user.isRemote,
				},
			})),
		}
	}
}
