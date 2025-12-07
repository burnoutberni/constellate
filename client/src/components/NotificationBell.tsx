import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    useNotifications,
    useMarkNotificationRead,
    useMarkAllNotificationsRead,
} from '../hooks/queries/notifications'
import { formatRelativeTime } from '../lib/datetime'
import { getNotificationTypeMeta } from '../lib/notifications'
import { safeNavigate } from '../lib/urlValidation'
import type { Notification } from '../types'

interface NotificationBellProps {
    userId?: string
}

const BellIcon = ({ hasUnread }: { hasUnread: boolean }) => (
    <svg
        className="w-6 h-6 text-gray-700"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        {hasUnread ? <circle cx="18" cy="6" r="2" fill="currentColor" /> : null}
    </svg>
)

export function NotificationBell({ userId }: NotificationBellProps) {
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement | null>(null)
    const navigate = useNavigate()
    const { data, isLoading } = useNotifications(10, { enabled: !!userId })
    const { mutate: markNotificationRead } = useMarkNotificationRead()
    const { mutate: markAllNotificationsRead, isPending: markAllPending } = useMarkAllNotificationsRead()

    useEffect(() => {
        if (!isOpen) {
            return undefined
        }

        function handleClick(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                setIsOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClick)
        document.addEventListener('keydown', handleKeyDown)
        return () => {
            document.removeEventListener('mousedown', handleClick)
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [isOpen])

    if (!userId) {
        return null
    }

    const notifications = data?.notifications ?? []
    const unreadCount = data?.unreadCount ?? 0

    const handleNotificationClick = (notification: Notification) => {
        if (!notification.read) {
            markNotificationRead(notification.id)
        }

        if (notification.contextUrl) {
            safeNavigate(notification.contextUrl, navigate)
            setIsOpen(false)
        }
    }

    const renderDropdownContent = () => {
        if (isLoading) {
            return (
                <div className="flex items-center justify-center py-8" role="status" aria-label="Loading notifications" aria-live="polite">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                </div>
            )
        }

        if (notifications.length === 0) {
            return (
                <div className="px-4 py-8 text-center text-sm text-gray-500">
                    Nothing new just yet
                </div>
            )
        }

        return (
            <ul className="divide-y divide-gray-100">
                {notifications.map((notification) => {
                    const meta = getNotificationTypeMeta(notification.type)
                    return (
                        <li key={notification.id}>
                            <button
                                type="button"
                                onClick={() => handleNotificationClick(notification)}
                                aria-label={`View notification: ${notification.title}`}
                                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                                    notification.read ? 'bg-white hover:bg-gray-50' : 'bg-blue-50'
                                }`}
                            >
                                <div
                                    className={`flex h-10 w-10 items-center justify-center rounded-full text-base ${meta.iconClass}`}
                                >
                                    {meta.icon}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-semibold text-gray-900">
                                            {notification.title}
                                        </p>
                                        <span
                                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.badgeClass}`}
                                        >
                                            {meta.label}
                                        </span>
                                    </div>
                                    {notification.body && (
                                        <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                                            {notification.body}
                                        </p>
                                    )}
                                    <p className="mt-1 text-xs text-gray-400">
                                        {formatRelativeTime(notification.createdAt)}
                                    </p>
                                </div>
                            </button>
                        </li>
                    )
                })}
            </ul>
        )
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                id="notification-bell-button"
                aria-label="Notifications"
                aria-expanded={isOpen}
                aria-haspopup="menu"
                onClick={() => setIsOpen((prev) => !prev)}
                className="relative rounded-full p-2 hover:bg-gray-100 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
                <BellIcon hasUnread={unreadCount > 0} />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold text-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div
                    role="menu"
                    aria-labelledby="notification-bell-button"
                    className="absolute right-0 mt-2 w-80 rounded-xl border border-gray-200 bg-white shadow-lg"
                >
                    <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                        <div>
                            <p className="text-sm font-semibold text-gray-900">Notifications</p>
                            <p className="text-xs text-gray-500">
                                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                            </p>
                        </div>
                        <button
                            type="button"
                            className="text-xs font-medium text-blue-600 disabled:text-gray-400"
                            onClick={() => markAllNotificationsRead()}
                            disabled={unreadCount === 0 || markAllPending}
                        >
                            Mark all read
                        </button>
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                        {renderDropdownContent()}
                    </div>

                    <div className="border-t border-gray-100 px-4 py-3 text-right">
                        <button
                            type="button"
                            className="text-sm font-medium text-blue-600 hover:text-blue-700"
                            onClick={() => {
                                setIsOpen(false)
                                navigate('/notifications')
                            }}
                        >
                            View all
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

