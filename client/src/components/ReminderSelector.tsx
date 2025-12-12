import { type ChangeEvent } from 'react'
import { REMINDER_OPTIONS } from './reminderConstants'

export interface ReminderOption {
	label: string
	value: number | null
}

interface ReminderSelectorProps {
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

const DEFAULT_REMINDER_OPTIONS = REMINDER_OPTIONS

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

	const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
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
			<label className="block text-sm font-semibold text-text-primary mb-2">Reminder</label>
			<div className="flex items-center gap-3">
				<select
					className="flex-1 px-3 py-2 border border-border-default rounded-lg bg-background-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
					value={value !== null ? String(value) : ''}
					onChange={handleChange}
					disabled={!isAuthenticated || !canManageReminder || isPending}
					aria-label="Reminder notification timing">
					{options.map((option) => (
						<option
							key={option.label}
							value={option.value !== null ? option.value : ''}>
							{option.label}
						</option>
					))}
				</select>
				{isPending && <span className="text-sm text-text-secondary">Saving...</span>}
			</div>
			<p className="text-xs text-text-secondary mt-2">{getHelperText()}</p>
		</div>
	)
}
