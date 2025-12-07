import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from './keys'
import type { Event, EventDetail, EventRecommendationPayload } from '../../types'

interface EventsResponse {
    events: Event[]
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

interface UseTrendingEventsOptions {
    enabled?: boolean
}

interface RSVPInput {
    status: string
}

interface CommentInput {
    content: string
}

export interface EventSearchFilters {
    q?: string
    location?: string
    startDate?: string
    endDate?: string
    dateRange?: string
    status?: string
    mode?: string
    username?: string
    tags?: string
    categories?: string
}

interface EventSearchResponse {
    events: Event[]
    pagination: {
        page: number
        limit: number
        total: number
        pages: number
    }
    filters?: EventSearchFilters
}

// Queries
export function useEvents(limit: number = 50) {
    return useQuery<EventsResponse>({
        queryKey: queryKeys.events.list(limit),
        queryFn: async () => {
            const response = await fetch(`/api/events?limit=${limit}`, {
                credentials: 'include',
            })
            if (!response.ok) {
                throw new Error('Failed to fetch events')
            }
            return response.json()
        },
    })
}

export function useEventDetail(username: string, eventId: string) {
    return useQuery<EventDetail>({
        queryKey: queryKeys.events.detail(username, eventId),
        queryFn: async () => {
            const response = await fetch(
                `/api/events/by-user/${encodeURIComponent(username)}/${encodeURIComponent(eventId)}`,
                {
                    credentials: 'include',
                }
            )
            if (!response.ok) {
                throw new Error('Failed to fetch event')
            }
            return response.json()
        },
        enabled: !!username && !!eventId,
    })
}

export function useRecommendedEvents(limit: number = 6, options?: { enabled?: boolean }) {
    return useQuery<RecommendationsResponse>({
        queryKey: queryKeys.events.recommendations(limit),
        enabled: options?.enabled ?? true,
        retry: false,
        queryFn: async () => {
            const response = await fetch(`/api/recommendations?limit=${limit}`, {
                credentials: 'include',
            })

            if (response.status === 401) {
                return {
                    recommendations: [],
                    metadata: {
                        generatedAt: new Date().toISOString(),
                        signals: { tags: 0, hosts: 0, followed: 0 },
                    },
                }
            }

            if (!response.ok) {
                throw new Error('Failed to fetch recommendations')
            }

            return response.json()
        },
    })
}

export function useEventSearch(filters: EventSearchFilters, page: number = 1, limit: number = 20) {
    return useQuery<EventSearchResponse>({
        queryKey: queryKeys.events.search(filters as Record<string, unknown>, page, limit),
        queryFn: async () => {
            const params = new URLSearchParams()
            
            if (filters.q) params.set('q', filters.q)
            if (filters.location) params.set('location', filters.location)
            if (filters.startDate) params.set('startDate', filters.startDate)
            if (filters.endDate) params.set('endDate', filters.endDate)
            if (filters.status) params.set('status', filters.status)
            if (filters.mode) params.set('mode', filters.mode)
            if (filters.username) params.set('username', filters.username)
            if (filters.tags) params.set('tags', filters.tags)
            if (filters.categories) params.set('tags', filters.categories) // Backend uses 'tags' for categories
            // Note: dateRange is not sent to backend - it's converted to startDate/endDate by the frontend
            
            params.set('page', String(page))
            params.set('limit', String(limit))

            const response = await fetch(`/api/search?${params.toString()}`, {
                credentials: 'include',
            })

            if (!response.ok) {
                throw new Error('Failed to search events')
            }

            return response.json()
        },
    })
}


export function useDeleteEvent(eventId: string) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (userId: string) => {
            const response = await fetch(`/api/events/${eventId}`, {
                method: 'DELETE',
                credentials: 'include',
                headers: {
                    'x-user-id': userId,
                },
            })

            if (!response.ok) {
                const error = await response.json().catch(() => ({
                    error: 'Failed to delete event',
                }))
                throw new Error(error.error || 'Failed to delete event')
            }

            return response.json()
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

    return useMutation({
        mutationFn: async (input: RSVPInput | null) => {
            if (input === null) {
                // Remove attendance
                const response = await fetch(`/api/events/${eventId}/attend`, {
                    method: 'DELETE',
                    credentials: 'include',
                })
                if (!response.ok) {
                    throw new Error('Failed to remove attendance')
                }
                return response.json()
            } else {
                // Set attendance
                const response = await fetch(`/api/events/${eventId}/attend`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify({ status: input.status }),
                })
                if (!response.ok) {
                    throw new Error('Failed to set attendance')
                }
                return response.json()
            }
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
                        const updatedAttendance = eventDetail.attendance?.filter(
                            (a: { user?: { id?: string } }) => userId && a.user?.id !== userId
                        ) || []
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
                            ? eventDetail.attendance?.findIndex((a: { user?: { id?: string } }) => a.user?.id === userId) ?? -1
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
        onError: (_err, _variables, context) => {
            // Rollback on error
            if (context?.previousData) {
                context.previousData.forEach((data, queryKey) => {
                    queryClient.setQueryData(queryKey, data)
                })
            }
        },
        onSuccess: () => {
            // Don't invalidate immediately - wait for SSE event
            // SSE will update the cache with accurate data
        },
    })
}

export function useLikeEvent(eventId: string, userId?: string) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (liked: boolean) => {
            if (liked) {
                // Unlike
                const response = await fetch(`/api/events/${eventId}/like`, {
                    method: 'DELETE',
                    credentials: 'include',
                })
                if (!response.ok) {
                    throw new Error('Failed to unlike event')
                }
                return response.json()
            } else {
                // Like
                const response = await fetch(`/api/events/${eventId}/like`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                })
                if (!response.ok) {
                    throw new Error('Failed to like event')
                }
                return response.json()
            }
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
                        const updatedLikes = eventDetail.likes?.filter(
                            (l: { user?: { id?: string } }) => userId && l.user?.id !== userId
                        ) || []
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
        onError: (_err, _variables, context) => {
            // Rollback on error
            if (context?.previousData) {
                context.previousData.forEach((data, queryKey) => {
                    queryClient.setQueryData(queryKey, data)
                })
            }
        },
        onSuccess: () => {
            // Don't invalidate immediately - wait for SSE event
            // SSE will update the cache with accurate data
        },
    })
}

export function useShareEvent(eventId: string) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async () => {
            const response = await fetch(`/api/events/${eventId}/share`, {
                method: 'POST',
                credentials: 'include',
            })
            if (!response.ok) {
                const error = await response.json().catch(() => ({
                    error: 'Failed to share event',
                }))
                throw new Error(error.error || 'Failed to share event')
            }
            return response.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.activity.feed() })
        },
    })
}

export function useAddComment(eventId: string) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (input: CommentInput) => {
            const response = await fetch(`/api/events/${eventId}/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(input),
            })

            if (!response.ok) {
                throw new Error('Failed to add comment')
            }

            return response.json()
        },
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
        onError: (_err, _variables, context) => {
            // Rollback on error
            if (context?.previousData) {
                context.previousData.forEach((data, queryKey) => {
                    queryClient.setQueryData(queryKey, data)
                })
            }
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
        queryFn: async () => {
            const params = new URLSearchParams({
                limit: String(limit),
                windowDays: String(windowDays),
            })
            const response = await fetch(`/api/events/trending?${params.toString()}`, {
                credentials: 'include',
            })
            if (!response.ok) {
                throw new Error('Failed to fetch trending events')
            }
            return response.json()
        },
        enabled: options?.enabled ?? true,
        staleTime: 60_000,
    })
}


