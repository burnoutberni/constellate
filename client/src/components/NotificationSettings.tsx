import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, Button } from './ui'
import type { NotificationType } from '@/types'

interface NotificationPreferences {
    [key: string]: boolean
}

const notificationTypes: Array<{ type: NotificationType; label: string; description: string }> = [
    {
        type: 'FOLLOW',
        label: 'New Followers',
        description: 'Get notified when someone follows you',
    },
    {
        type: 'COMMENT',
        label: 'Comments',
        description: 'Get notified when someone comments on your events',
    },
    {
        type: 'LIKE',
        label: 'Likes',
        description: 'Get notified when someone likes your events',
    },
    {
        type: 'MENTION',
        label: 'Mentions',
        description: 'Get notified when someone mentions you',
    },
    {
        type: 'EVENT',
        label: 'Event Updates',
        description: 'Get notified about events you\'re attending',
    },
    {
        type: 'SYSTEM',
        label: 'System Notifications',
        description: 'Important updates from the platform',
    },
]

interface NotificationSettingsProps {
    /** Current notification preferences */
    preferences?: NotificationPreferences
    /** Callback when preferences are updated */
    onUpdate?: (preferences: NotificationPreferences) => void
    /** Whether the component is in a loading state */
    loading?: boolean
}

/**
 * NotificationSettings component for managing notification preferences
 * Allows users to enable/disable different types of notifications
 */
export function NotificationSettings({
    preferences = {},
    onUpdate,
    loading = false,
}: NotificationSettingsProps) {
    const [localPreferences, setLocalPreferences] = useState<NotificationPreferences>(
        () => {
            // Initialize with default preferences (all enabled)
            const defaults: NotificationPreferences = {}
            notificationTypes.forEach(({ type }) => {
                defaults[type] = preferences[type] ?? true
            })
            return defaults
        },
    )

    const [hasChanges, setHasChanges] = useState(false)

    const handleToggle = (type: string) => {
        setLocalPreferences((prev) => ({
            ...prev,
            [type]: !prev[type],
        }))
        setHasChanges(true)
    }

    const handleSave = () => {
        if (onUpdate) {
            onUpdate(localPreferences)
        }
        setHasChanges(false)
    }

    const handleReset = () => {
        setLocalPreferences(() => {
            const defaults: NotificationPreferences = {}
            notificationTypes.forEach(({ type }) => {
                defaults[type] = preferences[type] ?? true
            })
            return defaults
        })
        setHasChanges(false)
    }

    const toggleAll = (enabled: boolean) => {
        const updated: NotificationPreferences = {}
        notificationTypes.forEach(({ type }) => {
            updated[type] = enabled
        })
        setLocalPreferences(updated)
        setHasChanges(true)
    }

    return (
        <Card variant="default" padding="lg">
            <CardHeader>
                <div className="flex items-center justify-between w-full">
                    <CardTitle>Notification Preferences</CardTitle>
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleAll(true)}
                            disabled={loading}
                        >
                            Enable All
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleAll(false)}
                            disabled={loading}
                        >
                            Disable All
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <p className="text-sm text-text-secondary mb-6">
                        Choose which notifications you&apos;d like to receive. You can always change
                        these settings later.
                    </p>

                    <div className="space-y-4">
                        {notificationTypes.map(({ type, label, description }) => (
                            <div
                                key={type}
                                className="flex items-start justify-between gap-4 py-3 border-b border-border-default last:border-b-0"
                            >
                                <div className="flex-1">
                                    <label
                                        htmlFor={`notification-${type}`}
                                        className="text-sm font-medium text-text-primary cursor-pointer"
                                    >
                                        {label}
                                    </label>
                                    <p className="text-xs text-text-tertiary mt-1">
                                        {description}
                                    </p>
                                </div>
                                <button
                                    id={`notification-${type}`}
                                    type="button"
                                    role="switch"
                                    aria-checked={localPreferences[type]}
                                    onClick={() => handleToggle(type)}
                                    disabled={loading}
                                    className={`
                                        relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full
                                        border-2 border-transparent transition-colors duration-200 ease-in-out
                                        focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
                                        disabled:opacity-50 disabled:cursor-not-allowed
                                        ${
                                            localPreferences[type]
                                                ? 'bg-primary-600'
                                                : 'bg-neutral-200'
                                        }
                                    `}
                                >
                                    <span className="sr-only">
                                        {localPreferences[type] ? 'Disable' : 'Enable'} {label}
                                    </span>
                                    <span
                                        aria-hidden="true"
                                        className={`
                                            pointer-events-none inline-block h-5 w-5 transform rounded-full
                                            bg-white shadow ring-0 transition duration-200 ease-in-out
                                            ${
                                                localPreferences[type]
                                                    ? 'translate-x-5'
                                                    : 'translate-x-0'
                                            }
                                        `}
                                    />
                                </button>
                            </div>
                        ))}
                    </div>

                    {hasChanges && (
                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-default">
                            <Button
                                variant="ghost"
                                size="md"
                                onClick={handleReset}
                                disabled={loading}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="primary"
                                size="md"
                                onClick={handleSave}
                                loading={loading}
                                disabled={loading}
                            >
                                Save Changes
                            </Button>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
