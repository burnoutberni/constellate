import type { NotificationType } from '../types/notification'

interface NotificationTypeMeta {
    label: string
    icon: string
    badgeClass: string
    iconClass: string
}

const typeMeta: Record<NotificationType, NotificationTypeMeta> = {
    FOLLOW: {
        label: 'New follower',
        icon: '👤',
        badgeClass: 'bg-purple-100 text-purple-700',
        iconClass: 'bg-purple-50 text-purple-600',
    },
    COMMENT: {
        label: 'New comment',
        icon: '💬',
        badgeClass: 'bg-emerald-100 text-emerald-700',
        iconClass: 'bg-emerald-50 text-emerald-600',
    },
    LIKE: {
        label: 'New like',
        icon: '❤️',
        badgeClass: 'bg-pink-100 text-pink-700',
        iconClass: 'bg-pink-50 text-pink-600',
    },
    MENTION: {
        label: 'Mention',
        icon: '@',
        badgeClass: 'bg-blue-100 text-blue-700',
        iconClass: 'bg-blue-50 text-blue-600',
    },
    EVENT: {
        label: 'Event update',
        icon: '📅',
        badgeClass: 'bg-amber-100 text-amber-700',
        iconClass: 'bg-amber-50 text-amber-600',
    },
    SYSTEM: {
        label: 'System',
        icon: '🔔',
        badgeClass: 'bg-gray-100 text-gray-700',
        iconClass: 'bg-gray-50 text-gray-600',
    },
}

const fallbackMeta: NotificationTypeMeta = {
    label: 'Notification',
    icon: '🔔',
    badgeClass: 'bg-gray-100 text-gray-700',
    iconClass: 'bg-gray-50 text-gray-600',
}

export function getNotificationTypeMeta(type: NotificationType | string | undefined) {
    if (!type) {
        return fallbackMeta
    }
    return typeMeta[type as NotificationType] ?? fallbackMeta
}

