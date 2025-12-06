import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from './keys'
import type { Notification, NotificationType } from '../../types'

export interface NotificationListParams {
    limit?: number
    type?: NotificationType | 'all'
    includeRead?: boolean
}

interface NotificationsResponse {
    notifications: Notification[]
    unreadCount: number
    nextCursor?: string | null
}

interface NotificationSummaryResponse {
    unreadCount: number
    lastNotificationAt?: string | null
}

export function useNotifications(params: NotificationListParams = {}, options?: { enabled?: boolean }) {
    const { limit = 25, type = 'all', includeRead = true } = params

    const queryParams = new URLSearchParams()
    queryParams.set('limit', String(limit))
    if (type && type !== 'all') {
        queryParams.set('type', type)
    }
    if (!includeRead) {
        queryParams.set('includeRead', 'false')
    }

    return useQuery<NotificationsResponse>({
        queryKey: queryKeys.notifications.list({ limit, type, includeRead }),
        queryFn: async () => {
            const response = await fetch(`/api/notifications?${queryParams.toString()}`, {
                credentials: 'include',
            })

            if (!response.ok) {
                throw new Error('Failed to fetch notifications')
            }

            return response.json()
        },
        enabled: options?.enabled ?? true,
    })
}

export function useNotificationSummary(options?: { enabled?: boolean }) {
    return useQuery<NotificationSummaryResponse>({
        queryKey: queryKeys.notifications.summary(),
        queryFn: async () => {
            const response = await fetch('/api/notifications/summary', {
                credentials: 'include',
            })

            if (!response.ok) {
                throw new Error('Failed to fetch notification summary')
            }

            return response.json()
        },
        enabled: options?.enabled ?? true,
        staleTime: 1000 * 60, // 1 minute
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
                const error = await response.json().catch(() => ({ error: 'Failed to mark notification read' }))
                throw new Error(error.error || 'Failed to mark notification read')
            }

            return response.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.notifications.lists() })
            queryClient.invalidateQueries({ queryKey: queryKeys.notifications.summary() })
        },
    })
}

export function useMarkAllNotificationsRead() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async () => {
            const response = await fetch('/api/notifications/read-all', {
                method: 'POST',
                credentials: 'include',
            })

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Failed to mark notifications read' }))
                throw new Error(error.error || 'Failed to mark notifications read')
            }

            return response.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.notifications.lists() })
            queryClient.invalidateQueries({ queryKey: queryKeys.notifications.summary() })
        },
    })
}
