import type { ReminderOption } from './ReminderSelector'

export const REMINDER_OPTIONS: ReminderOption[] = [
	{ label: 'No reminder', value: null },
	{ label: '5 minutes before', value: 5 },
	{ label: '15 minutes before', value: 15 },
	{ label: '30 minutes before', value: 30 },
	{ label: '1 hour before', value: 60 },
	{ label: '2 hours before', value: 120 },
	{ label: '1 day before', value: 1440 },
]

