/**
 * Global SSE connection hook that integrates with TanStack Query
 * Single instance manages all real-time updates and cache invalidation
 */

import { useEffect, useState, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from './queries/keys'
import { useUIStore } from '../stores'
import type { EventDetail, EventUser } from '../types'

interface UseRealtimeSSEOptions {
    userId?: string
    onConnect?: () => void
    onDisconnect?: () => void
}

export function useRealtimeSSE(options: UseRealtimeSSEOptions = {}) {
    const queryClient = useQueryClient()
    const setSSEConnected = useUIStore((state) => state.setSSEConnected)
    const [isConnected, setIsConnected] = useState(false)
    const eventSourceRef = useRef<EventSource | null>(null)

    const applyToEventDetailCache = (
        eventId: string,
        handler: (params: { queryKey: unknown; detail: EventDetail }) => void
    ) => {
        const eventQueries = queryClient.getQueriesData({
            queryKey: queryKeys.events.details(),
        })

        eventQueries.forEach(([queryKey, data]) => {
            if (data && typeof data === 'object' && 'id' in data && data.id === eventId) {
                handler({ queryKey, detail: data as EventDetail })
            }
        })
    }

    useEffect(() => {
        // Create SSE connection
        const url = options.userId
            ? `/api/stream?userId=${options.userId}`
            : '/api/stream'

        const eventSource = new EventSource(url, {
            withCredentials: true,
        })

        eventSourceRef.current = eventSource

        // Connection opened
        eventSource.addEventListener('connected', (e) => {
            console.log('✅ SSE connected:', JSON.parse(e.data))
            setIsConnected(true)
            setSSEConnected(true)
            options.onConnect?.()
        })

        // Heartbeat
        eventSource.addEventListener('heartbeat', () => {
            // Silent heartbeat
        })

        // Event updates
        eventSource.addEventListener('event:created', (e) => {
            const event = JSON.parse(e.data)
            console.log('[SSE] Event created:', event)
            // Invalidate events list queries
            queryClient.invalidateQueries({ queryKey: queryKeys.events.lists() })
        })

        eventSource.addEventListener('event:updated', (e) => {
            const event = JSON.parse(e.data)
            console.log('[SSE] Event updated:', event)
            const updatedEvent = event.data.event

            // Update specific event in cache if it exists
            if (updatedEvent?.user?.username && updatedEvent?.id) {
                queryClient.setQueryData(
                    queryKeys.events.detail(updatedEvent.user.username, updatedEvent.id),
                    updatedEvent
                )
            }

            // Invalidate events list queries
            queryClient.invalidateQueries({ queryKey: queryKeys.events.lists() })
        })

        eventSource.addEventListener('event:deleted', (e) => {
            const event = JSON.parse(e.data)
            console.log('[SSE] Event deleted:', event)
            const eventId = event.data.eventId || event.data.externalId

            // Remove from cache if we know the username
            if (event.data.username && eventId) {
                queryClient.removeQueries({
                    queryKey: queryKeys.events.detail(event.data.username, eventId),
                })
            }

            // Invalidate events list queries
            queryClient.invalidateQueries({ queryKey: queryKeys.events.lists() })
        })

        // Attendance updates
        eventSource.addEventListener('attendance:added', (e) => {
            const event = JSON.parse(e.data)
            console.log('[SSE] Attendance added:', event)
            if (event.data?.eventId) {
                // Invalidate to get fresh data from server (attendance includes full user objects)
                queryClient.invalidateQueries({
                    queryKey: queryKeys.events.details(),
                })
            }
        })

        eventSource.addEventListener('attendance:updated', (e) => {
            const event = JSON.parse(e.data)
            console.log('[SSE] Attendance updated:', event)
            if (event.data?.eventId) {
                // Invalidate to get fresh data from server (attendance can be complex with status changes)
                queryClient.invalidateQueries({
                    queryKey: queryKeys.events.details(),
                })
            }
        })

        eventSource.addEventListener('attendance:removed', (e) => {
            const event = JSON.parse(e.data)
            console.log('[SSE] Attendance removed:', event)
            if (event.data?.eventId) {
                applyToEventDetailCache(event.data.eventId, ({ queryKey }) => {
                    queryClient.invalidateQueries({ queryKey })
                })
            }
        })

        // Like updates
        eventSource.addEventListener('like:added', (e) => {
            const event = JSON.parse(e.data)
            console.log('[SSE] Like added:', event)
            if (event.data?.eventId && event.data?.like) {
                applyToEventDetailCache(event.data.eventId, ({ queryKey, detail }) => {
                    const newLike = event.data.like as { user: EventUser }
                    const existingLike = detail.likes?.find(
                        (like) => like.user?.id === newLike.user?.id
                    )
                    if (existingLike) {
                        return
                    }
                    const updatedLikes = [...(detail.likes || []), newLike]
                    queryClient.setQueryData(queryKey, {
                        ...detail,
                        likes: updatedLikes,
                        _count: {
                            ...detail._count,
                            likes: updatedLikes.length,
                        },
                    })
                })
            }
        })

        eventSource.addEventListener('like:removed', (e) => {
            const event = JSON.parse(e.data)
            console.log('[SSE] Like removed:', event)
            if (event.data?.eventId && event.data?.userId) {
                applyToEventDetailCache(event.data.eventId, ({ queryKey, detail }) => {
                    const updatedLikes = detail.likes?.filter(
                        (like) => like.user?.id !== event.data.userId
                    ) || []
                    queryClient.setQueryData(queryKey, {
                        ...detail,
                        likes: updatedLikes,
                        _count: {
                            ...detail._count,
                            likes: updatedLikes.length,
                        },
                    })
                })
            }
        })

        // Comment updates
        eventSource.addEventListener('comment:added', (e) => {
            const event = JSON.parse(e.data)
            console.log('[SSE] Comment added:', event)
            if (event.data?.eventId && event.data?.comment) {
                applyToEventDetailCache(event.data.eventId, ({ queryKey, detail }) => {
                    const newComment = event.data.comment
                    const updatedComments = [...(detail.comments || []), newComment]
                    queryClient.setQueryData(queryKey, {
                        ...detail,
                        comments: updatedComments,
                        _count: {
                            ...detail._count,
                            comments: updatedComments.length,
                        },
                    })
                })
            }
        })

        eventSource.addEventListener('comment:deleted', (e) => {
            const event = JSON.parse(e.data)
            console.log('[SSE] Comment deleted:', event)
            if (event.data?.eventId && event.data?.commentId) {
                applyToEventDetailCache(event.data.eventId, ({ queryKey, detail }) => {
                    const updatedComments = detail.comments?.filter(
                        (comment) => comment.id !== event.data.commentId
                    ) || []
                    queryClient.setQueryData(queryKey, {
                        ...detail,
                        comments: updatedComments,
                        _count: {
                            ...detail._count,
                            comments: updatedComments.length,
                        },
                    })
                })
            }
        })

        // Profile updates
        eventSource.addEventListener('profile:updated', (e) => {
            const event = JSON.parse(e.data)
            console.log('[SSE] Profile updated:', event)
            if (event.data?.username) {
                queryClient.invalidateQueries({
                    queryKey: queryKeys.users.profile(event.data.username),
                })
            }
        })

        // Follow updates
        eventSource.addEventListener('follow:added', (e) => {
            const event = JSON.parse(e.data)
            console.log('[SSE] Follow added:', event)
            if (event.data?.username) {
                queryClient.invalidateQueries({
                    queryKey: queryKeys.users.profile(event.data.username),
                })
                queryClient.invalidateQueries({
                    queryKey: queryKeys.users.followStatus(event.data.username),
                })
            }
        })

        eventSource.addEventListener('follower:added', (e) => {
            const event = JSON.parse(e.data)
            console.log('[SSE] Follower added:', event)
            if (event.data?.username) {
                // Update profile with new follower count if provided
                if (event.data.followerCount !== null && event.data.followerCount !== undefined) {
                    const profileData = queryClient.getQueryData(
                        queryKeys.users.profile(event.data.username)
                    ) as { user: { _count: { followers: number; following: number; events: number } } } | undefined
                    if (profileData) {
                        queryClient.setQueryData(
                            queryKeys.users.profile(event.data.username),
                            {
                                ...profileData,
                                user: {
                                    ...profileData.user,
                                    _count: {
                                        ...profileData.user._count,
                                        followers: event.data.followerCount,
                                    },
                                },
                            }
                        )
                    } else {
                        // If profile not in cache, invalidate to refetch
                        queryClient.invalidateQueries({
                            queryKey: queryKeys.users.profile(event.data.username),
                        })
                    }
                } else {
                    // Invalidate to refetch if count not provided
                    queryClient.invalidateQueries({
                        queryKey: queryKeys.users.profile(event.data.username),
                    })
                }
            }
        })

        eventSource.addEventListener('follower:removed', (e) => {
            const event = JSON.parse(e.data)
            console.log('[SSE] Follower removed:', event)
            if (event.data?.username) {
                // Update profile with new follower count if provided
                if (event.data.followerCount !== null && event.data.followerCount !== undefined) {
                    const profileData = queryClient.getQueryData(
                        queryKeys.users.profile(event.data.username)
                    ) as { user: { _count: { followers: number; following: number; events: number } } } | undefined
                    if (profileData) {
                        queryClient.setQueryData(
                            queryKeys.users.profile(event.data.username),
                            {
                                ...profileData,
                                user: {
                                    ...profileData.user,
                                    _count: {
                                        ...profileData.user._count,
                                        followers: event.data.followerCount,
                                    },
                                },
                            }
                        )
                    } else {
                        // If profile not in cache, invalidate to refetch
                        queryClient.invalidateQueries({
                            queryKey: queryKeys.users.profile(event.data.username),
                        })
                    }
                } else {
                    // Invalidate to refetch if count not provided
                    queryClient.invalidateQueries({
                        queryKey: queryKeys.users.profile(event.data.username),
                    })
                }
            }
        })

        eventSource.addEventListener('follow:removed', (e) => {
            const event = JSON.parse(e.data)
            console.log('[SSE] Follow removed:', event)
            if (event.data?.username) {
                // Update follow status to not following
                queryClient.setQueryData(
                    queryKeys.users.followStatus(event.data.username),
                    {
                        isFollowing: false,
                        isAccepted: false,
                    }
                )

                // Invalidate profile to refresh
                queryClient.invalidateQueries({
                    queryKey: queryKeys.users.profile(event.data.username),
                })
            }
        })

        // Follow pending event - when we send a follow request to a remote user
        eventSource.addEventListener('follow:pending', (e) => {
            const event = JSON.parse(e.data)
            console.log('[SSE] Follow pending:', event)
            if (event.data?.username) {
                // Update follow status to pending
                queryClient.setQueryData(
                    queryKeys.users.followStatus(event.data.username),
                    {
                        isFollowing: true,
                        isAccepted: false,
                    }
                )
            }
        })

        // Follow accepted event - when a remote user accepts our follow request
        eventSource.addEventListener('follow:accepted', (e) => {
            const event = JSON.parse(e.data)
            console.log('[SSE] Follow accepted:', event)
            if (event.data?.username) {
                // Update follow status
                queryClient.setQueryData(
                    queryKeys.users.followStatus(event.data.username),
                    {
                        isFollowing: true,
                        isAccepted: true,
                    }
                )

                // Update profile with new follower count if provided
                if (event.data.followerCount !== null && event.data.followerCount !== undefined) {
                    const profileData = queryClient.getQueryData(
                        queryKeys.users.profile(event.data.username)
                    ) as { user: { _count: { followers: number; following: number; events: number } } } | undefined
                    if (profileData) {
                        queryClient.setQueryData(
                            queryKeys.users.profile(event.data.username),
                            {
                                ...profileData,
                                user: {
                                    ...profileData.user,
                                    _count: {
                                        ...profileData.user._count,
                                        followers: event.data.followerCount,
                                    },
                                },
                            }
                        )
                    } else {
                        // If profile not in cache, invalidate to refetch
                        queryClient.invalidateQueries({
                            queryKey: queryKeys.users.profile(event.data.username),
                        })
                    }
                } else {
                    // Invalidate to refetch if count not provided
                    queryClient.invalidateQueries({
                        queryKey: queryKeys.users.profile(event.data.username),
                    })
                }

                // Also invalidate follow status to ensure consistency
                queryClient.invalidateQueries({
                    queryKey: queryKeys.users.followStatus(event.data.username),
                })
            }
        })

        // Follow rejected event - when a remote user rejects our follow request
        eventSource.addEventListener('follow:rejected', (e) => {
            const event = JSON.parse(e.data)
            console.log('[SSE] Follow rejected:', event)
            if (event.data?.username) {
                // Update follow status to rejected (not following)
                queryClient.setQueryData(
                    queryKeys.users.followStatus(event.data.username),
                    {
                        isFollowing: false,
                        isAccepted: false,
                    }
                )

                // Invalidate profile to refresh
                queryClient.invalidateQueries({
                    queryKey: queryKeys.users.profile(event.data.username),
                })
            }
        })

        // Error handling
        eventSource.onerror = (error) => {
            console.error('❌ SSE error:', error)
            setIsConnected(false)
            setSSEConnected(false)
            options.onDisconnect?.()
        }

        // Cleanup on unmount
        return () => {
            eventSource.close()
            setIsConnected(false)
            setSSEConnected(false)
        }
    }, [options.userId, queryClient, setSSEConnected, options.onConnect, options.onDisconnect])

    return {
        isConnected,
        disconnect: () => {
            eventSourceRef.current?.close()
            setIsConnected(false)
        },
    }
}

