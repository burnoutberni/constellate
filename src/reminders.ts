import { Hono } from 'hono'
import { z } from 'zod'
import { requireAuth } from './middleware/auth.js'
import { lenientRateLimit, moderateRateLimit } from './middleware/rateLimit.js'
import { prisma } from './lib/prisma.js'
import { canUserViewEvent } from './lib/eventVisibility.js'
import { Errors, handleError } from './lib/errors.js'
import {
    listEventRemindersForUser,
    scheduleReminderForEvent,
    cancelReminderForEvent,
    deleteReminderById,
    getReminderOptions,
    REMINDER_MINUTE_OPTIONS,
} from './services/reminders.js'

const app = new Hono()

const reminderRequestSchema = z.object({
    minutesBeforeStart: z.number().int({ message: 'Reminder offset must be an integer' }).refine(
        (val) => REMINDER_MINUTE_OPTIONS.includes(val as typeof REMINDER_MINUTE_OPTIONS[number]),
        { message: `Reminder offset must be one of: ${REMINDER_MINUTE_OPTIONS.join(', ')}` }
    ),
})

async function loadEventOrThrow(eventId: string) {
    const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: {
            user: {
                select: {
                    id: true,
                    username: true,
                },
            },
        },
    })

    if (!event) {
        throw Errors.notFound('Event')
    }

    return event
}

async function ensureCanAccess(eventId: string, userId: string) {
    const event = await loadEventOrThrow(eventId)
    const canView = await canUserViewEvent(event, userId)
    if (!canView) {
        throw Errors.forbidden('You do not have access to this event')
    }
    return event
}

app.get('/:eventId/reminders', lenientRateLimit, async (c) => {
    try {
        const userId = requireAuth(c)
        const { eventId } = c.req.param()
        await ensureCanAccess(eventId, userId)

        const reminders = await listEventRemindersForUser(eventId, userId)
        return c.json({ reminders, options: getReminderOptions() })
    } catch (error) {
        return handleError(error, c)
    }
})

app.post('/:eventId/reminders', moderateRateLimit, async (c) => {
    try {
        const userId = requireAuth(c)
        const { eventId } = c.req.param()
        const payload = reminderRequestSchema.parse(await c.req.json())
        const event = await ensureCanAccess(eventId, userId)

        const reminder = await scheduleReminderForEvent(event, userId, payload.minutesBeforeStart)
        return c.json({ reminder }, 201)
    } catch (error) {
        return handleError(error, c)
    }
})

app.delete('/:eventId/reminders', moderateRateLimit, async (c) => {
    try {
        const userId = requireAuth(c)
        const { eventId } = c.req.param()
        await ensureCanAccess(eventId, userId)
        await cancelReminderForEvent(eventId, userId)
        return c.json({ success: true })
    } catch (error) {
        return handleError(error, c)
    }
})

app.delete('/:eventId/reminders/:reminderId', moderateRateLimit, async (c) => {
    try {
        const userId = requireAuth(c)
        const { eventId, reminderId } = c.req.param()
        await ensureCanAccess(eventId, userId)
        const reminder = await deleteReminderById(reminderId, userId)
        return c.json({ reminder })
    } catch (error) {
        return handleError(error, c)
    }
})

export default app
