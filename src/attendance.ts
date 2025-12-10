/**
 * Event Attendance (RSVP)
 * Handles attendance status with ActivityPub federation
 */

import { Hono } from 'hono'
import { z, ZodError } from 'zod'
import type { Event, User, EventAttendance } from '@prisma/client'
import {
    buildAttendingActivity,
    buildNotAttendingActivity,
    buildMaybeAttendingActivity,
    buildUndoActivity,
} from './services/ActivityBuilder.js'
import { deliverActivity } from './services/ActivityDelivery.js'
import type { Activity, AcceptActivity, RejectActivity, TentativeAcceptActivity } from './lib/activitypubSchemas.js'
import { AttendanceStatus } from './constants/activitypub.js'
import { requireAuth } from './middleware/auth.js'
import { moderateRateLimit } from './middleware/rateLimit.js'
import { broadcast } from './realtime.js'
import { getBaseUrl } from './lib/activitypubHelpers.js'
import { prisma } from './lib/prisma.js'
import { canUserViewEvent, isPublicVisibility } from './lib/eventVisibility.js'
import { scheduleReminderForEvent, cancelReminderForEvent } from './services/reminders.js'
import { AppError } from './lib/errors.js'
import { updateEventPopularityScore } from './services/popularityUpdater.js'

const app = new Hono()

type EventWithOwner = Event & { user: User | null }
type AttendanceState = (typeof AttendanceStatus)[keyof typeof AttendanceStatus]
type HttpErrorStatus = 400 | 401 | 403 | 404 | 500

class HttpError extends Error {
    status: number
    body: Record<string, unknown>

    constructor(status: number, body: Record<string, unknown>) {
        super(typeof body.error === 'string' ? String(body.error) : 'HttpError')
        this.status = status
        this.body = body
    }
}

function requireResource<T>(value: T | null | undefined, status: number, message: string): T {
    if (!value) {
        throw new HttpError(status, { error: message })
    }
    return value
}

async function ensureViewerCanAccess(event: EventWithOwner, viewerId: string) {
    const canView = await canUserViewEvent(event, viewerId)
    if (!canView) {
        throw new HttpError(403, { error: 'Forbidden' })
    }
}

function shouldNotifyFollowers(visibility: 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE' | 'UNLISTED' | null | undefined) {
    return visibility === 'PUBLIC' || visibility === 'FOLLOWERS'
}

function resolveEventFollowersUrl(event: EventWithOwner, baseUrl: string, notifyFollowers: boolean) {
    if (!notifyFollowers) {
        return undefined
    }

    if (event.user) {
        return `${baseUrl}/users/${event.user.username}/followers`
    }

    if (event.attributedTo?.startsWith(baseUrl)) {
        const username = event.attributedTo.split('/').pop()
        if (username) {
            return `${baseUrl}/users/${username}/followers`
        }
    }

    return undefined
}

function getUserFollowersUrl(user: Pick<User, 'username'>, baseUrl: string) {
    return `${baseUrl}/users/${user.username}/followers`
}

function normalizeRecipientsField(value?: string | string[]) {
    if (!value) {
        return []
    }
    return Array.isArray(value) ? value : [value]
}

async function deliverNormalizedActivity(activity: Activity, userId: string) {
    const addressing = {
        to: normalizeRecipientsField(activity.to),
        cc: normalizeRecipientsField(activity.cc),
        bcc: [] as string[],
    }

    await deliverActivity(activity, addressing, userId)
}

interface AttendanceContext {
    eventUrl: string
    eventAuthorUrl: string
    eventAuthorFollowersUrl?: string
    userFollowersUrl: string
    isPublic: boolean
}

function buildAttendanceContext(event: EventWithOwner, user: User): AttendanceContext {
    const baseUrl = getBaseUrl()
    const eventAuthorUrl = event.attributedTo!
    const notifyFollowers = shouldNotifyFollowers(event.visibility)

    return {
        eventUrl: event.externalId || `${baseUrl}/events/${event.id}`,
        eventAuthorUrl,
        eventAuthorFollowersUrl: resolveEventFollowersUrl(event, baseUrl, notifyFollowers),
        userFollowersUrl: getUserFollowersUrl(user, baseUrl),
        isPublic: isPublicVisibility(event.visibility),
    }
}

function buildAttendanceActivityForStatus(
    status: AttendanceState,
    user: User,
    context: AttendanceContext
): AcceptActivity | RejectActivity | TentativeAcceptActivity {
    if (status === AttendanceStatus.ATTENDING) {
        return buildAttendingActivity(
            user,
            context.eventUrl,
            context.eventAuthorUrl,
            context.eventAuthorFollowersUrl,
            context.userFollowersUrl,
            context.isPublic
        )
    }

    if (status === AttendanceStatus.NOT_ATTENDING) {
        return buildNotAttendingActivity(
            user,
            context.eventUrl,
            context.eventAuthorUrl,
            context.eventAuthorFollowersUrl,
            context.userFollowersUrl,
            context.isPublic
        )
    }

    return buildMaybeAttendingActivity(
        user,
        context.eventUrl,
        context.eventAuthorUrl,
        context.eventAuthorFollowersUrl,
        context.userFollowersUrl,
        context.isPublic
    )
}

// Attendance validation schema
const AttendanceSchema = z.object({
    status: z.enum(['attending', 'maybe', 'not_attending']),
    reminderMinutesBeforeStart: z.number().int().optional().nullable(),
})

// Set or update attendance status
app.post('/:id/attend', moderateRateLimit, async (c) => {
    try {
        const { id } = c.req.param()
        const userId = requireAuth(c)

        const body = await c.req.json()
        const { status, reminderMinutesBeforeStart } = AttendanceSchema.parse(body)

        const event = requireResource(
            (await prisma.event.findUnique({
                where: { id },
                include: { user: true },
            })) as EventWithOwner | null,
            404,
            'Event not found'
        )

        await ensureViewerCanAccess(event, userId)

        const user = requireResource(
            await prisma.user.findUnique({
                where: { id: userId },
            }),
            404,
            'User not found'
        )

        const attendance = await prisma.eventAttendance.upsert({
            where: {
                eventId_userId: {
                    eventId: id,
                    userId,
                },
            },
            update: {
                status,
            },
            create: {
                eventId: id,
                userId,
                status,
            },
        })

        // Build and deliver activity
        const context = buildAttendanceContext(event, user)
        const activity = buildAttendanceActivityForStatus(status, user, context)
        await deliverNormalizedActivity(activity, userId)

        // Broadcast real-time update
        broadcast({
            type: 'attendance:updated',
            data: {
                eventId: id,
                userId,
                status,
                username: user.username,
                name: user.name,
            },
        })

        // Handle reminder operations - distinguish validation errors from unexpected errors
        try {
            if (status === AttendanceStatus.NOT_ATTENDING) {
                await cancelReminderForEvent(id, userId)
            } else if (reminderMinutesBeforeStart === null) {
                await cancelReminderForEvent(id, userId)
            } else if (typeof reminderMinutesBeforeStart === 'number') {
                await scheduleReminderForEvent(event, userId, reminderMinutesBeforeStart)
            }
        } catch (reminderError) {
            // Only surface reminder-specific validation errors to the user
            // Check for reminder error codes to ensure we're not catching unrelated validation errors
            if (
                reminderError instanceof AppError &&
                reminderError.statusCode === 400 &&
                typeof reminderError.code === 'string' &&
                reminderError.code.startsWith('REMINDER_')
            ) {
                // Re-throw reminder-specific validation errors so they're returned to the client
                throw reminderError
            }
            // Log unexpected errors but allow attendance update to succeed
            console.error('Unexpected reminder operation error during attendance update:', reminderError)
        }

        // Update popularity score in background (non-blocking)
        updateEventPopularityScore(id).catch(err => {
            console.error(`Failed to update popularity score for event ${id}:`, err)
        })

        return c.json(attendance)
    } catch (error) {
        if (error instanceof ZodError) {
            return c.json({ error: 'Validation failed', details: error.issues }, 400 as const)
        }
        if (error instanceof HttpError) {
            return c.json(error.body, error.status as HttpErrorStatus)
        }
        if (error instanceof AppError) {
            return c.json({ error: error.code, message: error.message }, error.statusCode as HttpErrorStatus)
        }
        console.error('Error setting attendance:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Remove attendance
app.delete('/:id/attend', moderateRateLimit, async (c) => {
    try {
        const { id } = c.req.param()
        const userId = requireAuth(c)

        const attendance = requireResource(
            (await prisma.eventAttendance.findUnique({
                where: {
                    eventId_userId: {
                        eventId: id,
                        userId,
                    },
                },
                include: {
                    event: { include: { user: true } },
                    user: true,
                },
            })) as (EventAttendance & { event: EventWithOwner; user: User }) | null,
            404,
            'Attendance not found'
        )

        await ensureViewerCanAccess(attendance.event, userId)

        const user = requireResource(
            await prisma.user.findUnique({
                where: { id: userId },
            }),
            404,
            'User not found'
        )

        await prisma.eventAttendance.delete({
            where: {
                eventId_userId: {
                    eventId: id,
                    userId,
                },
            },
        })

        const context = buildAttendanceContext(attendance.event, user)
        const originalActivity = buildAttendanceActivityForStatus(attendance.status as AttendanceState, user, context)
        const undoActivity = buildUndoActivity(user, originalActivity)
        await deliverNormalizedActivity(undoActivity, userId)

        broadcast({
            type: 'attendance:removed',
            data: {
                eventId: id,
                userId,
                username: user.username,
                name: user.name,
            },
        })

        // Handle reminder cancellation - don't fail attendance removal if reminder fails
        try {
            await cancelReminderForEvent(id, userId)
        } catch (reminderError) {
            // Log reminder error but allow attendance removal to succeed
            console.error('Reminder cancellation failed during attendance removal:', reminderError)
        }

        // Update popularity score in background (non-blocking)
        updateEventPopularityScore(id).catch(err => {
            console.error(`Failed to update popularity score for event ${id}:`, err)
        })

        return c.json({ success: true })
    } catch (error) {
        if (error instanceof HttpError) {
            return c.json(error.body, error.status as HttpErrorStatus)
        }
        if (error instanceof AppError) {
            return c.json({ error: error.code, message: error.message }, error.statusCode as HttpErrorStatus)
        }
        console.error('Error removing attendance:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Get attendees
app.get('/:id/attendees', async (c) => {
    try {
        const { id } = c.req.param()

        const attendees = await prisma.eventAttendance.findMany({
            where: { eventId: id },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        name: true,
                        profileImage: true,
                        displayColor: true,
                    },
                },
            },
        })

        // Group by status
        const grouped = {
            attending: attendees.filter((a) => a.status === AttendanceStatus.ATTENDING),
            maybe: attendees.filter((a) => a.status === AttendanceStatus.MAYBE),
            not_attending: attendees.filter((a) => a.status === AttendanceStatus.NOT_ATTENDING),
        }

        return c.json({
            attendees: grouped,
            counts: {
                attending: grouped.attending.length,
                maybe: grouped.maybe.length,
                not_attending: grouped.not_attending.length,
                total: attendees.length,
            },
        })
    } catch (error) {
        console.error('Error getting attendees:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

export default app
