import type { Notification, NotificationType } from '../types'

type NotificationMeta = {
    icon: string
    label: string
    badgeClass: string
    accentClass: string
}

const typeMeta: Record<NotificationType | 'default', NotificationMeta> = {
    like: {
        icon: '❤️',
        label: 'New like',
        badgeClass: 'bg-pink-100 text-pink-700',
        accentClass: 'text-pink-600',
    },
    comment: {
        icon: '💬',
        label: 'New comment',
        badgeClass: 'bg-indigo-100 text-indigo-700',
        accentClass: 'text-indigo-600',
    },
    mention: {
        icon: '@',
        label: 'Mention',
        badgeClass: 'bg-blue-100 text-blue-700',
        accentClass: 'text-blue-600',
    },
    follow: {
        icon: '➕',
        label: 'New follower',
        badgeClass: 'bg-green-100 text-green-700',
        accentClass: 'text-green-600',
    },
    event_update: {
        icon: '📅',
        label: 'Event update',
        badgeClass: 'bg-yellow-100 text-yellow-700',
        accentClass: 'text-yellow-600',
    },
    attendance: {
        icon: '🎟️',
        label: 'Attendance',
        badgeClass: 'bg-purple-100 text-purple-700',
        accentClass: 'text-purple-600',
    },
    system: {
        icon: '⚙️',
        label: 'System',
        badgeClass: 'bg-gray-100 text-gray-700',
        accentClass: 'text-gray-600',
    },
    announcement: {
        icon: '📣',
        label: 'Announcement',
        badgeClass: 'bg-orange-100 text-orange-700',
        accentClass: 'text-orange-600',
    },
    default: {
        icon: '🔔',
        label: 'Notification',
        badgeClass: 'bg-blue-100 text-blue-700',
        accentClass: 'text-blue-600',
    },
}

export function getNotificationMeta(type?: NotificationType | null): NotificationMeta {
    if (!type) {
        return typeMeta.default
    }
    return typeMeta[type] ?? typeMeta.default
}

const relativeTimeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
const timeUnits: Array<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
    { unit: 'day', ms: 1000 * 60 * 60 * 24 },
    { unit: 'hour', ms: 1000 * 60 * 60 },
    { unit: 'minute', ms: 1000 * 60 },
]

export function formatRelativeTime(timestamp: string): string {
    const date = new Date(timestamp)
    if (Number.isNaN(date.getTime())) {
        return ''
    }

    const diff = date.getTime() - Date.now()
    for (const { unit, ms } of timeUnits) {
        if (Math.abs(diff) >= ms || unit === 'minute') {
            const value = Math.round(diff / ms)
            return relativeTimeFormatter.format(value, unit)
        }
    }
    return ''
}

export function isNotificationUnread(notification: Notification): boolean {
    if (typeof notification.isRead === 'boolean') {
        return !notification.isRead
    }
    return !notification.readAt
}
