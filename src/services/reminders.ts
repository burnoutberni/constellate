/**
 * Reminder Service
 * Handles scheduling, cancellation, and management of event reminders
 */

import { prisma } from '../lib/prisma.js'
import { AppError } from '../lib/errors.js'
import { ReminderStatus } from '@prisma/client'

// Valid reminder minute options (in minutes before event start)
export const REMINDER_MINUTE_OPTIONS = [5, 15, 30, 60, 120, 1440] as const

// Maximum minutes before start (10 years = 5,256,000 minutes)
const MAX_MINUTES = 5_256_000

/**
 * Validates and normalizes reminder minutes to a supported option
 */
function normalizeReminderMinutes(minutes: number): number {
    if (!REMINDER_MINUTE_OPTIONS.includes(minutes as typeof REMINDER_MINUTE_OPTIONS[number])) {
        throw new AppError(
            'REMINDER_INTERVAL_UNSUPPORTED',
            `Reminder interval must be one of: ${REMINDER_MINUTE_OPTIONS.join(', ')}`,
            400
        )
    }
    return minutes
}

/**
 * Computes the remindAt time from event start time and minutes before start
 * Validates that the reminder time is in the future and within reasonable bounds
 */
export function computeRemindAt(startTime: Date, minutesBeforeStart: number): Date {
    // Validate startTime
    if (isNaN(startTime.getTime())) {
        throw new AppError('REMINDER_INVALID_EVENT', 'Event start time is invalid', 400)
    }

    // Validate minutesBeforeStart is non-negative
    if (minutesBeforeStart < 0) {
        throw new AppError(
            'REMINDER_INVALID_OFFSET',
            'Reminder offset cannot be negative',
            400
        )
    }

    // Validate minutesBeforeStart doesn't exceed maximum
    if (minutesBeforeStart > MAX_MINUTES) {
        throw new AppError(
            'REMINDER_INVALID_OFFSET',
            `Reminder offset cannot exceed ${MAX_MINUTES} minutes (10 years)`,
            400
        )
    }

    // Calculate remindAt time
    const remindAt = new Date(startTime.getTime() - minutesBeforeStart * 60 * 1000)

    // Validate that remindAt is in the future
    const now = new Date()
    if (remindAt <= now) {
        throw new AppError(
            'REMINDER_TOO_LATE',
            'Reminder time must be in the future',
            400
        )
    }

    return remindAt
}

/**
 * Serializes a reminder object, converting Date objects to ISO strings
 */
export function serializeReminder(reminder: {
    id: string
    eventId: string
    userId: string
    minutesBeforeStart: number
    status: ReminderStatus
    remindAt: Date
    createdAt: Date
    updatedAt: Date
    deliveredAt: Date | null
    lastAttemptAt: Date | null
    failureReason: string | null
}) {
    return {
        id: reminder.id,
        eventId: reminder.eventId,
        userId: reminder.userId,
        minutesBeforeStart: reminder.minutesBeforeStart,
        status: reminder.status,
        remindAt: reminder.remindAt.toISOString(),
        createdAt: reminder.createdAt.toISOString(),
        updatedAt: reminder.updatedAt.toISOString(),
        deliveredAt: reminder.deliveredAt?.toISOString() ?? null,
        lastAttemptAt: reminder.lastAttemptAt?.toISOString() ?? null,
        failureReason: reminder.failureReason,
    }
}

/**
 * Formats a list of reminders by serializing each one
 */
export function formatReminderList(reminders: Array<{
    id: string
    eventId: string
    userId: string
    minutesBeforeStart: number
    status: ReminderStatus
    remindAt: Date
    createdAt: Date
    updatedAt: Date
    deliveredAt: Date | null
    lastAttemptAt: Date | null
    failureReason: string | null
}>) {
    return reminders.map(serializeReminder)
}

/**
 * Lists all reminders for a specific event and user
 */
export async function listEventRemindersForUser(eventId: string, userId: string) {
    const reminders = await prisma.eventReminder.findMany({
        where: {
            eventId,
            userId,
        },
        orderBy: {
            remindAt: 'asc',
        },
    })

    return formatReminderList(reminders)
}

/**
 * Schedules a reminder for an event
 * Creates a new reminder or updates an existing one
 */
export async function scheduleReminderForEvent(
    event: { id: string; title: string; startTime: Date },
    userId: string,
    minutesBeforeStart: number
) {
    // Validate event start time
    if (isNaN(event.startTime.getTime())) {
        throw new AppError('REMINDER_INVALID_EVENT', 'Event start time is invalid', 400)
    }

    // Validate event hasn't already started
    const now = new Date()
    if (event.startTime <= now) {
        throw new AppError('REMINDER_EVENT_PAST', 'Cannot set reminder for past event', 400)
    }

    // Normalize and validate reminder minutes
    const normalizedMinutes = normalizeReminderMinutes(minutesBeforeStart)

    // Compute remindAt time
    const remindAt = computeRemindAt(event.startTime, normalizedMinutes)

    // Upsert reminder (create or update existing)
    const reminder = await prisma.eventReminder.upsert({
        where: {
            eventId_userId: {
                eventId: event.id,
                userId,
            },
        },
        create: {
            eventId: event.id,
            userId,
            minutesBeforeStart: normalizedMinutes,
            remindAt,
            status: ReminderStatus.PENDING,
        },
        update: {
            minutesBeforeStart: normalizedMinutes,
            remindAt,
            status: ReminderStatus.PENDING,
            // Reset delivery tracking when updating
            deliveredAt: null,
            lastAttemptAt: null,
            failureReason: null,
        },
    })

    return serializeReminder(reminder)
}

/**
 * Cancels a reminder for an event
 * Returns true if cancelled, false if already sent or doesn't exist
 */
export async function cancelReminderForEvent(eventId: string, userId: string): Promise<boolean> {
    try {
        // Find the reminder
        const reminder = await prisma.eventReminder.findUnique({
            where: {
                eventId_userId: {
                    eventId,
                    userId,
                },
            },
        })

        if (!reminder) {
            return false
        }

        // Don't cancel if already sent
        if (reminder.status === ReminderStatus.SENT) {
            return false
        }

        // Update status to CANCELLED
        try {
            await prisma.eventReminder.update({
                where: {
                    eventId_userId: {
                        eventId,
                        userId,
                    },
                },
                data: {
                    status: ReminderStatus.CANCELLED,
                },
            })
            return true
        } catch (error: unknown) {
            // Handle P2025 (record not found) gracefully
            if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
                return false
            }
            throw error
        }
    } catch (error: unknown) {
        // Re-throw non-P2025 errors
        if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
            return false
        }
        throw error
    }
}

/**
 * Deletes a reminder by ID
 * Verifies the reminder belongs to the user before deleting
 */
export async function deleteReminderById(reminderId: string, userId: string) {
    // Find the reminder and verify ownership
    const reminder = await prisma.eventReminder.findFirst({
        where: {
            id: reminderId,
            userId,
        },
    })

    if (!reminder) {
        throw new AppError('REMINDER_NOT_FOUND', 'Reminder not found', 404)
    }

    // Update status to CANCELLED (soft delete)
    const updated = await prisma.eventReminder.update({
        where: {
            id: reminderId,
        },
        data: {
            status: ReminderStatus.CANCELLED,
        },
    })

    return serializeReminder(updated)
}

/**
 * Returns the list of available reminder minute options
 */
export function getReminderOptions(): number[] {
    return [...REMINDER_MINUTE_OPTIONS]
}
