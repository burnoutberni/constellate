export type NotificationType =
    | 'like'
    | 'comment'
    | 'mention'
    | 'follow'
    | 'event_update'
    | 'attendance'
    | 'system'
    | 'announcement'

export interface NotificationActor {
    id: string
    username?: string | null
    name?: string | null
    avatarUrl?: string | null
}

export interface Notification {
    id: string
    type: NotificationType
    title: string
    body: string
    createdAt: string
    readAt?: string | null
    isRead?: boolean
    link?: string | null
    actor?: NotificationActor | null
    data?: Record<string, unknown>
}
