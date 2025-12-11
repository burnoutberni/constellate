import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, Badge, Button, Avatar } from './ui'
import { Stack } from './layout'
import { formatRelativeTime } from '../lib/datetime'
import { getNotificationTypeMeta } from '../lib/notifications'
import { safeNavigate } from '../lib/urlValidation'
import type { Notification } from '@/types'

interface NotificationItemProps {
    notification: Notification
    onMarkRead?: (notificationId: string) => void
    compact?: boolean
}

/**
 * NotificationItem component for displaying individual notifications
 * Uses design system components for consistent styling
 */
export function NotificationItem({
    notification,
    onMarkRead,
    compact = false,
}: NotificationItemProps) {
    const navigate = useNavigate()
    const meta = getNotificationTypeMeta(notification.type)

    const handleOpen = () => {
        if (!notification.contextUrl) {
            return
        }

        if (!notification.read && onMarkRead) {
            onMarkRead(notification.id)
        }

        safeNavigate(notification.contextUrl, navigate)
    }

    const handleMarkRead = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (onMarkRead) {
            onMarkRead(notification.id)
        }
    }

    const getInitial = () => {
        if (!notification.actor) {
return '?'
}
        return (
            notification.actor.name?.[0] ??
            notification.actor.username?.[0] ??
            '?'
        ).toUpperCase()
    }

    if (compact) {
        return (
            <button
                type="button"
                onClick={handleOpen}
                aria-label={`View notification: ${notification.title}`}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                    notification.read
                        ? 'bg-background-primary hover:bg-background-secondary'
                        : 'bg-primary-50 hover:bg-primary-100'
                }`}
            >
                <div
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-base ${meta.iconClass}`}
                >
                    {meta.icon}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-text-primary truncate">
                            {notification.title}
                        </p>
                        <Badge variant="info" size="sm">
                            {meta.label}
                        </Badge>
                    </div>
                    {notification.body && (
                        <p className="mt-1 text-sm text-text-secondary line-clamp-2">
                            {notification.body}
                        </p>
                    )}
                    <p className="mt-1 text-xs text-text-tertiary">
                        {formatRelativeTime(notification.createdAt)}
                    </p>
                </div>
            </button>
        )
    }

    return (
        <Card
            variant={notification.read ? 'default' : 'elevated'}
            padding="lg"
            className={notification.read ? '' : 'bg-primary-50 border-primary-200'}
        >
            <CardContent>
                <Stack direction="column" directionMd="row" gap="md">
                    <div
                        className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-2xl ${meta.iconClass}`}
                        aria-hidden="true"
                    >
                        {meta.icon}
                    </div>
                    <div className="flex-1 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="info" size="md">
                                {meta.label}
                            </Badge>
                            {!notification.read && (
                                <Badge variant="primary" size="sm">
                                    Unread
                                </Badge>
                            )}
                            <span className="text-xs text-text-tertiary">
                                {formatRelativeTime(notification.createdAt)}
                            </span>
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-text-primary">
                                {notification.title}
                            </h3>
                            {notification.body && (
                                <p className="mt-1 text-text-secondary">
                                    {notification.body}
                                </p>
                            )}
                        </div>
                        {notification.actor && (
                            <div className="flex items-center gap-2">
                                <Avatar
                                    src={notification.actor.profileImage || undefined}
                                    alt={
                                        notification.actor.name ||
                                        notification.actor.username ||
                                        'User'
                                    }
                                    fallback={getInitial()}
                                    size="sm"
                                />
                                <div className="flex flex-col leading-tight">
                                    <span className="text-sm font-medium text-text-primary">
                                        {notification.actor.name ||
                                            notification.actor.username ||
                                            'Someone'}
                                    </span>
                                    {notification.actor.username && (
                                        <span className="text-xs text-text-tertiary">
                                            @{notification.actor.username}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                        <div className="flex flex-wrap items-center gap-3 pt-2">
                            {!notification.read && onMarkRead && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleMarkRead}
                                    aria-label={`Mark "${notification.title}" as read`}
                                >
                                    Mark as read
                                </Button>
                            )}
                            {notification.contextUrl && (
                                <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={handleOpen}
                                    aria-label={`View details for "${notification.title}"`}
                                >
                                    View details
                                </Button>
                            )}
                        </div>
                    </div>
                </Stack>
            </CardContent>
        </Card>
    )
}
