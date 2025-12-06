import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from './keys'
import type { Notification } from '../../types'

export interface NotificationsResponse {
    notifications: Notification[]
    unreadCount: number
}

const clampLimit = (limit: number) => Math.max(1, Math.min(limit, 100))

export function useNotifications(limit = 20, options?: { enabled?: boolean }) {
    const enabled = options?.enabled ?? true
    const safeLimit = clampLimit(limit)

    return useQuery<NotificationsResponse>({
        queryKey: queryKeys.notifications.list(safeLimit),
        queryFn: async () => {
            const response = await fetch(`/api/notifications?limit=${safeLimit}`, {
                credentials: 'include',
            })

            if (!response.ok) {
                throw new Error('Failed to fetch notifications')
            }

            return response.json()
        },
        enabled,
        staleTime: 1000 * 30,
    })
}

export function useMarkNotificationRead() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (notificationId: string) => {
            const response = await fetch(`/api/notifications/${notificationId}/read`, {
                method: 'POST',
                credentials: 'include',
            })

            if (!response.ok) {
                throw new Error('Failed to mark notification as read')
            }

            return response.json() as Promise<{ notification: Notification }>
        },
        onSuccess: ({ notification }) => {
            const queries = queryClient.getQueriesData<NotificationsResponse>({
                queryKey: queryKeys.notifications.all(),
            })

            queries.forEach(([queryKey, data]) => {
                if (!data) {
                    return
                }

                const wasUnread = data.notifications.some((item) => item.id === notification.id && !item.read)
                const updatedNotifications = data.notifications.map((item) =>
                    item.id === notification.id ? notification : item
                )

                queryClient.setQueryData(queryKey, {
                    notifications: updatedNotifications,
                    unreadCount: wasUnread ? Math.max(0, data.unreadCount - 1) : data.unreadCount,
                })
            })
        },
    })
}

export function useMarkAllNotificationsRead() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async () => {
            const response = await fetch('/api/notifications/mark-all-read', {
                method: 'POST',
                credentials: 'include',
            })

            if (!response.ok) {
                throw new Error('Failed to mark notifications as read')
            }

            return response.json() as Promise<{ updated: number; unreadCount: number }>
        },
        onSuccess: () => {
            const queries = queryClient.getQueriesData<NotificationsResponse>({
                queryKey: queryKeys.notifications.all(),
            })

            queries.forEach(([queryKey, data]) => {
                if (!data) {
                    return
                }

                const updatedNotifications = data.notifications.map((notification) => ({
                    ...notification,
                    read: true,
                    readAt: notification.readAt ?? new Date().toISOString(),
                }))

                queryClient.setQueryData(queryKey, {
                    notifications: updatedNotifications,
                    unreadCount: 0,
                })
            })
        },
    })
}

