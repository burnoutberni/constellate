import { type ChangeEvent } from 'react'

import { REMINDER_OPTIONS } from './reminderConstants'
import { Select } from './ui'

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
			<div className="flex items-end gap-3">
				<div className="flex-1">
					<Select
						label="Reminder"
						value={value !== null ? String(value) : ''}
						onChange={handleChange}
						disabled={!isAuthenticated || !canManageReminder || isPending}
						aria-label="Reminder notification timing"
						helperText={getHelperText()}>
						{options.map((option) => (
							<option
								key={option.label}
								value={option.value !== null ? option.value : ''}>
								{option.label}
							</option>
						))}
					</Select>
				</div>
				{isPending && <span className="text-sm text-text-secondary mb-1.5">Saving...</span>}
			</div>
		</div>
	)
}
