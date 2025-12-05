import { Event, RecurrencePattern } from '../types'

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
        next.setMonth(month + 1)
        next.setDate(targetDay)
        
        // If the day rolled over (e.g., trying to set Feb 31 results in Mar 3),
        // it means we went past the end of the target month.
        // Clamp to the last valid day of the target month.
        if (next.getDate() !== targetDay) {
            // We went past the end of the month, so set to the last day of the target month
            // setDate(0) sets to the last day of the previous month, which is the target month
            // since we already advanced the month
            next.setDate(0)
        }
    }
    return next
}

export function getRecurrenceLabel(pattern: RecurrencePattern): string {
    return RECURRENCE_LABELS[pattern]
}

/**
 * Returns all event instances (including recurring occurrences) that fall within the provided range.
 * Each additional occurrence receives a synthetic id while keeping a reference to the originalEventId.
 */
export function eventsWithinRange(events: Event[], rangeStart: Date, rangeEnd: Date): Event[] {
    if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime()) || rangeEnd < rangeStart) {
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
            if (eventStart >= safeStart && eventStart <= safeEnd) {
                results.push({
                    ...event,
                    originalEventId: originId,
                })
            }
            continue
        }

        const recurrenceEnd = new Date(event.recurrenceEndDate)
        if (Number.isNaN(recurrenceEnd.getTime()) || recurrenceEnd < safeStart) {
            continue
        }

        // Store the original day of month for monthly recurrence to preserve it across iterations
        // This ensures events like "31st of every month" correctly handle month-end edge cases
        const originalDayOfMonth = event.recurrencePattern === 'MONTHLY' ? eventStart.getDate() : undefined

        let currentStart = new Date(eventStart.getTime())
        let iterations = 0

        while (currentStart <= safeEnd && currentStart <= recurrenceEnd && iterations < MAX_OCCURRENCES) {
            if (currentStart >= safeStart) {
                const startIso = currentStart.toISOString()
                const occurrenceEndIso =
                    baseEnd && durationMs >= 0
                        ? new Date(currentStart.getTime() + durationMs).toISOString()
                        : undefined
                const isBaseOccurrence = currentStart.getTime() === eventStart.getTime()
                results.push({
                    ...event,
                    id: isBaseOccurrence ? event.id : `${event.id}::${startIso}`,
                    startTime: startIso,
                    endTime: occurrenceEndIso ?? event.endTime ?? null,
                    originalEventId: originId,
                })
            }

            currentStart = advanceDate(currentStart, event.recurrencePattern, originalDayOfMonth)
            iterations++
        }
    }

    return results
}
