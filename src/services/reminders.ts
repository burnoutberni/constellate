import type { Event, EventReminder, ReminderStatus } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { AppError } from '../lib/errors.js'

export const REMINDER_MINUTE_OPTIONS = [5, 15, 30, 60, 120, 1440] as const
export type ReminderMinutesOption = (typeof REMINDER_MINUTE_OPTIONS)[number]

type EventForReminder = Pick<Event, 'id' | 'startTime' | 'title'>

type SerializableReminder = EventReminder

function ensureValidEventStart(event: EventForReminder) {
    if (!(event.startTime instanceof Date) || Number.isNaN(event.startTime.getTime())) {
        throw new AppError('REMINDER_INVALID_EVENT', 'Event start time is invalid', 400)
    }

    if (event.startTime.getTime() <= Date.now()) {
        throw new AppError('REMINDER_EVENT_PAST', 'Cannot schedule a reminder for an event that has already started', 400)
    }
}

function normalizeReminderMinutes(minutes: number): ReminderMinutesOption {
    if (!REMINDER_MINUTE_OPTIONS.includes(minutes as ReminderMinutesOption)) {
        throw new AppError(
            'REMINDER_INTERVAL_UNSUPPORTED',
            `Unsupported reminder offset. Allowed values: ${REMINDER_MINUTE_OPTIONS.join(', ')}`,
            400
        )
    }

    return minutes as ReminderMinutesOption
}

function computeRemindAt(startTime: Date, minutesBeforeStart: number) {
    const remindTimestamp = startTime.getTime() - minutesBeforeStart * 60000
    if (!Number.isFinite(remindTimestamp)) {
        throw new AppError('REMINDER_COMPUTE_ERROR', 'Failed to compute reminder time', 400)
    }
    const remindAt = new Date(remindTimestamp)
    if (remindAt.getTime() <= Date.now()) {
        throw new AppError('REMINDER_TOO_LATE', 'Reminder time is in the past. The event is starting too soon for this reminder offset.', 400)
    }
    return remindAt
}

export function serializeReminder(reminder: SerializableReminder) {
    return {
        id: reminder.id,
        eventId: reminder.eventId,
        userId: reminder.userId,
        minutesBeforeStart: reminder.minutesBeforeStart,
        status: reminder.status,
        remindAt: reminder.remindAt.toISOString(),
        createdAt: reminder.createdAt.toISOString(),
        updatedAt: reminder.updatedAt.toISOString(),
        deliveredAt: reminder.deliveredAt ? reminder.deliveredAt.toISOString() : null,
        lastAttemptAt: reminder.lastAttemptAt ? reminder.lastAttemptAt.toISOString() : null,
        failureReason: reminder.failureReason ?? null,
    }
}

export function formatReminderList(reminders: SerializableReminder[]) {
    return reminders.map(serializeReminder)
}

export async function listEventRemindersForUser(eventId: string, userId: string) {
    const reminders = await prisma.eventReminder.findMany({
        where: { eventId, userId },
        orderBy: { remindAt: 'asc' },
    })

    return formatReminderList(reminders)
}

export async function scheduleReminderForEvent(
    event: EventForReminder,
    userId: string,
    minutesBeforeStart: number
) {
    ensureValidEventStart(event)
    const normalizedMinutes = normalizeReminderMinutes(minutesBeforeStart)
    const remindAt = computeRemindAt(event.startTime, normalizedMinutes)

    const reminder = await prisma.eventReminder.upsert({
        where: {
            eventId_userId: {
                eventId: event.id,
                userId,
            },
        },
        update: {
            minutesBeforeStart: normalizedMinutes,
            remindAt,
            status: 'PENDING' satisfies ReminderStatus,
            deliveredAt: null,
            lastAttemptAt: null,
            failureReason: null,
        },
        create: {
            eventId: event.id,
            userId,
            minutesBeforeStart: normalizedMinutes,
            remindAt,
        },
    })

    return serializeReminder(reminder)
}

export async function cancelReminderForEvent(eventId: string, userId: string) {
    const updated = await prisma.eventReminder.updateMany({
        where: {
            eventId,
            userId,
            status: {
                in: ['PENDING', 'SENDING', 'FAILED'] satisfies ReminderStatus[],
            },
        },
        data: {
            status: 'CANCELLED' satisfies ReminderStatus,
            // Preserve diagnostic fields for debugging and audit trails
            // deliveredAt, lastAttemptAt, and failureReason are not cleared
        },
    })

    return updated.count > 0
}

export async function deleteReminderById(reminderId: string, userId: string) {
    const reminder = await prisma.eventReminder.findFirst({
        where: {
            id: reminderId,
            userId,
        },
    })

    if (!reminder) {
        throw new AppError('REMINDER_NOT_FOUND', 'Reminder not found', 404)
    }

    const updated = await prisma.eventReminder.update({
        where: { id: reminderId },
        data: {
            status: 'CANCELLED' satisfies ReminderStatus,
            // Preserve diagnostic fields for debugging and audit trails
            // deliveredAt, lastAttemptAt, and failureReason are not cleared
        },
    })

    return serializeReminder(updated)
}

export function getReminderOptions() {
    return [...REMINDER_MINUTE_OPTIONS]
}
