/**
 * Global SSE connection hook that integrates with TanStack Query
 * Single instance manages all real-time updates and cache invalidation
 */

import { useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query'
import { useEffect, useState, useRef } from 'react'

import { logger } from '@/lib/logger'
import { useUIStore } from '@/stores'
import type { EventDetail, EventUser, Notification } from '@/types'

import { queryKeys } from './queries/keys'
import type { NotificationsResponse } from './queries/notifications'

type QueryKeys = typeof queryKeys

interface UseRealtimeSSEOptions {
	userId?: string
	onConnect?: () => void
	onDisconnect?: () => void
}

const defaultOptions: UseRealtimeSSEOptions = {}

const checkLikeExists = (
	likes: Array<{ user?: EventUser }> | undefined,
	userId: string | undefined
): boolean => {
	if (!likes || !userId) {
		return false
	}
	return likes.some((l) => l.user?.id === userId)
}

const filterLikesByUserId = (
	likes: Array<{ user?: EventUser }> | undefined,
	userId: string
): Array<{ user?: EventUser }> => {
	if (!likes) {
		return []
	}
	return likes.filter((l) => l.user?.id !== userId)
}

const filterCommentsById = (
	comments: Array<{ id: string }> | undefined,
	commentId: string
): Array<{ id: string }> => {
	if (!comments) {
		return []
	}
	return comments.filter((c) => c.id !== commentId)
}

const isValidEventData = (data: unknown, eventId: string): data is EventDetail & { id: string } =>
	data !== null && typeof data === 'object' && 'id' in data && data.id === eventId

const updateLikeInCache = (
	queryKey: QueryKey,
	data: unknown,
	eventId: string,
	newLike: { user: EventUser },
	qClient: QueryClient
) => {
	if (!isValidEventData(data, eventId)) {
		return
	}
	const eventDetail = data as EventDetail
	const userId = newLike.user.id
	if (checkLikeExists(eventDetail.likes, userId)) {
		return
	}
	const currentLikes = eventDetail.likes
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
	if (!isValidEventData(data, eventId)) {
		return
	}
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
	if (!isValidEventData(data, eventId)) {
		return
	}
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
	if (!isValidEventData(data, eventId)) {
		return
	}
	const eventDetail = data as EventDetail
	const updatedComments = [...eventDetail.comments, newComment]
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
	queryKeysParam: QueryKeys,
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
	eventSource.addEventListener('connected', (_e) => {
		setIsConnected(true)
		setSSEConnected(true)
		options.onConnect?.()
	})

	eventSource.addEventListener('heartbeat', () => {
		// Silent heartbeat
	})

	eventSource.addEventListener('event:created', (_e) => {
		queryClient.invalidateQueries({ queryKey: queryKeysParam.events.lists() })
	})

	eventSource.addEventListener('event:updated', (e) => {
		const event = JSON.parse(e.data) as { data: { event: { id: string; user?: { username: string } } } }
		const updatedEvent = event.data.event

		if (updatedEvent?.user?.username && updatedEvent?.id) {
			queryClient.setQueryData(
				queryKeysParam.events.detail(updatedEvent.user.username, updatedEvent.id),
				updatedEvent
			)
		}

		queryClient.invalidateQueries({ queryKey: queryKeysParam.events.lists() })
	})

	eventSource.addEventListener('event:deleted', (e) => {
		const event = JSON.parse(e.data) as { data: { eventId?: string; externalId?: string; username?: string } }
		const eventId = event.data.eventId || event.data.externalId

		if (event.data.username && eventId) {
			queryClient.removeQueries({
				queryKey: queryKeysParam.events.detail(event.data.username, eventId),
			})
		}

		queryClient.invalidateQueries({ queryKey: queryKeysParam.events.lists() })
	})

	eventSource.addEventListener('attendance:added', (e) => {
		const event = JSON.parse(e.data) as { data: { eventId: string } }
		if (event.data?.eventId) {
			queryClient.invalidateQueries({
				queryKey: queryKeysParam.events.details(),
			})
		}
	})

	eventSource.addEventListener('attendance:updated', (e) => {
		const event = JSON.parse(e.data) as { data: { eventId: string } }
		if (event.data?.eventId) {
			queryClient.invalidateQueries({
				queryKey: queryKeysParam.events.details(),
			})
		}
	})

	eventSource.addEventListener('attendance:removed', (e) => {
		const event = JSON.parse(e.data) as { data: { eventId: string } }
		if (!event.data?.eventId) {
			return
		}
		const eventQueries = queryClient.getQueriesData({
			queryKey: queryKeysParam.events.details(),
		})
		for (const [queryKey, data] of eventQueries) {
			if (
				data &&
				typeof data === 'object' &&
				'id' in data &&
				data.id === event.data.eventId
			) {
				queryClient.invalidateQueries({ queryKey })
			}
		}
	})

	eventSource.addEventListener('like:added', (e) => {
		const event = JSON.parse(e.data)
		if (!event.data?.eventId || !event.data?.like) {
			return
		}
		const eventQueries = queryClient.getQueriesData({
			queryKey: queryKeysParam.events.details(),
		})
		const newLike = event.data.like as { user: EventUser }
		for (const [queryKey, data] of eventQueries) {
			updateLikeInCache(queryKey, data, event.data.eventId, newLike, queryClient)
		}
	})

	eventSource.addEventListener('like:removed', (e) => {
		const event = JSON.parse(e.data) as { data: { eventId: string; userId: string } }
		if (!event.data?.eventId || !event.data?.userId) {
			return
		}
		const eventQueries = queryClient.getQueriesData({
			queryKey: queryKeysParam.events.details(),
		})
		for (const [queryKey, data] of eventQueries) {
			removeLikeFromCache(queryKey, data, event.data.eventId, event.data.userId, queryClient)
		}
	})

	eventSource.addEventListener('comment:added', (e) => {
		const event = JSON.parse(e.data)
		if (!event.data?.eventId || !event.data?.comment) {
			return
		}
		const eventQueries = queryClient.getQueriesData({
			queryKey: queryKeysParam.events.details(),
		})
		for (const [queryKey, data] of eventQueries) {
			addCommentToCache(queryKey, data, event.data.eventId, event.data.comment, queryClient)
		}
	})

	eventSource.addEventListener('comment:deleted', (e) => {
		const event = JSON.parse(e.data) as { data: { eventId: string; commentId: string } }
		if (!event.data?.eventId || !event.data?.commentId) {
			return
		}
		const eventQueries = queryClient.getQueriesData({
			queryKey: queryKeysParam.events.details(),
		})
		for (const [queryKey, data] of eventQueries) {
			removeCommentFromCache(
				queryKey,
				data,
				event.data.eventId,
				event.data.commentId,
				queryClient
			)
		}
	})

	eventSource.addEventListener('profile:updated', (e) => {
		const event = JSON.parse(e.data) as { data: { username: string } }
		if (event.data?.username) {
			queryClient.invalidateQueries({
				queryKey: queryKeysParam.users.profile(event.data.username),
			})
		}
	})

	eventSource.addEventListener('follow:added', (e) => {
		const event = JSON.parse(e.data) as { data: { username: string } }
		if (event.data?.username) {
			queryClient.invalidateQueries({
				queryKey: queryKeysParam.users.profile(event.data.username),
			})
			queryClient.invalidateQueries({
				queryKey: queryKeysParam.users.followStatus(event.data.username),
			})
		}
	})

	eventSource.addEventListener('follower:added', (e) => {
		const event = JSON.parse(e.data) as { data: { username: string; followerCount?: number } }
		if (event.data?.username) {
			if (event.data.followerCount !== null && event.data.followerCount !== undefined) {
				const profileData = queryClient.getQueryData(
					queryKeysParam.users.profile(event.data.username)
				) as
					| { user: { _count: { followers: number; following: number; events: number } } }
					| undefined
				if (profileData) {
					queryClient.setQueryData(queryKeysParam.users.profile(event.data.username), {
						...profileData,
						user: {
							...profileData.user,
							_count: {
								...profileData.user._count,
								followers: event.data.followerCount,
							},
						},
					})
				} else {
					queryClient.invalidateQueries({
						queryKey: queryKeysParam.users.profile(event.data.username),
					})
				}
			} else {
				queryClient.invalidateQueries({
					queryKey: queryKeysParam.users.profile(event.data.username),
				})
			}
		}
	})

	eventSource.addEventListener('follower:removed', (e) => {
		const event = JSON.parse(e.data) as { data: { username: string; followerCount?: number } }
		if (event.data?.username) {
			if (event.data.followerCount !== null && event.data.followerCount !== undefined) {
				const profileData = queryClient.getQueryData(
					queryKeysParam.users.profile(event.data.username)
				) as
					| { user: { _count: { followers: number; following: number; events: number } } }
					| undefined
				if (profileData) {
					queryClient.setQueryData(queryKeysParam.users.profile(event.data.username), {
						...profileData,
						user: {
							...profileData.user,
							_count: {
								...profileData.user._count,
								followers: event.data.followerCount,
							},
						},
					})
				} else {
					queryClient.invalidateQueries({
						queryKey: queryKeysParam.users.profile(event.data.username),
					})
				}
			} else {
				queryClient.invalidateQueries({
					queryKey: queryKeysParam.users.profile(event.data.username),
				})
			}
		}
	})

	eventSource.addEventListener('follow:removed', (e) => {
		const event = JSON.parse(e.data) as { data: { username: string } }
		if (event.data?.username) {
			queryClient.setQueryData(queryKeysParam.users.followStatus(event.data.username), {
				isFollowing: false,
				isAccepted: false,
			})
			queryClient.invalidateQueries({
				queryKey: queryKeysParam.users.profile(event.data.username),
			})
		}
	})

	eventSource.addEventListener('follow:pending', (e) => {
		const event = JSON.parse(e.data) as { data: { username: string } }
		if (event.data?.username) {
			queryClient.setQueryData(queryKeysParam.users.followStatus(event.data.username), {
				isFollowing: true,
				isAccepted: false,
			})
		}
	})

	eventSource.addEventListener('follow:accepted', (e) => {
		const event = JSON.parse(e.data) as { data: { username: string; followerCount?: number } }
		if (event.data?.username) {
			queryClient.setQueryData(queryKeysParam.users.followStatus(event.data.username), {
				isFollowing: true,
				isAccepted: true,
			})
			if (event.data.followerCount !== null && event.data.followerCount !== undefined) {
				const profileData = queryClient.getQueryData(
					queryKeysParam.users.profile(event.data.username)
				) as
					| { user: { _count: { followers: number; following: number; events: number } } }
					| undefined
				if (profileData) {
					queryClient.setQueryData(queryKeysParam.users.profile(event.data.username), {
						...profileData,
						user: {
							...profileData.user,
							_count: {
								...profileData.user._count,
								followers: event.data.followerCount,
							},
						},
					})
				} else {
					queryClient.invalidateQueries({
						queryKey: queryKeysParam.users.profile(event.data.username),
					})
				}
			} else {
				queryClient.invalidateQueries({
					queryKey: queryKeysParam.users.profile(event.data.username),
				})
			}
		}
	})

	eventSource.addEventListener('follow:rejected', (e) => {
		const event = JSON.parse(e.data) as { data: { username: string } }
		if (event.data?.username) {
			queryClient.setQueryData(queryKeysParam.users.followStatus(event.data.username), {
				isFollowing: false,
				isAccepted: false,
			})
			queryClient.invalidateQueries({
				queryKey: queryKeysParam.users.profile(event.data.username),
			})
		}
	})

	if (addMentionNotification) {
		eventSource.addEventListener('mention:received', (e) => {
			const event = JSON.parse(e.data) as {
				data: {
					commentId?: string
					commentContent?: string
					eventId?: string
					eventTitle?: string
					eventOwnerHandle?: string
					handle?: string
					author?: { id?: string; username?: string; name?: string }
					createdAt?: string
				}
				timestamp?: string
			}
			const {data} = event

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
		const event = JSON.parse(e.data) as { data: { notification: Notification } }
		const notification = event.data?.notification as Notification | undefined
		if (!notification) {
			return
		}

		updateNotificationCaches(queryClient, (current, limit) => {
			// Find existing notification before filtering to check its read status
			const existingNotification = current.notifications.find(
				(item) => item.id === notification.id
			)
			const wasExistingUnread = existingNotification ? !existingNotification.read : false

			const filtered = current.notifications.filter((item) => item.id !== notification.id)
			const merged = [notification, ...filtered]
			const trimmed = typeof limit === 'number' ? merged.slice(0, limit) : merged

			// Calculate unreadCount change:
			// - If new notification is unread and old one wasn't (or didn't exist), increment
			// - If new notification is read and old one was unread, decrement
			// - Otherwise, no change
			let unreadCountChange = 0
			if (!notification.read && !wasExistingUnread) {
				// New unread notification (old one was read or didn't exist)
				unreadCountChange = 1
			} else if (notification.read && wasExistingUnread) {
				// New read notification (old one was unread)
				unreadCountChange = -1
			}
			// If both are unread or both are read, no change needed

			return {
				notifications: trimmed,
				unreadCount: Math.max(0, current.unreadCount + unreadCountChange),
			}
		})
	})

	eventSource.addEventListener('notification:read', (e) => {
		const event = JSON.parse(e.data) as { data: { allRead?: boolean; notification?: Notification } }
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

export function useRealtimeSSE(options: UseRealtimeSSEOptions = defaultOptions) {
	const queryClient = useQueryClient()
	const setSSEConnected = useUIStore((state) => state.setSSEConnected)
	const addMentionNotification = useUIStore((state) => state.addMentionNotification)
	const [isConnected, setIsConnected] = useState(false)
	const eventSourceRef = useRef<EventSource | null>(null)

	useEffect(() => {
		// Create SSE connection
		const url = options.userId ? `/api/stream?userId=${options.userId}` : '/api/stream'

		const eventSource = new EventSource(url, {
			withCredentials: true,
		})

		eventSourceRef.current = eventSource

		setupEventListeners(
			eventSource,
			queryClient,
			queryKeys,
			setSSEConnected,
			setIsConnected,
			options,
			addMentionNotification
		)

		eventSource.onerror = (error) => {
			logger.error('SSE error:', error)
			setIsConnected(false)
			setSSEConnected(false)
			options.onDisconnect?.()
		}

		return () => {
			eventSource.close()
			setIsConnected(false)
			setSSEConnected(false)
		}
	}, [options, queryClient, setSSEConnected, addMentionNotification])

	return {
		isConnected,
		disconnect: () => {
			eventSourceRef.current?.close()
			setIsConnected(false)
		},
	}
}
