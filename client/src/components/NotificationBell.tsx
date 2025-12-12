import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    useNotifications,
    useMarkNotificationRead,
    useMarkAllNotificationsRead,
} from '@/hooks/queries'
import { Badge, Button, Card, CardHeader, CardTitle, CardContent, Spinner } from './ui'
import { NotificationItem } from './NotificationItem'

interface NotificationBellProps {
    userId?: string
}

const BellIcon = ({ hasUnread }: { hasUnread: boolean }) => (
    <svg
        className="w-6 h-6 text-text-secondary"
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
    const { data, isLoading, error, isError } = useNotifications(10, { enabled: Boolean(userId) })
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

    const renderDropdownContent = () => {
        if (isLoading) {
            return (
                <div className="flex items-center justify-center py-8" role="status" aria-label="Loading notifications" aria-live="polite">
                    <Spinner size="sm" />
                </div>
            )
        }

        if (isError) {
            return (
                <div className="px-4 py-8 text-center">
                    <p className="font-semibold text-text-primary mb-2">Unable to load notifications</p>
                    <p className="text-text-tertiary text-xs">
                        {error instanceof Error ? error.message : 'An error occurred while fetching notifications.'}
                    </p>
                </div>
            )
        }

        if (notifications.length === 0) {
            return (
                <div className="px-4 py-8 text-center">
                    <p className="text-sm text-text-secondary">Nothing new just yet</p>
                </div>
            )
        }

        return (
            <ul className="divide-y divide-border-default">
                {notifications.map((notification) => (
                    <li key={notification.id}>
                        <NotificationItem
                            notification={notification}
                            onMarkRead={markNotificationRead}
                            compact
                        />
                    </li>
                ))}
            </ul>
        )
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <Button
                type="button"
                id="notification-bell-button"
                aria-label="Notifications"
                aria-expanded={isOpen}
                aria-haspopup="menu"
                onClick={() => setIsOpen((prev) => !prev)}
                variant="ghost"
                size="sm"
                className="relative rounded-full p-2 hover:bg-background-secondary transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
            >
                <BellIcon hasUnread={unreadCount > 0} />
                {unreadCount > 0 && (
                    <Badge
                        variant="error"
                        size="sm"
                        className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1"
                    >
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </Badge>
                )}
            </Button>

            {isOpen && (
                <Card
                    variant="elevated"
                    padding="none"
                    className="absolute right-0 mt-2 w-80 z-50"
                    role="menu"
                    aria-labelledby="notification-bell-button"
                >
                    <CardHeader className="border-b border-border-default px-4 py-3">
                        <div className="flex items-center justify-between w-full">
                            <div>
                                <CardTitle as="h2" className="text-sm">
                                    Notifications
                                </CardTitle>
                                <p className="text-xs text-text-tertiary">
                                    {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                                </p>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => markAllNotificationsRead()}
                                disabled={unreadCount === 0 || markAllPending}
                                className="text-xs"
                            >
                                Mark all read
                            </Button>
                        </div>
                    </CardHeader>

                    <CardContent className="p-0 max-h-96 overflow-y-auto">
                        {renderDropdownContent()}
                    </CardContent>

                    <div className="border-t border-border-default px-4 py-3 text-right">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setIsOpen(false)
                                navigate('/notifications')
                            }}
                        >
                            View all
                        </Button>
                    </div>
                </Card>
            )}
        </div>
    )
}
