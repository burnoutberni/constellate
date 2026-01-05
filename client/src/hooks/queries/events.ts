import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/hooks/useAuth'
import { useMutationErrorHandler, useQueryErrorHandler } from '@/hooks/useErrorHandler'
import { api } from '@/lib/api-client'
import { getErrorStatus } from '@/lib/errorHandling'
import type { Event, EventDetail, EventRecommendationPayload } from '@/types'

import { queryKeys } from './keys'

interface EventsResponse {
	events: Event[]
	pagination: {
		page: number
		limit: number
		total: number
		pages: number
	}
}

interface RecommendationsResponse {
	recommendations: EventRecommendationPayload[]
	metadata: {
		generatedAt: string
		signals: {
			tags: number
			hosts: number
			followed: number
		}
	}
}

interface TrendingEventsResponse {
	events: Event[]
	windowDays: number
	generatedAt: string
}

interface PlatformStatsResponse {
	totalEvents: number
	upcomingEvents: number
	todayEvents: number
	totalUsers?: number
	totalInstances?: number
}

interface UseTrendingEventsOptions {
	enabled?: boolean
}

interface RSVPInput {
	status: string
	reminderMinutesBeforeStart?: number | null
}

interface CommentInput {
	content: string
	inReplyToId?: string
}

interface UpdateEventInput {
	title?: string
	summary?: string
	location?: string
	locationLatitude?: number | null
	locationLongitude?: number | null
	headerImage?: string
	url?: string
	startTime?: string
	endTime?: string
	duration?: string
	eventStatus?: 'EventScheduled' | 'EventCancelled' | 'EventPostponed'
	eventAttendanceMode?:
	| 'OfflineEventAttendanceMode'
	| 'OnlineEventAttendanceMode'
	| 'MixedEventAttendanceMode'
	maximumAttendeeCapacity?: number
	visibility?: string
	recurrencePattern?: string | null
	recurrenceEndDate?: string | null
	tags?: string[]
	timezone?: string
}

// Queries
export function useEvents(limit: number = 50, options?: { enabled?: boolean }) {
	return useQuery<EventsResponse>({
		queryKey: queryKeys.events.list(limit),
		enabled: options?.enabled ?? true,
		queryFn: () =>
			api.get<EventsResponse>('/events', { limit }, undefined, 'Failed to fetch events'),
	})
}

export function useEventDetail(username: string | undefined | null, eventId: string) {
	return useQuery<EventDetail>({
		queryKey: queryKeys.events.detail(username, eventId),
		queryFn: () => {
			if (username) {
				return api.get<EventDetail>(
					`/events/by-user/${encodeURIComponent(username)}/${encodeURIComponent(eventId)}`,
					undefined,
					undefined,
					'Failed to fetch event'
				)
			}
			return api.get<EventDetail>(
				`/events/${encodeURIComponent(eventId)}`,
				undefined,
				undefined,
				'Failed to fetch event'
			)
		},
		enabled: Boolean(eventId),
	})
}

export function useRecommendedEvents(limit: number = 6, options?: { enabled?: boolean }) {
	const handleQueryError = useQueryErrorHandler()

	return useQuery<RecommendationsResponse>({
		queryKey: queryKeys.events.recommendations(limit),
		enabled: options?.enabled ?? true,
		retry: false,
		queryFn: async () => {
			try {
				return await api.get<RecommendationsResponse>(
					'/recommendations',
					{ limit },
					undefined,
					'Failed to fetch recommendations'
				)
			} catch (error) {
				// Handle 401 gracefully
				if (getErrorStatus(error) === 401) {
					return {
						recommendations: [],
						metadata: {
							generatedAt: new Date().toISOString(),
							signals: { tags: 0, hosts: 0, followed: 0 },
						},
					}
				}
				// Use query error handler for other errors
				handleQueryError(error, 'Failed to fetch recommendations', { silent: true })
				throw error
			}
		},
	})
}

export function useUpdateEvent(eventId: string, username: string) {
	const queryClient = useQueryClient()
	const handleMutationError = useMutationErrorHandler()

	return useMutation({
		mutationFn: (input: UpdateEventInput) =>
			api.put(`/events/${eventId}`, input, undefined, 'Failed to update event'),
		onError: (error) => {
			handleMutationError(error, 'Failed to update event')
		},
		onSuccess: () => {
			// Invalidate event detail and lists
			queryClient.invalidateQueries({ queryKey: queryKeys.events.detail(username, eventId) })
			queryClient.invalidateQueries({ queryKey: queryKeys.events.lists() })
			queryClient.invalidateQueries({ queryKey: queryKeys.activity.home() })
		},
	})
}

export function useDeleteEvent(eventId: string) {
	const queryClient = useQueryClient()
	const handleMutationError = useMutationErrorHandler()

	return useMutation({
		mutationFn: (userId: string) =>
			api.delete(
				`/events/${eventId}`,
				{
					headers: {
						'x-user-id': userId,
					},
				},
				'Failed to delete event'
			),
		onError: (error) => {
			handleMutationError(error, 'Failed to delete event')
		},
		onSuccess: () => {
			// Remove from cache and invalidate lists
			queryClient.removeQueries({
				queryKey: queryKeys.events.details(),
			})
			queryClient.invalidateQueries({ queryKey: queryKeys.events.lists() })
		},
	})
}

export function useRSVP(eventId: string) {
	const queryClient = useQueryClient()
	const handleMutationError = useMutationErrorHandler()
	const { user } = useAuth()
	const userId = user?.id

	return useMutation({
		mutationFn: async (input: RSVPInput | null) => {
			if (input === null) {
				// Remove attendance
				return api.delete(
					`/events/${eventId}/attend`,
					undefined,
					'Failed to remove attendance'
				)
			}
			// Set attendance
			const payload: Record<string, unknown> = { status: input.status }
			if (input.reminderMinutesBeforeStart !== undefined) {
				payload.reminderMinutesBeforeStart = input.reminderMinutesBeforeStart
			}
			return api.post(
				`/events/${eventId}/attend`,
				payload,
				undefined,
				'Failed to set attendance'
			)
		},
		onMutate: async (input) => {
			// Cancel outgoing queries
			await queryClient.cancelQueries({ queryKey: queryKeys.events.details() })

			await queryClient.cancelQueries({ queryKey: queryKeys.activity.home() })

			const previousData = new Map()

			// Helper to calculate the new event state
			const getUpdatedEvent = (event: Event) => {
				const currentAttendance = event.attendance || []

				if (input === null) {
					// Remove attendance
					const updatedAttendance = currentAttendance.filter(
						(a) => a.user?.id !== userId
					)

					// Only decrement if we actually removed someone AND they were confirmed attending
					const removedUser = currentAttendance.find((a) => a.user?.id === userId)
					const wasAttending = removedUser?.status === 'attending'

					const newCount = wasAttending
						? Math.max((event._count?.attendance || 0) - 1, 0)
						: (event._count?.attendance || 0)

					return {
						...event,
						viewerStatus: null,
						attendance: updatedAttendance,
						_count: {
							...event._count,
							attendance: newCount,
						},
					}
				}
				// Add or update attendance
				const existingIndex = userId
					? currentAttendance.findIndex(
						(a) => a.user?.id === userId
					)
					: -1

				const updatedAttendance = [...currentAttendance]
				let newCount = event._count?.attendance || 0

				if (existingIndex >= 0) {
					// Update existing
					const oldStatus = updatedAttendance[existingIndex].status
					updatedAttendance[existingIndex] = {
						...updatedAttendance[existingIndex],
						status: input.status
					}

					// Update count if status changed to/from 'attending'
					if (input.status === 'attending' && oldStatus !== 'attending') {
						newCount += 1
					} else if (input.status !== 'attending' && oldStatus === 'attending') {
						newCount = Math.max(0, newCount - 1)
					}
				} else if (user && user.id) {
					// Add new (only possible if we have user data)
					updatedAttendance.push({
						status: input.status,
						user: {
							id: user.id,
							username: user.username || '',
							name: user.name || null,
							profileImage: user.image || null,
							isRemote: false
						}
					})
					// Only increment if status is 'attending'
					if (input.status === 'attending') {
						newCount += 1
					}
				}

				return {
					...event,
					viewerStatus: input.status,
					attendance: updatedAttendance,
					_count: {
						...event._count,
						attendance: newCount,
					},
				}

			}

			// 1. Update Event Details
			const eventQueries = queryClient.getQueriesData({
				queryKey: queryKeys.events.details(),
			})

			eventQueries.forEach(([queryKey, data]) => {
				if (data && typeof data === 'object' && 'id' in data && (data as EventDetail).id === eventId) {
					previousData.set(queryKey, data)
					queryClient.setQueryData(queryKey, getUpdatedEvent(data as Event))
				}
			})

			// 2. Update Feed and Home
			const feedQueries = [

				...queryClient.getQueriesData({ queryKey: queryKeys.activity.home() }),
			]

			feedQueries.forEach(([queryKey, data]) => {
				const feedData = data as { pages?: Array<{ items: Array<{ type: string; data: unknown }> }> }
				if (!feedData || !feedData.pages) { return }
				previousData.set(queryKey, feedData)

				const newPages = feedData.pages.map((page) => ({
					...page,
					items: page.items.map((item) => {
						// Trending Event
						if (item.type === 'trending_event' && (item.data as Partial<Event>).id === eventId) {
							return { ...item, data: getUpdatedEvent(item.data as Event) }
						}
						// Activity (e.g. Create)
						if (item.type === 'activity' && (item.data as { event?: Event })?.event?.id === eventId) {
							const activityData = item.data as { event: Event }
							return {
								...item,
								data: {
									...activityData,
									event: getUpdatedEvent(activityData.event)
								}
							}
						}
						return item
					})
				}))

				queryClient.setQueryData(queryKey, { ...feedData, pages: newPages })
			})

			return { previousData }
		},
		onError: (error, variables, context) => {
			// Rollback on error
			if (context?.previousData) {
				context.previousData.forEach((data, queryKey) => {
					queryClient.setQueryData(queryKey, data)
				})
			}
			// Handle error with user-friendly message
			const message =
				variables === null ? 'Failed to remove attendance' : 'Failed to set attendance'
			handleMutationError(error, message)
		},
		onSuccess: () => {
			// Invalidate queries to ensure UI reflects change immediately
			// While SSE handles real-time updates, invalidating ensures the user sees their own action
			// Removed global feed invalidation to prevent full feed reload spinner on RSVP
			queryClient.invalidateQueries({ queryKey: queryKeys.events.details() })
		},
	})
}

export function useLikeEvent(eventId: string, userId?: string) {
	const queryClient = useQueryClient()
	const handleMutationError = useMutationErrorHandler()

	return useMutation({
		mutationFn: async (liked: boolean) => {
			if (liked) {
				// Unlike
				return api.delete(`/events/${eventId}/like`, undefined, 'Failed to unlike event')
			}
			// Like
			return api.post(`/events/${eventId}/like`, {}, undefined, 'Failed to like event')
		},
		onMutate: async (liked) => {
			// Cancel outgoing queries
			await queryClient.cancelQueries({
				queryKey: queryKeys.events.details(),
			})

			// Get all event detail queries to update
			const eventQueries = queryClient.getQueriesData({
				queryKey: queryKeys.events.details(),
			})

			const previousData = new Map()

			// Optimistically update all matching event queries
			eventQueries.forEach(([queryKey, data]) => {
				if (data && typeof data === 'object' && 'id' in data && data.id === eventId) {
					previousData.set(queryKey, data)
					const eventDetail = data as unknown as EventDetail

					if (liked) {
						// Remove like
						const updatedLikes = eventDetail.likes.filter(
							(l: { user?: { id?: string } }) => userId && l.user?.id !== userId
						)
						queryClient.setQueryData(queryKey, {
							...eventDetail,
							likes: updatedLikes,
							_count: {
								...eventDetail._count,
								likes: Math.max((eventDetail._count?.likes || 0) - 1, 0),
							},
						})
					} else {
						// Add like - wait for SSE to add actual like with full user data
						// Just update count optimistically
						queryClient.setQueryData(queryKey, {
							...eventDetail,
							_count: {
								...eventDetail._count,
								likes: (eventDetail._count?.likes || 0) + 1,
							},
						})
					}
				}
			})

			return { previousData }
		},
		onError: (error, variables, context) => {
			// Rollback on error
			if (context?.previousData) {
				context.previousData.forEach((data, queryKey) => {
					queryClient.setQueryData(queryKey, data)
				})
			}
			// Handle error with user-friendly message
			const message = variables ? 'Failed to unlike event' : 'Failed to like event'
			handleMutationError(error, message)
		},
		onSuccess: () => {
			// Don't invalidate immediately - wait for SSE event
			// SSE will update the cache with accurate data
		},
	})
}

export function useShareEvent(eventId: string) {
	const queryClient = useQueryClient()
	const handleMutationError = useMutationErrorHandler()

	return useMutation({
		mutationFn: () =>
			api.post(`/events/${eventId}/share`, undefined, undefined, 'Failed to share event'),
		onError: (error) => {
			handleMutationError(error, 'Failed to share event')
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.activity.home() })
		},
	})
}

export function useAddComment(eventId: string) {
	const queryClient = useQueryClient()
	const handleMutationError = useMutationErrorHandler()

	return useMutation({
		mutationFn: (input: CommentInput) =>
			api.post(`/events/${eventId}/comments`, input, undefined, 'Failed to add comment'),
		onMutate: async (_input) => {
			// Cancel outgoing queries
			await queryClient.cancelQueries({
				queryKey: queryKeys.events.details(),
			})

			// Get all event detail queries to update
			const eventQueries = queryClient.getQueriesData({
				queryKey: queryKeys.events.details(),
			})

			const previousData = new Map()

			// Optimistically update count - wait for SSE to add actual comment
			eventQueries.forEach(([queryKey, data]) => {
				if (data && typeof data === 'object' && 'id' in data && data.id === eventId) {
					previousData.set(queryKey, data)
					const eventDetail = data as unknown as EventDetail

					queryClient.setQueryData(queryKey, {
						...eventDetail,
						_count: {
							...eventDetail._count,
							comments: (eventDetail._count?.comments || 0) + 1,
						},
					})
				}
			})

			return { previousData }
		},
		onError: (error, _variables, context) => {
			// Rollback on error
			if (context?.previousData) {
				context.previousData.forEach((data, queryKey) => {
					queryClient.setQueryData(queryKey, data)
				})
			}
			// Handle error with user-friendly message
			handleMutationError(error, 'Failed to add comment')
		},
		onSuccess: () => {
			// Don't invalidate immediately - wait for SSE event
			// SSE will update the cache with accurate data
		},
	})
}

export function useTrendingEvents(
	limit: number = 5,
	windowDays: number = 7,
	options?: UseTrendingEventsOptions
) {
	return useQuery<TrendingEventsResponse>({
		queryKey: queryKeys.events.trending(limit, windowDays),
		queryFn: () =>
			api.get<TrendingEventsResponse>(
				'/events/trending',
				{ limit, windowDays },
				undefined,
				'Failed to fetch trending events'
			),
		enabled: options?.enabled ?? true,
		staleTime: 60_000,
	})
}

export function useEventReminder(eventId: string, username: string) {
	const queryClient = useQueryClient()
	const handleMutationError = useMutationErrorHandler()

	return useMutation({
		mutationFn: async (minutesBeforeStart: number | null) => {
			if (minutesBeforeStart === null) {
				return api.delete(
					`/events/${eventId}/reminders`,
					undefined,
					'Failed to remove reminder'
				)
			}
			return api.post(
				`/events/${eventId}/reminders`,
				{ minutesBeforeStart },
				undefined,
				'Failed to update reminder'
			)
		},
		onError: (error, variables) => {
			const message =
				variables === null ? 'Failed to remove reminder' : 'Failed to update reminder'
			handleMutationError(error, message)
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.events.detail(username, eventId) })
		},
	})
}

export function usePlatformStats(options?: { enabled?: boolean }) {
	return useQuery<PlatformStatsResponse>({
		queryKey: queryKeys.platform.stats(),
		enabled: options?.enabled ?? true,
		queryFn: () =>
			api.get<PlatformStatsResponse>(
				'/search/stats',
				undefined,
				undefined,
				'Failed to fetch platform statistics'
			),
		staleTime: 60_000, // Cache for 1 minute
	})
}
