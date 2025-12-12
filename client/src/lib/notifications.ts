import type { NotificationType } from '@/types'

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
        badgeClass: 'bg-info-100 text-info-700',
        iconClass: 'bg-info-50 text-info-600',
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
        badgeClass: 'bg-neutral-100 text-neutral-700',
        iconClass: 'bg-neutral-50 text-neutral-600',
    },
}

const fallbackMeta: NotificationTypeMeta = {
    label: 'Notification',
    icon: '🔔',
    badgeClass: 'bg-neutral-100 text-neutral-700',
    iconClass: 'bg-neutral-50 text-neutral-600',
}

export function getNotificationTypeMeta(type: NotificationType | string | undefined) {
    if (!type) {
        return fallbackMeta
    }
    return typeMeta[type as NotificationType] ?? fallbackMeta
}
