import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Navbar } from '../components/Navbar'
import { useAuth } from '../contexts/AuthContext'
import { useUIStore } from '../stores'
import {
    useMarkAllNotificationsRead,
    useMarkNotificationRead,
    useNotificationSummary,
    useNotifications,
} from '../hooks/queries'
import { formatRelativeTime, getNotificationMeta, isNotificationUnread } from '../lib/notifications'
import type { Notification, NotificationType } from '../types'

const FILTERS: Array<{ label: string; value: NotificationType | 'all' }> = [
    { label: 'All', value: 'all' },
    { label: 'Likes', value: 'like' },
    { label: 'Comments', value: 'comment' },
    { label: 'Mentions', value: 'mention' },
    { label: 'Follows', value: 'follow' },
    { label: 'Events', value: 'event_update' },
]

export function NotificationsPage() {
    const { user, logout } = useAuth()
    const { sseConnected } = useUIStore()
    const [filter, setFilter] = useState<NotificationType | 'all'>('all')
    const notifications = useNotifications(
        { limit: 50, type: filter },
        {
            enabled: Boolean(user?.id),
        }
    )
    const summary = useNotificationSummary({ enabled: Boolean(user?.id) })
    const markRead = useMarkNotificationRead()
    const markAllRead = useMarkAllNotificationsRead()

    if (!user) {
        return (
            <div className="min-h-screen bg-gray-100">
                <Navbar isConnected={sseConnected} user={null} onLogout={logout} />
                <div className="max-w-3xl mx-auto px-4 py-16 text-center">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Notifications</h1>
                    <p className="text-gray-600">
                        Sign in to view your notifications.
                    </p>
                    <Link to="/login" className="btn btn-primary mt-6 inline-flex items-center justify-center">
                        Go to Login
                    </Link>
                </div>
            </div>
        )
    }

    const unreadCount = summary.data?.unreadCount ?? 0
    const list = notifications.data?.notifications ?? []

    return (
        <div className="min-h-screen bg-gray-100">
            <Navbar isConnected={sseConnected} user={user} onLogout={logout} />
            <div className="max-w-4xl mx-auto px-4 py-10">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
                        <p className="text-gray-600 mt-1">
                            Stay up to date with likes, comments, mentions, and follows.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => markAllRead.mutate()}
                        disabled={unreadCount === 0 || markAllRead.isPending}
                        className="btn btn-secondary disabled:opacity-60"
                    >
                        Mark all read ({unreadCount})
                    </button>
                </div>

                <div className="flex flex-wrap gap-2 mb-6">
                    {FILTERS.map((item) => (
                        <button
                            key={item.value}
                            type="button"
                            onClick={() => setFilter(item.value)}
                            className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                                filter === item.value
                                    ? 'bg-blue-600 border-blue-600 text-white'
                                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                    {notifications.isLoading && (
                        <div className="py-16 flex items-center justify-center text-gray-500">Loading notifications…</div>
                    )}

                    {notifications.isError && (
                        <div className="py-16 px-6 text-center text-red-600">
                            Unable to load notifications right now.
                        </div>
                    )}

                    {!notifications.isLoading && !notifications.isError && list.length === 0 && (
                        <div className="py-16 px-6 text-center text-gray-500">
                            No notifications yet. Engage with the community to get updates.
                        </div>
                    )}

                    {!notifications.isLoading && !notifications.isError && list.length > 0 && (
                        <ul className="divide-y divide-gray-100">
                            {list.map((notification) => (
                                <NotificationRow
                                    key={notification.id}
                                    notification={notification}
                                    onMarkRead={() => markRead.mutate(notification.id)}
                                />
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    )
}

function NotificationRow({ notification, onMarkRead }: { notification: Notification; onMarkRead: () => void }) {
    const meta = getNotificationMeta(notification.type)
    const unread = isNotificationUnread(notification)

    return (
        <li className={`p-4 sm:p-5 ${unread ? 'bg-blue-50/40' : ''}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <div className={`flex h-12 w-12 items-center justify-center rounded-full text-lg ${meta.badgeClass}`}>
                    <span>{meta.icon}</span>
                </div>
                <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-gray-900">{notification.title}</p>
                        <span className="text-xs text-gray-500">{formatRelativeTime(notification.createdAt)}</span>
                    </div>
                    <p className="text-sm text-gray-700">{notification.body}</p>
                    {notification.actor?.username && (
                        <p className={`text-sm ${meta.accentClass}`}>@{notification.actor.username}</p>
                    )}
                    <div className="flex flex-wrap gap-3 pt-2">
                        {unread && (
                            <button
                                type="button"
                                onClick={onMarkRead}
                                className="text-sm font-medium text-blue-600 hover:text-blue-700"
                            >
                                Mark as read
                            </button>
                        )}
                        {notification.link && (
                            /^https?:\/\//.test(notification.link) ? (
                                <a
                                    href={notification.link}
                                    className="text-sm font-medium text-gray-700 hover:text-gray-900"
                                >
                                    View details
                                </a>
                            ) : (
                                <Link
                                    to={notification.link}
                                    className="text-sm font-medium text-gray-700 hover:text-gray-900"
                                >
                                    View details
                                </Link>
                            )
                        )}
                    </div>
                </div>
                {unread && <span className="h-3 w-3 rounded-full bg-blue-500" aria-hidden="true" />}
            </div>
        </li>
    )
}
