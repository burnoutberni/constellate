import { Event, RecurrencePattern } from '@/types'

const MAX_OCCURRENCES = 1000

const RECURRENCE_LABELS: Record<RecurrencePattern, string> = {
	DAILY: 'Daily',
	WEEKLY: 'Weekly',
	MONTHLY: 'Monthly',
}

function advanceDate(date: Date, pattern: RecurrencePattern, originalDayOfMonth?: number): Date {
	const next = new Date(date.getTime())
	if (pattern === 'DAILY') {
		next.setDate(next.getDate() + 1)
	} else if (pattern === 'WEEKLY') {
		next.setDate(next.getDate() + 7)
	} else {
		// Monthly: handle month-end edge cases
		// Use the original day of month if provided, otherwise use the current date's day
		// This ensures that recurring events preserve the original day (e.g., Jan 31 -> Feb 28 -> Mar 31)
		const targetDay = originalDayOfMonth ?? date.getDate()
		const month = date.getMonth()
		const targetMonth = month + 1
		next.setMonth(targetMonth)
		next.setDate(targetDay)

		// If the day rolled over (e.g., trying to set Feb 31 results in Mar 3),
		// it means we went past the end of the target month.
		// Clamp to the last valid day of the target month.
		if (next.getMonth() !== targetMonth) {
			// Rolled over, set to last day of target month
			next.setMonth(targetMonth + 1)
			next.setDate(0)
		}
	}
	return next
}

export function getRecurrenceLabel(pattern: RecurrencePattern): string {
	return RECURRENCE_LABELS[pattern]
}

function isValidDateRange(rangeStart: Date, rangeEnd: Date): boolean {
	return (
		!Number.isNaN(rangeStart.getTime()) &&
		!Number.isNaN(rangeEnd.getTime()) &&
		rangeEnd >= rangeStart
	)
}

function createOccurrence(
	event: Event,
	currentStart: Date,
	eventStart: Date,
	durationMs: number,
	baseEnd: Date | null,
	originId: string
): Event {
	const startIso = currentStart.toISOString()
	const occurrenceEndIso =
		baseEnd && durationMs >= 0
			? new Date(currentStart.getTime() + durationMs).toISOString()
			: undefined
	const isBaseOccurrence = currentStart.getTime() === eventStart.getTime()

	return {
		...event,
		id: isBaseOccurrence ? event.id : `${event.id}::${startIso}`,
		startTime: startIso,
		endTime: occurrenceEndIso ?? event.endTime ?? null,
		originalEventId: originId,
	}
}

function processNonRecurringEvent(
	event: Event,
	eventStart: Date,
	safeStart: Date,
	safeEnd: Date,
	originId: string
): Event | null {
	if (eventStart >= safeStart && eventStart <= safeEnd) {
		return {
			...event,
			originalEventId: originId,
		}
	}
	return null
}

function processRecurringEvent(
	event: Event,
	eventStart: Date,
	safeStart: Date,
	safeEnd: Date,
	originId: string,
	baseEnd: Date | null,
	durationMs: number
): Event[] {
	if (!event.recurrenceEndDate || !event.recurrencePattern) {
		return []
	}

	const recurrenceEnd = new Date(event.recurrenceEndDate)
	if (Number.isNaN(recurrenceEnd.getTime()) || recurrenceEnd < safeStart) {
		return []
	}

	const originalDayOfMonth =
		event.recurrencePattern === 'MONTHLY' ? eventStart.getDate() : undefined
	const results: Event[] = []
	let currentStart = new Date(eventStart.getTime())
	let iterations = 0

	while (
		currentStart <= safeEnd &&
		currentStart <= recurrenceEnd &&
		iterations < MAX_OCCURRENCES
	) {
		if (currentStart >= safeStart) {
			results.push(
				createOccurrence(event, currentStart, eventStart, durationMs, baseEnd, originId)
			)
		}

		currentStart = advanceDate(currentStart, event.recurrencePattern, originalDayOfMonth)
		iterations++
	}

	return results
}

/**
 * Returns all event instances (including recurring occurrences) that fall within the provided range.
 * Each additional occurrence receives a synthetic id while keeping a reference to the originalEventId.
 */
export function eventsWithinRange(events: Event[], rangeStart: Date, rangeEnd: Date): Event[] {
	if (!isValidDateRange(rangeStart, rangeEnd)) {
		return []
	}

	const safeStart = new Date(rangeStart.getTime())
	const safeEnd = new Date(rangeEnd.getTime())
	const results: Event[] = []

	for (const event of events) {
		const eventStart = new Date(event.startTime)
		if (Number.isNaN(eventStart.getTime())) {
			continue
		}

		const baseEnd = event.endTime ? new Date(event.endTime) : null
		const durationMs = baseEnd ? baseEnd.getTime() - eventStart.getTime() : 0
		const originId = event.originalEventId ?? event.id

		if (!event.recurrencePattern || !event.recurrenceEndDate) {
			const nonRecurring = processNonRecurringEvent(
				event,
				eventStart,
				safeStart,
				safeEnd,
				originId
			)
			if (nonRecurring) {
				results.push(nonRecurring)
			}
			continue
		}

		const recurring = processRecurringEvent(
			event,
			eventStart,
			safeStart,
			safeEnd,
			originId,
			baseEnd,
			durationMs
		)
		results.push(...recurring)
	}

	return results
}
