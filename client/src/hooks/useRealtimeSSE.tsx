/**
 * Global SSE connection hook that integrates with TanStack Query
 * Single instance manages all real-time updates and cache invalidation
 */

import { useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query'
import { useEffect, useState, useRef } from 'react'
import { z } from 'zod'

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
		const value: unknown = queryKey[2]
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



const SetupEventListenersSchema = {
	eventUpdated: z.object({
		data: z.object({
			event: z.object({
				id: z.string(),
				user: z.object({ username: z.string() }).optional(),
			}).passthrough(),
		}),
	}),
	eventDeleted: z.object({
		data: z.object({
			eventId: z.string().optional(),
			externalId: z.string().optional(),
			username: z.string().optional(),
		}),
	}),
	attendance: z.object({
		data: z.object({
			eventId: z.string(),
		}),
	}),
	likeAdded: z.object({
		data: z.object({
			eventId: z.string(),
			like: z.object({
				user: z.object({
					id: z.string(),
					username: z.string(),
					name: z.string().optional().nullable(),
					profileImage: z.string().nullable().optional(),
					displayColor: z.string().optional(),
					isRemote: z.boolean().optional(),
				})
			}),
		}),
	}),
	likeRemoved: z.object({
		data: z.object({
			eventId: z.string(),
			userId: z.string(),
		}),
	}),
	// User started following someone (local or remote)
	followAdded: z.object({
		data: z.object({
			username: z.string(),
			actorUrl: z.string().optional(),
			isAccepted: z.boolean().optional(),
		}),
	}),
	// User unfollowed someone
	followRemoved: z.object({
		data: z.object({
			username: z.string(),
		}),
	}),
	followAccepted: z.object({
		data: z.object({
			username: z.string(),
			actorUrl: z.string().optional(),
			isAccepted: z.boolean(),
			followerCount: z.number().nullable().optional(),
		}),
	}),
	followPending: z.object({
		data: z.object({
			username: z.string(),
			actorUrl: z.string().optional(),
			isAccepted: z.boolean(),
		}),
	}),
	followRejected: z.object({
		data: z.object({
			username: z.string(),
		}),
	}),
	// Someone followed the user
	followerAdded: z.object({
		data: z.object({
			username: z.string(),
			follower: z.object({
				username: z.string(),
				actorUrl: z.string(),
				accepted: z.boolean().optional(),
			}),
			followerCount: z.number().optional(),
		}),
	}),
	followerRemoved: z.object({
		data: z.object({
			username: z.string(),
			follower: z.object({
				username: z.string(),
				actorUrl: z.string(),
			}).optional(), // Sometimes might just have ID or username depending on logic
			followerCount: z.number().optional(),
		}),
	}),
	commentAdded: z.object({
		data: z.object({
			eventId: z.string(),
			comment: z.object({
				id: z.string(),
				content: z.string(),
				createdAt: z.string().optional(),
				author: z.object({
					id: z.string(),
					username: z.string(),
					name: z.string().nullable().optional(),
					profileImage: z.string().nullable().optional(),
				}).optional()
			}).passthrough(),
		}),
	}),
	commentDeleted: z.object({
		data: z.object({
			eventId: z.string(),
			commentId: z.string(),
		}),
	}),
	// Removed incorrect follower schema

	profileUpdated: z.object({
		data: z.object({
			username: z.string(),
		}),
	}),

	mention: z.object({
		data: z.object({
			commentId: z.string().optional(),
			commentContent: z.string().optional(),
			eventId: z.string().optional(),
			eventTitle: z.string().optional(),
			eventOwnerHandle: z.string().optional(),
			handle: z.string().optional(),
			author: z
				.object({
					id: z.string().optional(),
					username: z.string().optional(),
					name: z.string().optional(),
				})
				.optional(),
			createdAt: z.string().optional(),
		}),
		timestamp: z.string().optional(),
	}),
	notification: z.object({
		data: z.object({
			notification: z.custom<Notification>((val: unknown) =>
				val !== null && typeof val === 'object' && 'id' in val && typeof (val as Record<string, unknown>).id === 'string'
			),
		}),
	}),
	notificationRead: z.object({
		data: z.object({
			allRead: z.boolean().optional(),
			notification: z.custom<Notification>((val: unknown) =>
				val !== null && typeof val === 'object' && 'id' in val && typeof (val as Record<string, unknown>).id === 'string'
			).optional(),
		}),
	}),
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
		try {
			const { data } = SetupEventListenersSchema.eventUpdated.parse(JSON.parse(e.data))
			const updatedEvent = data.event

			if (updatedEvent.user?.username && updatedEvent.id) {
				queryClient.setQueryData(
					queryKeysParam.events.detail(updatedEvent.user.username, updatedEvent.id),
					(oldData: EventDetail | undefined) =>
						(oldData ? { ...oldData, ...updatedEvent } : updatedEvent) as unknown as EventDetail
				)
			}
			queryClient.invalidateQueries({ queryKey: queryKeysParam.events.lists() })
		} catch (error) {
			logger.error('Failed to parse event:updated SSE data', { error: error as unknown, data: e.data as unknown })
		}
	})

	eventSource.addEventListener('event:deleted', (e) => {
		try {
			const { data } = SetupEventListenersSchema.eventDeleted.parse(JSON.parse(e.data))
			const eventId = data.eventId || data.externalId

			if (data.username && eventId) {
				queryClient.removeQueries({
					queryKey: queryKeysParam.events.detail(data.username, eventId),
				})
			}
			queryClient.invalidateQueries({ queryKey: queryKeysParam.events.lists() })
		} catch (error) {
			logger.error('Failed to parse event:deleted SSE data', { error: error as unknown, data: e.data as unknown })
		}
	})

	eventSource.addEventListener('attendance:added', (e) => {
		try {
			const { data } = SetupEventListenersSchema.attendance.parse(JSON.parse(e.data))
			if (data.eventId) {
				queryClient.invalidateQueries({
					queryKey: queryKeysParam.events.details(),
				})
			}
		} catch (error) {
			logger.error('Failed to parse attendance:added SSE data', { error: error as unknown, data: e.data as unknown })
		}
	})

	eventSource.addEventListener('attendance:updated', (e) => {
		try {
			const { data } = SetupEventListenersSchema.attendance.parse(JSON.parse(e.data))
			if (data.eventId) {
				queryClient.invalidateQueries({
					queryKey: queryKeysParam.events.details(),
				})
			}
		} catch (error) {
			logger.error('Failed to parse attendance:updated SSE data', { error: error as unknown, data: e.data as unknown })
		}
	})

	eventSource.addEventListener('attendance:removed', (e) => {
		try {
			const { data: eventData } = SetupEventListenersSchema.attendance.parse(JSON.parse(e.data))
			if (!eventData.eventId) { return }

			const eventQueries = queryClient.getQueriesData({
				queryKey: queryKeysParam.events.details(),
			})
			for (const [queryKey, data] of eventQueries) {
				if (
					data &&
					typeof data === 'object' &&
					'id' in data &&
					data.id === eventData.eventId
				) {
					queryClient.invalidateQueries({ queryKey })
				}
			}
		} catch (error) {
			logger.error('Failed to parse attendance:removed SSE data', { error: error as unknown, data: e.data as unknown })
		}
	})

	eventSource.addEventListener('like:added', (e) => {
		try {
			const { data } = SetupEventListenersSchema.likeAdded.parse(JSON.parse(e.data))
			if (!data.eventId || !data.like) { return }

			const eventQueries = queryClient.getQueriesData({
				queryKey: queryKeysParam.events.details(),
			})
			const newLike = data.like as { user: EventUser }
			for (const [queryKey, queryData] of eventQueries) {
				updateLikeInCache(queryKey, queryData, data.eventId, newLike, queryClient)
			}
		} catch (error) {
			logger.error('Failed to parse like:added SSE data', { error: error as unknown, data: e.data as unknown })
		}
	})

	eventSource.addEventListener('like:removed', (e) => {
		try {
			const { data } = SetupEventListenersSchema.likeRemoved.parse(JSON.parse(e.data))
			if (!data.eventId || !data.userId) { return }

			const eventQueries = queryClient.getQueriesData({
				queryKey: queryKeysParam.events.details(),
			})
			for (const [queryKey, queryData] of eventQueries) {
				removeLikeFromCache(queryKey, queryData, data.eventId, data.userId, queryClient)
			}
		} catch (error) {
			logger.error('Failed to parse like:removed SSE data', { error: error as unknown, data: e.data as unknown })
		}
	})

	eventSource.addEventListener('comment:added', (e) => {
		try {
			const { data } = SetupEventListenersSchema.commentAdded.parse(JSON.parse(e.data))
			if (!data.eventId || !data.comment) { return }

			const eventQueries = queryClient.getQueriesData({
				queryKey: queryKeysParam.events.details(),
			})
			for (const [queryKey, queryData] of eventQueries) {
				addCommentToCache(queryKey, queryData, data.eventId, data.comment, queryClient)
			}
		} catch (error) {
			logger.error('Failed to parse comment:added SSE data', { error: error as unknown, data: e.data as unknown })
		}
	})

	eventSource.addEventListener('comment:deleted', (e) => {
		try {
			const { data } = SetupEventListenersSchema.commentDeleted.parse(JSON.parse(e.data))
			if (!data.eventId || !data.commentId) { return }

			const eventQueries = queryClient.getQueriesData({
				queryKey: queryKeysParam.events.details(),
			})
			for (const [queryKey, queryData] of eventQueries) {
				removeCommentFromCache(
					queryKey,
					queryData,
					data.eventId,
					data.commentId,
					queryClient
				)
			}
		} catch (error) {
			logger.error('Failed to parse comment:deleted SSE data', { error: error as unknown, data: e.data as unknown })
		}
	})

	eventSource.addEventListener('profile:updated', (e) => {
		try {
			const { data } = SetupEventListenersSchema.profileUpdated.parse(JSON.parse(e.data))
			if (data.username) {
				queryClient.invalidateQueries({
					queryKey: queryKeysParam.users.profile(data.username),
				})
			}
		} catch (error) {
			logger.error('Failed to parse profile:updated SSE data', { error: error as unknown, data: e.data as unknown })
		}
	})

	eventSource.addEventListener('follow:added', (e) => {
		try {
			const { data } = SetupEventListenersSchema.followAdded.parse(JSON.parse(e.data))
			if (data.username) {
				queryClient.invalidateQueries({
					queryKey: queryKeysParam.users.profile(data.username),
				})
				queryClient.invalidateQueries({
					queryKey: queryKeysParam.users.followStatus(data.username),
				})
			}
		} catch (error) {
			logger.error('Failed to parse follow:added SSE data', { error: error as unknown, data: e.data as unknown })
		}
	})

	eventSource.addEventListener('follower:added', (e) => {
		try {
			const { data } = SetupEventListenersSchema.followerAdded.parse(JSON.parse(e.data))
			if (data.username) {
				if (data.followerCount !== null && data.followerCount !== undefined) {
					const profileData = queryClient.getQueryData(
						queryKeysParam.users.profile(data.username)
					) as
						| { user: { _count: { followers: number; following: number; events: number } } }
						| undefined
					if (profileData) {
						queryClient.setQueryData(queryKeysParam.users.profile(data.username), {
							...profileData,
							user: {
								...profileData.user,
								_count: {
									...profileData.user._count,
									followers: data.followerCount,
								},
							},
						})
					} else {
						queryClient.invalidateQueries({
							queryKey: queryKeysParam.users.profile(data.username),
						})
					}
				} else {
					queryClient.invalidateQueries({
						queryKey: queryKeysParam.users.profile(data.username),
					})
				}
			}
		} catch (error) {
			logger.error('Failed to parse follower:added SSE data', { error: error as unknown, data: e.data as unknown })
		}
	})

	eventSource.addEventListener('follower:removed', (e) => {
		try {
			const { data } = SetupEventListenersSchema.followerRemoved.parse(JSON.parse(e.data))
			if (data.username) {
				if (data.followerCount !== null && data.followerCount !== undefined) {
					const profileData = queryClient.getQueryData(
						queryKeysParam.users.profile(data.username)
					) as
						| { user: { _count: { followers: number; following: number; events: number } } }
						| undefined
					if (profileData) {
						queryClient.setQueryData(queryKeysParam.users.profile(data.username), {
							...profileData,
							user: {
								...profileData.user,
								_count: {
									...profileData.user._count,
									followers: data.followerCount,
								},
							},
						})
					} else {
						queryClient.invalidateQueries({
							queryKey: queryKeysParam.users.profile(data.username),
						})
					}
				} else {
					queryClient.invalidateQueries({
						queryKey: queryKeysParam.users.profile(data.username),
					})
				}
			}
		} catch (error) {
			logger.error('Failed to parse follower:removed SSE data', { error: error as unknown, data: e.data as unknown })
		}
	})

	eventSource.addEventListener('follow:removed', (e) => {
		try {
			const { data } = SetupEventListenersSchema.followRemoved.parse(JSON.parse(e.data))
			if (data.username) {
				queryClient.setQueryData(queryKeysParam.users.followStatus(data.username), {
					isFollowing: false,
					isAccepted: false,
				})
				queryClient.invalidateQueries({
					queryKey: queryKeysParam.users.profile(data.username),
				})
			}
		} catch (error) {
			logger.error('Failed to parse follow:removed SSE data', { error: error as unknown, data: e.data as unknown })
		}
	})

	eventSource.addEventListener('follow:pending', (e) => {
		try {
			const { data } = SetupEventListenersSchema.followPending.parse(JSON.parse(e.data))
			if (data.username) {
				queryClient.setQueryData(queryKeysParam.users.followStatus(data.username), {
					isFollowing: true,
					isAccepted: false,
				})
			}
		} catch (error) {
			logger.error('Failed to parse follow:pending SSE data', { error: error as unknown, data: e.data as unknown })
		}
	})

	eventSource.addEventListener('follow:accepted', (e) => {
		try {
			const { data } = SetupEventListenersSchema.followAccepted.parse(JSON.parse(e.data))
			if (data.username) {
				queryClient.setQueryData(queryKeysParam.users.followStatus(data.username), {
					isFollowing: true,
					isAccepted: true,
				})
				if (data.followerCount !== null && data.followerCount !== undefined) {
					const profileData = queryClient.getQueryData(
						queryKeysParam.users.profile(data.username)
					) as
						| { user: { _count: { followers: number; following: number; events: number } } }
						| undefined
					if (profileData) {
						queryClient.setQueryData(queryKeysParam.users.profile(data.username), {
							...profileData,
							user: {
								...profileData.user,
								_count: {
									...profileData.user._count,
									followers: data.followerCount,
								},
							},
						})
					} else {
						queryClient.invalidateQueries({
							queryKey: queryKeysParam.users.profile(data.username),
						})
					}
				} else {
					queryClient.invalidateQueries({
						queryKey: queryKeysParam.users.profile(data.username),
					})
				}
			}
		} catch (error) {
			logger.error('Failed to parse follow:accepted SSE data', { error: error as unknown, data: e.data as unknown })
		}
	})

	eventSource.addEventListener('follow:rejected', (e) => {
		try {
			const { data } = SetupEventListenersSchema.followRejected.parse(JSON.parse(e.data))
			if (data.username) {
				queryClient.setQueryData(queryKeysParam.users.followStatus(data.username), {
					isFollowing: false,
					isAccepted: false,
				})
				queryClient.invalidateQueries({
					queryKey: queryKeysParam.users.profile(data.username),
				})
			}
		} catch (error) {
			logger.error('Failed to parse follow:rejected SSE data', { error: error as unknown, data: e.data as unknown })
		}
	})

	if (addMentionNotification) {
		eventSource.addEventListener('mention:received', (e) => {
			try {
				const event = SetupEventListenersSchema.mention.parse(JSON.parse(e.data))
				const { data } = event

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
			} catch (error) {
				logger.error('Failed to parse mention:received SSE data', { error: error as unknown, data: e.data as unknown })
			}
		})
	}

	eventSource.addEventListener('notification:created', (e) => {
		try {
			const { data } = SetupEventListenersSchema.notification.parse(JSON.parse(e.data))
			const { notification } = data
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
		} catch (error) {
			logger.error('Failed to parse notification:created SSE data', { error: error as unknown, data: e.data as unknown })
		}
	})

	eventSource.addEventListener('notification:read', (e) => {
		try {
			const { data: payload } = SetupEventListenersSchema.notificationRead.parse(JSON.parse(e.data))

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

			const notification = payload?.notification
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
		} catch (error) {
			logger.error('Failed to parse notification:read SSE data', { error: error as unknown, data: e.data as unknown })
		}
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
