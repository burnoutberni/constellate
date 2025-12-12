import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from './keys'
import type { Notification } from '@/types'
import { api } from '@/lib/api-client'
import { useMutationErrorHandler } from '@/hooks/useErrorHandler'

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
        queryFn: () => api.get<NotificationsResponse>('/notifications', { limit: safeLimit }, undefined, 'Failed to fetch notifications'),
        enabled,
        staleTime: 1000 * 30,
    })
}

export function useMarkNotificationRead() {
    const queryClient = useQueryClient()
    const handleMutationError = useMutationErrorHandler()

    return useMutation({
        mutationFn: (notificationId: string) => api.post<{ notification: Notification }>(`/notifications/${notificationId}/read`, undefined, undefined, 'Failed to mark notification as read'),
        onError: (error) => {
            handleMutationError(error, 'Failed to mark notification as read')
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
                    item.id === notification.id ? notification : item,
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
    const handleMutationError = useMutationErrorHandler()

    return useMutation({
        mutationFn: () => api.post<{ updated: number; unreadCount: number }>('/notifications/mark-all-read', undefined, undefined, 'Failed to mark notifications as read'),
        onError: (error) => {
            handleMutationError(error, 'Failed to mark notifications as read')
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
