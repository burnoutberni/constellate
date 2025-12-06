/**
 * Global SSE connection hook that integrates with TanStack Query
 * Single instance manages all real-time updates and cache invalidation
 */

import { useEffect, useState, useRef } from 'react'
import { useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query'
import { queryKeys } from './queries/keys'
import { useUIStore } from '../stores'
import type { EventDetail, EventUser, Notification } from '../types'
import type { NotificationsResponse } from './queries/notifications'

type QueryKeys = typeof queryKeys

interface UseRealtimeSSEOptions {
    userId?: string
    onConnect?: () => void
    onDisconnect?: () => void
}

const checkLikeExists = (likes: Array<{ user?: EventUser }> | undefined, userId: string | undefined): boolean => {
    if (!likes || !userId) return false
    return likes.some((l) => l.user?.id === userId)
}

const filterLikesByUserId = (likes: Array<{ user?: EventUser }> | undefined, userId: string): Array<{ user?: EventUser }> => {
    if (!likes) return []
    return likes.filter((l) => l.user?.id !== userId)
}

const filterCommentsById = (comments: Array<{ id: string }> | undefined, commentId: string): Array<{ id: string }> => {
    if (!comments) return []
    return comments.filter((c) => c.id !== commentId)
}

const isValidEventData = (data: unknown, eventId: string): data is EventDetail & { id: string } => {
    return data !== null && typeof data === 'object' && 'id' in data && data.id === eventId
}

const updateLikeInCache = (
    queryKey: QueryKey,
    data: unknown,
    eventId: string,
    newLike: { user: EventUser },
    qClient: QueryClient
) => {
    if (!isValidEventData(data, eventId)) return
    const eventDetail = data as EventDetail
    const userId = newLike.user?.id
    if (checkLikeExists(eventDetail.likes, userId)) return
    const currentLikes = eventDetail.likes || []
    const updatedLikes = [...currentLikes, newLike]
    const updatedCount = updatedLikes.length
    qClient.setQueryData(queryKey, {
        ...eventDetail,
        likes: updatedLikes,
        _count: {
            ...eventDetail._count,
            likes: updatedCount,
        },
    })
}

const removeLikeFromCache = (
    queryKey: QueryKey,
    data: unknown,
    eventId: string,
    userId: string,
    qClient: QueryClient
) => {
    if (!isValidEventData(data, eventId)) return
    const eventDetail = data as EventDetail
    const updatedLikes = filterLikesByUserId(eventDetail.likes, userId)
    qClient.setQueryData(queryKey, {
        ...eventDetail,
        likes: updatedLikes,
        _count: {
            ...eventDetail._count,
            likes: updatedLikes.length,
        },
    })
}

const removeCommentFromCache = (
    queryKey: QueryKey,
    data: unknown,
    eventId: string,
    commentId: string,
    qClient: QueryClient
) => {
    if (!isValidEventData(data, eventId)) return
    const eventDetail = data as EventDetail
    const updatedComments = filterCommentsById(eventDetail.comments, commentId)
    qClient.setQueryData(queryKey, {
        ...eventDetail,
        comments: updatedComments,
        _count: {
            ...eventDetail._count,
            comments: updatedComments.length,
        },
    })
}

const addCommentToCache = (
    queryKey: QueryKey,
    data: unknown,
    eventId: string,
    newComment: unknown,
    qClient: QueryClient
) => {
    if (!isValidEventData(data, eventId)) return
    const eventDetail = data as EventDetail
    const updatedComments = [...(eventDetail.comments || []), newComment]
    qClient.setQueryData(queryKey, {
        ...eventDetail,
        comments: updatedComments,
        _count: {
            ...eventDetail._count,
            comments: updatedComments.length,
        },
    })
}


const getNotificationLimitFromQueryKey = (queryKey: unknown): number | null => {
    if (Array.isArray(queryKey) && queryKey.length >= 3) {
        const value = queryKey[2]
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value
        }
    }
    return null
}

const updateNotificationCaches = (
    queryClient: QueryClient,
    updater: (current: NotificationsResponse, limit: number | null) => NotificationsResponse
) => {
    const queries = queryClient.getQueriesData<NotificationsResponse>({
        queryKey: queryKeys.notifications.all(),
    })

    queries.forEach(([queryKey, data]) => {
        if (!data) {
            return
        }

        const limit = getNotificationLimitFromQueryKey(queryKey)
        const updated = updater(data, limit)
        queryClient.setQueryData(queryKey, updated)
    })
}


const setupEventListeners = (
    eventSource: EventSource,
    queryClient: QueryClient,
    queryKeys: QueryKeys,
    setSSEConnected: (connected: boolean) => void,
    setIsConnected: (connected: boolean) => void,
    options: UseRealtimeSSEOptions,
    addMentionNotification?: (notification: {
        id: string
        commentId: string
        content: string
        eventId: string
        eventTitle?: string
        eventOwnerHandle?: string
        handle?: string
        author?: { id?: string; username?: string; name?: string }
        createdAt: string
    }) => void
) => {
    eventSource.addEventListener('connected', (e) => {
        console.log('✅ SSE connected:', JSON.parse(e.data))
        setIsConnected(true)
        setSSEConnected(true)
        options.onConnect?.()
    })

    eventSource.addEventListener('heartbeat', () => {
        // Silent heartbeat
    })

    eventSource.addEventListener('event:created', (e) => {
        const event = JSON.parse(e.data)
        console.log('[SSE] Event created:', event)
        queryClient.invalidateQueries({ queryKey: queryKeys.events.lists() })
    })

    eventSource.addEventListener('event:updated', (e) => {
        const event = JSON.parse(e.data)
        console.log('[SSE] Event updated:', event)
        const updatedEvent = event.data.event

        if (updatedEvent?.user?.username && updatedEvent?.id) {
            queryClient.setQueryData(
                queryKeys.events.detail(updatedEvent.user.username, updatedEvent.id),
                updatedEvent
            )
        }

        queryClient.invalidateQueries({ queryKey: queryKeys.events.lists() })
    })

    eventSource.addEventListener('event:deleted', (e) => {
        const event = JSON.parse(e.data)
        console.log('[SSE] Event deleted:', event)
        const eventId = event.data.eventId || event.data.externalId

        if (event.data.username && eventId) {
            queryClient.removeQueries({
                queryKey: queryKeys.events.detail(event.data.username, eventId),
            })
        }

        queryClient.invalidateQueries({ queryKey: queryKeys.events.lists() })
    })

    eventSource.addEventListener('attendance:added', (e) => {
        const event = JSON.parse(e.data)
        console.log('[SSE] Attendance added:', event)
        if (event.data?.eventId) {
            queryClient.invalidateQueries({
                queryKey: queryKeys.events.details(),
            })
        }
    })

    eventSource.addEventListener('attendance:updated', (e) => {
        const event = JSON.parse(e.data)
        console.log('[SSE] Attendance updated:', event)
        if (event.data?.eventId) {
            queryClient.invalidateQueries({
                queryKey: queryKeys.events.details(),
            })
        }
    })

    eventSource.addEventListener('attendance:removed', (e) => {
        const event = JSON.parse(e.data)
        console.log('[SSE] Attendance removed:', event)
        if (!event.data?.eventId) return
        const eventQueries = queryClient.getQueriesData({
            queryKey: queryKeys.events.details(),
        })
        for (const [queryKey, data] of eventQueries) {
            if (data && typeof data === 'object' && 'id' in data && data.id === event.data.eventId) {
                queryClient.invalidateQueries({ queryKey })
            }
        }
    })

    eventSource.addEventListener('like:added', (e) => {
        const event = JSON.parse(e.data)
        console.log('[SSE] Like added:', event)
        if (!event.data?.eventId || !event.data?.like) return
        const eventQueries = queryClient.getQueriesData({
            queryKey: queryKeys.events.details(),
        })
        const newLike = event.data.like as { user: EventUser }
        for (const [queryKey, data] of eventQueries) {
            updateLikeInCache(queryKey, data, event.data.eventId, newLike, queryClient)
        }
    })

    eventSource.addEventListener('like:removed', (e) => {
        const event = JSON.parse(e.data)
        console.log('[SSE] Like removed:', event)
        if (!event.data?.eventId || !event.data?.userId) return
        const eventQueries = queryClient.getQueriesData({
            queryKey: queryKeys.events.details(),
        })
        for (const [queryKey, data] of eventQueries) {
            removeLikeFromCache(queryKey, data, event.data.eventId, event.data.userId, queryClient)
        }
    })

    eventSource.addEventListener('comment:added', (e) => {
        const event = JSON.parse(e.data)
        console.log('[SSE] Comment added:', event)
        if (!event.data?.eventId || !event.data?.comment) return
        const eventQueries = queryClient.getQueriesData({
            queryKey: queryKeys.events.details(),
        })
        for (const [queryKey, data] of eventQueries) {
            addCommentToCache(queryKey, data, event.data.eventId, event.data.comment, queryClient)
        }
    })

    eventSource.addEventListener('comment:deleted', (e) => {
        const event = JSON.parse(e.data)
        console.log('[SSE] Comment deleted:', event)
        if (!event.data?.eventId || !event.data?.commentId) return
        const eventQueries = queryClient.getQueriesData({
            queryKey: queryKeys.events.details(),
        })
        for (const [queryKey, data] of eventQueries) {
            removeCommentFromCache(queryKey, data, event.data.eventId, event.data.commentId, queryClient)
        }
    })

    eventSource.addEventListener('profile:updated', (e) => {
        const event = JSON.parse(e.data)
        console.log('[SSE] Profile updated:', event)
        if (event.data?.username) {
            queryClient.invalidateQueries({
                queryKey: queryKeys.users.profile(event.data.username),
            })
        }
    })

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
                    queryClient.invalidateQueries({
                        queryKey: queryKeys.users.profile(event.data.username),
                    })
                }
            } else {
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
                    queryClient.invalidateQueries({
                        queryKey: queryKeys.users.profile(event.data.username),
                    })
                }
            } else {
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
            queryClient.setQueryData(
                queryKeys.users.followStatus(event.data.username),
                {
                    isFollowing: false,
                    isAccepted: false,
                }
            )
            queryClient.invalidateQueries({
                queryKey: queryKeys.users.profile(event.data.username),
            })
        }
    })

    eventSource.addEventListener('follow:pending', (e) => {
        const event = JSON.parse(e.data)
        console.log('[SSE] Follow pending:', event)
        if (event.data?.username) {
            queryClient.setQueryData(
                queryKeys.users.followStatus(event.data.username),
                {
                    isFollowing: true,
                    isAccepted: false,
                }
            )
        }
    })

    eventSource.addEventListener('follow:accepted', (e) => {
        const event = JSON.parse(e.data)
        console.log('[SSE] Follow accepted:', event)
        if (event.data?.username) {
            queryClient.setQueryData(
                queryKeys.users.followStatus(event.data.username),
                {
                    isFollowing: true,
                    isAccepted: true,
                }
            )
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
                    queryClient.invalidateQueries({
                        queryKey: queryKeys.users.profile(event.data.username),
                    })
                }
            } else {
                queryClient.invalidateQueries({
                    queryKey: queryKeys.users.profile(event.data.username),
                })
            }
        }
    })

    eventSource.addEventListener('follow:rejected', (e) => {
        const event = JSON.parse(e.data)
        console.log('[SSE] Follow rejected:', event)
        if (event.data?.username) {
            queryClient.setQueryData(
                queryKeys.users.followStatus(event.data.username),
                {
                    isFollowing: false,
                    isAccepted: false,
                }
            )
            queryClient.invalidateQueries({
                queryKey: queryKeys.users.profile(event.data.username),
            })
        }
    })

    if (addMentionNotification) {
        eventSource.addEventListener('mention:received', (e) => {
            const event = JSON.parse(e.data)
            console.log('[SSE] Mention received:', event)
            const data = event.data as {
                commentId?: string
                commentContent?: string
                eventId?: string
                eventTitle?: string
                eventOwnerHandle?: string
                handle?: string
                author?: { id?: string; username?: string; name?: string }
                createdAt?: string
            }

            if (data?.commentId && data?.eventId) {
                const createdAt = data.createdAt || event.timestamp || new Date().toISOString()
                addMentionNotification({
                    id: `${data.commentId}-${createdAt}`,
                    commentId: data.commentId,
                    content: data.commentContent || '',
                    eventId: data.eventId,
                    eventTitle: data.eventTitle,
                    eventOwnerHandle: data.eventOwnerHandle,
                    handle: data.handle,
                    author: data.author,
                    createdAt,
                })
            }
        })
    }

    eventSource.addEventListener('notification:created', (e) => {
        const event = JSON.parse(e.data)
        console.log('[SSE] Notification created:', event)
        const notification = event.data?.notification as Notification | undefined
        if (!notification) {
            return
        }

        updateNotificationCaches(queryClient, (current, limit) => {
            const filtered = current.notifications.filter((item) => item.id !== notification.id)
            const merged = [notification, ...filtered]
            const trimmed = typeof limit === 'number' ? merged.slice(0, limit) : merged

            return {
                notifications: trimmed,
                unreadCount: notification.read ? current.unreadCount : current.unreadCount + 1,
            }
        })
    })

    eventSource.addEventListener('notification:read', (e) => {
        const event = JSON.parse(e.data)
        console.log('[SSE] Notification read:', event)
        const payload = event.data

        if (payload?.allRead) {
            updateNotificationCaches(queryClient, (current) => ({
                notifications: current.notifications.map((notification) => ({
                    ...notification,
                    read: true,
                    readAt: notification.readAt ?? new Date().toISOString(),
                })),
                unreadCount: 0,
            }))
            return
        }

        const notification = payload?.notification as Notification | undefined
        if (!notification) {
            return
        }

        updateNotificationCaches(queryClient, (current) => {
            const wasUnread = current.notifications.some(
                (item) => item.id === notification.id && !item.read
            )
            const updatedList = current.notifications.map((item) =>
                item.id === notification.id ? notification : item
            )

            return {
                notifications: updatedList,
                unreadCount: wasUnread ? Math.max(0, current.unreadCount - 1) : current.unreadCount,
            }
        })
    })
}

export function useRealtimeSSE(options: UseRealtimeSSEOptions = {}) {
    const queryClient = useQueryClient()
    const setSSEConnected = useUIStore((state) => state.setSSEConnected)
    const addMentionNotification = useUIStore((state) => state.addMentionNotification)
    const [isConnected, setIsConnected] = useState(false)
    const eventSourceRef = useRef<EventSource | null>(null)

    useEffect(() => {
        // Create SSE connection
        const url = options.userId
            ? `/api/stream?userId=${options.userId}`
            : '/api/stream'

        const eventSource = new EventSource(url, {
            withCredentials: true,
        })

        eventSourceRef.current = eventSource

        setupEventListeners(eventSource, queryClient, queryKeys, setSSEConnected, setIsConnected, options, addMentionNotification)

        eventSource.onerror = (error) => {
            console.error('❌ SSE error:', error)
            setIsConnected(false)
            setSSEConnected(false)
            options.onDisconnect?.()
        }

        return () => {
            eventSource.close()
            setIsConnected(false)
            setSSEConnected(false)
        }
    }, [options.userId, queryClient, setSSEConnected, options.onConnect, options.onDisconnect, addMentionNotification])

    return {
        isConnected,
        disconnect: () => {
            eventSourceRef.current?.close()
            setIsConnected(false)
        },
    }
}

