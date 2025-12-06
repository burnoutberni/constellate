import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Navbar } from '../components/Navbar'
import { useAuth } from '../contexts/AuthContext'
import {
    useNotifications,
    useMarkNotificationRead,
    useMarkAllNotificationsRead,
} from '../hooks/queries/notifications'
import { useUIStore } from '../stores'
import { formatRelativeTime } from '../lib/datetime'
import { getNotificationTypeMeta } from '../lib/notifications'
import type { Notification } from '../types'

export function NotificationsPage() {
    const { user, logout } = useAuth()
    const { sseConnected } = useUIStore()
    const navigate = useNavigate()

    const { data, isLoading, isFetching } = useNotifications(50, { enabled: !!user })
    const { mutate: markNotificationRead } = useMarkNotificationRead()
    const { mutate: markAllNotificationsRead, isPending: markAllPending } = useMarkAllNotificationsRead()

    const notifications = data?.notifications ?? []
    const unreadCount = data?.unreadCount ?? 0

    const sortedNotifications = useMemo(() => {
        return [...notifications].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    }, [notifications])

    const handleOpen = (notification: Notification) => {
        if (!notification.contextUrl) {
            return
        }

        if (!notification.read) {
            markNotificationRead(notification.id)
        }

        if (notification.contextUrl.startsWith('http')) {
            window.location.href = notification.contextUrl
        } else {
            navigate(notification.contextUrl)
        }
    }

    const handleMarkNotificationRead = (notificationId: string) => {
        markNotificationRead(notificationId)
    }

    const renderActorBadge = (notification: Notification) => {
        if (!notification.actor) {
            return null
        }

        const initial =
            notification.actor.name?.[0] ??
            notification.actor.username?.[0] ??
            notification.actor.displayColor?.[0] ??
            '?'

        return (
            <div className="flex items-center gap-2 text-sm text-gray-600">
                <div
                    className="h-8 w-8 rounded-full text-white flex items-center justify-center font-semibold shadow-sm"
                    style={{
                        backgroundColor: notification.actor.displayColor || '#3b82f6',
                    }}
                >
                    {initial.toUpperCase()}
                </div>
                <div className="flex flex-col leading-tight">
                    <span className="font-medium text-gray-900">
                        {notification.actor.name || notification.actor.username || 'Someone'}
                    </span>
                    {notification.actor.username && (
                        <span className="text-xs text-gray-400">@{notification.actor.username}</span>
                    )}
                </div>
            </div>
        )
    }

    const renderNotificationList = () => {
        if (isLoading) {
            return (
                <div className="card p-10 flex items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
                </div>
            )
        }

        if (sortedNotifications.length === 0) {
            return (
                <div className="card p-10 text-center text-gray-500">
                    <p className="text-lg font-semibold text-gray-900 mb-2">You're all caught up!</p>
                    <p>We'll let you know as soon as something new happens.</p>
                </div>
            )
        }

        return sortedNotifications.map((notification) => {
            const meta = getNotificationTypeMeta(notification.type)
            return (
                <div
                    key={notification.id}
                    className={`rounded-2xl border p-5 shadow-sm transition-all ${
                        notification.read ? 'bg-white border-gray-200' : 'bg-blue-50 border-blue-200 shadow-md'
                    }`}
                >
                    <div className="flex flex-col gap-4 md:flex-row">
                        <div
                            className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-2xl ${meta.iconClass}`}
                        >
                            {meta.icon}
                        </div>
                        <div className="flex-1 space-y-3">
                            <div className="flex flex-wrap items-center gap-3">
                                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${meta.badgeClass}`}>
                                    {meta.label}
                                </span>
                                {!notification.read && (
                                    <span className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                                        Unread
                                    </span>
                                )}
                                <span className="text-xs text-gray-500">
                                    {formatRelativeTime(notification.createdAt)}
                                </span>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">{notification.title}</h3>
                                {notification.body && <p className="mt-1 text-gray-700">{notification.body}</p>}
                            </div>
                            {renderActorBadge(notification)}
                            <div className="flex flex-wrap items-center gap-3 pt-2">
                                {!notification.read && (
                                    <button
                                        type="button"
                                        onClick={() => handleMarkNotificationRead(notification.id)}
                                        className="btn btn-ghost text-sm"
                                    >
                                        Mark as read
                                    </button>
                                )}
                                {notification.contextUrl && (
                                    <button
                                        type="button"
                                        onClick={() => handleOpen(notification)}
                                        className="btn btn-primary text-sm"
                                    >
                                        View details
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )
        })
    }

    return (
        <div className="min-h-screen bg-gray-100">
            <Navbar isConnected={sseConnected} user={user} onLogout={logout} />

            <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-sm uppercase tracking-wide text-gray-500">Inbox</p>
                        <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
                        <p className="text-sm text-gray-500">
                            Stay up to date with mentions, follows, comments, and event updates.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="inline-flex items-center rounded-full bg-gray-200 px-3 py-1 text-sm font-medium text-gray-700">
                            {isFetching ? 'Refreshing…' : `${unreadCount} unread`}
                        </span>
                        <button
                            type="button"
                            onClick={() => markAllNotificationsRead()}
                            disabled={unreadCount === 0 || markAllPending}
                            className="btn btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Mark all read
                        </button>
                    </div>
                </div>

                {!user && (
                    <div className="card p-8 text-center">
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">Sign in to view notifications</h2>
                        <p className="text-gray-500 mb-6">
                            Create an account or log in to start receiving updates about your events and connections.
                        </p>
                        <button
                            type="button"
                            onClick={() => navigate('/login')}
                            className="btn btn-primary"
                        >
                            Sign In
                        </button>
                    </div>
                )}

                {user && <div className="space-y-4">{renderNotificationList()}</div>}
            </div>
        </div>
    )
}

