import { Errors } from './errors.js'

export const RECURRENCE_PATTERNS = ['DAILY', 'WEEKLY', 'MONTHLY'] as const

export type RecurrencePattern = (typeof RECURRENCE_PATTERNS)[number]

/**
 * Validates recurrence input combinations to ensure consistent scheduling.
 * Throws an AppError when validation fails so route handlers can return 400s.
 */
export function validateRecurrenceInput(
	startTime: Date,
	recurrencePattern?: RecurrencePattern | null,
	recurrenceEndDate?: Date | null
): void {
	if (!recurrencePattern) {
		return
	}

	if (!recurrenceEndDate) {
		throw Errors.badRequest('Recurrence end date is required when a recurrence pattern is set')
	}

	if (recurrenceEndDate.getTime() <= startTime.getTime()) {
		throw Errors.badRequest('Recurrence end date must be after the event start time')
	}
}
