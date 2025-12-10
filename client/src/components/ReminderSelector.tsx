import React from 'react'

export interface ReminderOption {
    label: string
    value: number | null
}

export interface ReminderSelectorProps {
    /**
     * Currently selected reminder value in minutes
     */
    value: number | null
    /**
     * Callback when reminder value changes
     */
    onChange: (value: number | null) => void
    /**
     * Whether the user is authenticated
     */
    isAuthenticated: boolean
    /**
     * Whether the user can manage reminders (must be attending or maybe)
     */
    canManageReminder: boolean
    /**
     * Whether the reminder mutation is pending
     */
    isPending: boolean
    /**
     * Whether the event has already started
     */
    eventHasStarted: boolean
    /**
     * Available reminder options
     */
    options?: ReminderOption[]
}

const DEFAULT_REMINDER_OPTIONS: ReminderOption[] = [
=======
import { useAuth } from '../contexts/AuthContext'

export const REMINDER_OPTIONS: Array<{ label: string; value: number | null }> = [
>>>>>>> dd55cb8 (Initial plan)
    { label: 'No reminder', value: null },
    { label: '5 minutes before', value: 5 },
    { label: '15 minutes before', value: 15 },
    { label: '30 minutes before', value: 30 },
    { label: '1 hour before', value: 60 },
    { label: '2 hours before', value: 120 },
    { label: '1 day before', value: 1440 },
]

<<<<<<< HEAD
/**
 * ReminderSelector allows users to set reminder notifications for an event.
 * Only available for authenticated users who have RSVP'd as attending or maybe.
 */
export function ReminderSelector({
    value,
    onChange,
    isAuthenticated,
    canManageReminder,
    isPending,
    eventHasStarted,
    options = DEFAULT_REMINDER_OPTIONS,
}: ReminderSelectorProps) {
    // Don't show reminder selector if event has already started
    if (eventHasStarted) {
        return null
    }

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const nextValue = e.target.value === '' ? null : Number(e.target.value)
        onChange(nextValue)
    }

    const getHelperText = () => {
        if (!isAuthenticated) {
            return 'Sign up to save reminder notifications.'
        }
        if (canManageReminder) {
            return 'We will send reminder notifications and email (if configured).'
        }
        return 'RSVP as Going or Maybe to enable reminders.'
    }

    return (
        <div className="mb-6 pb-4 border-b border-border-default">
            <label className="block text-sm font-semibold text-text-primary mb-2">
                Reminder
            </label>
            <div className="flex items-center gap-3">
                <select
                    className="flex-1 px-3 py-2 border border-border-default rounded-lg bg-background-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    value={value !== null ? String(value) : ''}
                    onChange={handleChange}
                    disabled={!isAuthenticated || !canManageReminder || isPending}
                    aria-label="Reminder notification timing"
                >
                    {options.map((option) => (
                        <option
                            key={option.label}
                            value={option.value !== null ? option.value : ''}
                        >
                            {option.label}
                        </option>
                    ))}
                </select>
                {isPending && (
                    <span className="text-sm text-text-secondary">Saving...</span>
                )}
            </div>
            <p className="text-xs text-text-secondary mt-2">
                {getHelperText()}
            </p>
=======
interface ReminderSelectorProps {
    value: number | null
    onChange: (value: number | null) => void
    disabled?: boolean
    isPending?: boolean
    helperText?: string
    onSignUpRequired?: () => void
}

export function ReminderSelector({
    value,
    onChange,
    disabled = false,
    isPending = false,
    helperText,
    onSignUpRequired,
}: ReminderSelectorProps) {
    const { user } = useAuth()

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const nextValue = e.target.value === '' ? null : Number(e.target.value)

        if (!user && onSignUpRequired) {
            onSignUpRequired()
            return
        }

        onChange(nextValue)
    }

    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-text-primary">Reminder</label>
            <select
                value={value !== null ? value : ''}
                onChange={handleChange}
                disabled={disabled || isPending}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            >
                {REMINDER_OPTIONS.map((option) => (
                    <option key={option.label} value={option.value !== null ? option.value : ''}>
                        {option.label}
                    </option>
                ))}
            </select>
            {isPending && <span className="text-sm text-text-secondary">Saving...</span>}
            {helperText && <p className="text-xs text-text-secondary">{helperText}</p>}
>>>>>>> dd55cb8 (Initial plan)
        </div>
    )
}
