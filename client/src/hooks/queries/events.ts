import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

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
export function useEvents(limit: number = 50) {
	return useQuery<EventsResponse>({
		queryKey: queryKeys.events.list(limit),
		queryFn: () =>
			api.get<EventsResponse>('/events', { limit }, undefined, 'Failed to fetch events'),
	})
}

export function useEventDetail(username: string, eventId: string) {
	return useQuery<EventDetail>({
		queryKey: queryKeys.events.detail(username, eventId),
		queryFn: () =>
			api.get<EventDetail>(
				`/events/by-user/${encodeURIComponent(username)}/${encodeURIComponent(eventId)}`,
				undefined,
				undefined,
				'Failed to fetch event'
			),
		enabled: Boolean(username) && Boolean(eventId),
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
			queryClient.invalidateQueries({ queryKey: queryKeys.activity.feed() })
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

export function useRSVP(eventId: string, userId?: string) {
	const queryClient = useQueryClient()
	const handleMutationError = useMutationErrorHandler()

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

					if (input === null) {
						// Remove attendance
						const updatedAttendance = eventDetail.attendance.filter(
							(a: { user?: { id?: string } }) => userId && a.user?.id !== userId
						)
						queryClient.setQueryData(queryKey, {
							...eventDetail,
							attendance: updatedAttendance,
							_count: {
								...eventDetail._count,
								attendance: Math.max((eventDetail._count?.attendance || 0) - 1, 0),
							},
						})
					} else {
						// Add or update attendance
						const existingIndex = userId
							? eventDetail.attendance.findIndex(
									(a: { user?: { id?: string } }) => a.user?.id === userId
								)
							: -1

						// We'll wait for SSE to add the actual attendance with full user data
						// For now, just update the count optimistically if adding
						if (existingIndex < 0) {
							queryClient.setQueryData(queryKey, {
								...eventDetail,
								_count: {
									...eventDetail._count,
									attendance: (eventDetail._count?.attendance || 0) + 1,
								},
							})
						}
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
			const message =
				variables === null ? 'Failed to remove attendance' : 'Failed to set attendance'
			handleMutationError(error, message)
		},
		onSuccess: () => {
			// Don't invalidate immediately - wait for SSE event
			// SSE will update the cache with accurate data
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
			queryClient.invalidateQueries({ queryKey: queryKeys.activity.feed() })
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

export function usePlatformStats() {
	return useQuery<PlatformStatsResponse>({
		queryKey: queryKeys.platform.stats(),
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
