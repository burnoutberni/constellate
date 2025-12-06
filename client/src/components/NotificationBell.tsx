import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotificationSummary, useNotifications } from '../hooks/queries'
import { formatRelativeTime, getNotificationMeta, isNotificationUnread } from '../lib/notifications'
import type { Notification } from '../types'

interface NotificationBellProps {
    user?: { id?: string | null } | null
}

export function NotificationBell({ user }: NotificationBellProps) {
    const [open, setOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const summary = useNotificationSummary({ enabled: Boolean(user?.id) })
    const notifications = useNotifications(
        { limit: 8 },
        {
            enabled: open && Boolean(user?.id),
        }
    )
    const markRead = useMarkNotificationRead()
    const markAllRead = useMarkAllNotificationsRead()

    useEffect(() => {
        if (!open) return

        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setOpen(false)
            }
        }

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        document.addEventListener('keydown', handleEscape)

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('keydown', handleEscape)
        }
    }, [open])

    if (!user?.id) {
        return null
    }

    const unreadCount = summary.data?.unreadCount ?? 0
    const list = notifications.data?.notifications ?? []
    const dropdownState = (() => {
        if (notifications.isLoading) return 'loading'
        if (notifications.isError) return 'error'
        if (list.length === 0) return 'empty'
        return 'ready'
    })()

    const handleNotificationClick = (notification: Notification) => {
        if (isNotificationUnread(notification)) {
            markRead.mutate(notification.id)
        }
        setOpen(false)
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                className="relative flex items-center justify-center h-9 w-9 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Notifications"
                aria-expanded={open}
            >
                <BellIcon className="h-5 w-5 text-gray-600" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[20px] px-1.5 py-0.5 rounded-full bg-red-600 text-white text-xs font-semibold text-center">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 mt-3 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 z-50">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-900">Notifications</span>
                        <button
                            type="button"
                            onClick={() => markAllRead.mutate()}
                            disabled={unreadCount === 0 || markAllRead.isPending}
                            className="text-xs font-medium text-blue-600 disabled:text-gray-400 disabled:cursor-not-allowed"
                        >
                            Mark all read
                        </button>
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                        {dropdownState === 'loading' && (
                            <div className="py-8 flex items-center justify-center text-sm text-gray-500">Loading…</div>
                        )}
                        {dropdownState === 'error' && (
                            <div className="py-8 px-4 text-sm text-red-600">Unable to load notifications.</div>
                        )}
                        {dropdownState === 'empty' && (
                            <div className="py-8 px-4 text-sm text-gray-500 text-center">
                                You're all caught up!
                            </div>
                        )}
                        {dropdownState === 'ready' && (
                            <ul className="divide-y divide-gray-100">
                                {list.map((notification) => (
                                    <li key={notification.id}>
                                        <NotificationListItem
                                            notification={notification}
                                            onClick={() => handleNotificationClick(notification)}
                                        />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="px-4 py-3 border-t border-gray-100 text-center">
                        <Link
                            to="/notifications"
                            className="text-sm font-medium text-blue-600 hover:text-blue-700"
                            onClick={() => setOpen(false)}
                        >
                            View all notifications
                        </Link>
                    </div>
                </div>
            )}
        </div>
    )
}

function NotificationListItem({ notification, onClick }: { notification: Notification; onClick: () => void }) {
    const meta = getNotificationMeta(notification.type)
    const unread = isNotificationUnread(notification)

    const content = (
        <div className="flex items-start gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm ${meta.badgeClass}`}>
                <span>{meta.icon}</span>
            </div>
            <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm font-semibold ${unread ? 'text-gray-900' : 'text-gray-700'}`}>
                        {notification.title}
                    </p>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                        {formatRelativeTime(notification.createdAt)}
                    </span>
                </div>
                <p className="text-sm text-gray-600 mt-0.5">{notification.body}</p>
                {notification.actor?.username && (
                    <p className={`text-xs mt-1 ${meta.accentClass}`}>@{notification.actor.username}</p>
                )}
            </div>
            {unread && <span className="mt-1 h-2 w-2 rounded-full bg-blue-500" aria-hidden="true" />}
        </div>
    )

    if (notification.link) {
        const isExternal = /^https?:\/\//.test(notification.link)
        if (isExternal) {
            return (
                <a
                    href={notification.link}
                    onClick={onClick}
                    className={`block px-4 py-3 hover:bg-gray-50 ${unread ? 'bg-blue-50/40' : ''}`}
                >
                    {content}
                </a>
            )
        }
        return (
            <Link
                to={notification.link}
                onClick={onClick}
                className={`block px-4 py-3 hover:bg-gray-50 ${unread ? 'bg-blue-50/40' : ''}`}
            >
                {content}
            </Link>
        )
    }

    return (
        <button
            type="button"
            onClick={onClick}
            className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${unread ? 'bg-blue-50/40' : ''}`}
        >
            {content}
        </button>
    )
}

function BellIcon({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
    )
}
