import { useState, useEffect } from 'react'

import { 
    useEmailPreferences, 
    useUpdateEmailPreferences,
    useResetEmailPreferences,
    type EmailPreferences
} from '@/hooks/queries'

import { Stack } from './layout'
import { Card, CardHeader, CardTitle, CardContent, Button, CardFooter, Spinner } from './ui'

const notificationTypes: Array<{ 
    type: keyof EmailPreferences
    label: string
    description: string
    icon: string
}> = [
    {
        type: 'FOLLOW',
        label: 'New Followers',
        description: 'Get notified when someone follows you',
        icon: '👥',
    },
    {
        type: 'COMMENT',
        label: 'Comments',
        description: 'Get notified when someone comments on your events',
        icon: '💬',
    },
    {
        type: 'LIKE',
        label: 'Likes',
        description: 'Get notified when someone likes your events',
        icon: '❤️',
    },
    {
        type: 'MENTION',
        label: 'Mentions',
        description: 'Get notified when someone mentions you',
        icon: '@️⃣',
    },
    {
        type: 'EVENT',
        label: 'Event Updates',
        description: "Get notified about events you're attending",
        icon: '📅',
    },
    {
        type: 'SYSTEM',
        label: 'System Notifications',
        description: 'Important updates from the platform',
        icon: '⚙️',
    },
]

interface NotificationSettingsProps {
    /** Whether the component should use email preferences instead of generic preferences */
    emailMode?: boolean
}

/**
 * NotificationSettings component for managing notification preferences
 * Allows users to enable/disable different types of notifications
 */
export function NotificationSettings({ emailMode = false }: NotificationSettingsProps) {
    const { data, isLoading, error } = useEmailPreferences()
    const { mutate: updatePreferences, isPending: isUpdating } = useUpdateEmailPreferences()
    const { mutate: resetPreferences, isPending: isResetting } = useResetEmailPreferences()

    const [localPreferences, setLocalPreferences] = useState<EmailPreferences | null>(null)


    const [hasChanges, setHasChanges] = useState(false)

 
    useEffect(() => {
        // Sync local state with server data, but only if there are no unsaved local changes.
        // This prevents overwriting user's edits if data is refetched in the background.
        if (data?.preferences && !hasChanges) {
            setLocalPreferences(data.preferences)
        }
    // `hasChanges` is intentionally omitted from the dependency array. We only want this
    // effect to run when `data.preferences` from the server changes.
    /* eslint-disable react-hooks/exhaustive-deps */
    }, [data?.preferences])

    const handleToggle = (type: keyof EmailPreferences) => {
        if (!localPreferences) {return}
        setLocalPreferences((prev) => prev ? ({
            ...prev,
            [type]: !prev[type],
        }) : prev)
        setHasChanges(true)
    }

    const handleSave = () => {
        if (!localPreferences) {return}
        updatePreferences(localPreferences, {
            onSuccess: () => {
                setHasChanges(false)
            },
        })
    }

    const handleReset = () => {
        resetPreferences(undefined, {
            onSuccess: (response) => {
                setLocalPreferences(response.preferences)
                setHasChanges(false)
            },
        })
    }

    const toggleAll = (enabled: boolean) => {
        if (!localPreferences) {return}
        const updated = Object.fromEntries(
            notificationTypes.map((type) => [type, enabled])
        ) as EmailPreferences;
        setLocalPreferences(updated)
        setHasChanges(true)
    }

    if (isLoading) {
        return (
            <Card variant="default" padding="lg" role="status" aria-label="Loading notification preferences">
                <div className="flex items-center justify-center min-h-[200px]">
                    <Spinner size="md" />
                </div>
            </Card>
        )
    }

    if (error) {
        return (
            <Card variant="default" padding="lg">
                <div className="text-center">
                    <p className="text-lg font-semibold text-text-primary mb-2">
                        Failed to load notification preferences
                    </p>
                    <p className="text-text-secondary mb-4">
                        {error instanceof Error ? error.message : 'An error occurred'}
                    </p>
                    <Button variant="primary" onClick={() => window.location.reload()}>
                        Retry
                    </Button>
                </div>
            </Card>
        )
    }

    // If preferences are not loaded yet, don't render the form (loading state is handled above)
    if (!localPreferences) {return null}

    return (
        <Card variant="default" padding="lg">
            <CardHeader>
                <div className="flex items-center justify-between w-full">
                    <CardTitle>
                        {emailMode ? 'Email Notifications' : 'Notification Preferences'}
                    </CardTitle>
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleAll(true)}
                            disabled={isUpdating}>
                            Enable All
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleAll(false)}
                            disabled={isUpdating}>
                            Disable All
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Stack gap="lg">
                    <p className="text-sm text-text-secondary">
                        {emailMode 
                            ? 'Choose which notifications you\'d like to receive via email. You can always change these settings later.'
                            : 'Choose which notifications you\'d like to receive. You can always change these settings later.'
                        }
                    </p>

                    <Stack gap="md">
                        {notificationTypes.map(({ type, label, description, icon }) => (
                            <div
                                key={type}
                                className="flex items-start justify-between gap-4 py-3 border-b border-border-default last:border-b-0">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-lg">{icon}</span>
                                        <label
                                            htmlFor={`notification-${type}`}
                                            className="text-sm font-medium text-text-primary cursor-pointer">
                                            {label}
                                        </label>
                                    </div>
                                    <p className="text-xs text-text-tertiary">{description}</p>
                                </div>
                                <Button
                                    id={`notification-${type}`}
                                    type="button"
                                    role="switch"
                                    aria-checked={localPreferences[type]}
                                    onClick={() => handleToggle(type)}
                                    disabled={isUpdating}
                                    variant="ghost"
                                    className={`
                                        relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full
                                        border-2 border-transparent transition-colors duration-200 ease-in-out
                                        focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
                                        disabled:opacity-50 disabled:cursor-not-allowed
                                        ${
                                            localPreferences[type]
                                                ? 'bg-primary-600'
                                                : 'bg-neutral-200 dark:bg-neutral-700'
                                        }
                                    `}>
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
                                </Button>
                            </div>
                        ))}
                    </Stack>
                </Stack>
            </CardContent>
            {hasChanges && (
                <CardFooter>
                    <Button 
                        variant="ghost" 
                        size="md" 
                        onClick={() => {
                            setLocalPreferences(data?.preferences || null)
                            setHasChanges(false)
                        }}
                        disabled={isUpdating}>
                        Cancel
                    </Button>
                    <Button
                        variant="outline"
                        size="md"
                        onClick={handleReset}
                        loading={isResetting}
                        disabled={isUpdating || isResetting}>
                        Reset to Defaults
                    </Button>
                    <Button
                        variant="primary"
                        size="md"
                        onClick={handleSave}
                        loading={isUpdating}
                        disabled={isUpdating}>
                        Save Changes
                    </Button>
                </CardFooter>
            )}
        </Card>
    )
}
