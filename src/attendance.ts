/**
 * Event Attendance (RSVP)
 * Handles attendance status with ActivityPub federation
 */

import { Hono } from 'hono'
import { z, ZodError } from 'zod'
import {
    buildAttendingActivity,
    buildNotAttendingActivity,
    buildMaybeAttendingActivity,
    buildUndoActivity,
} from './services/ActivityBuilder.js'
import { AttendanceStatus } from './constants/activitypub.js'
import { requireAuth } from './middleware/auth.js'
import { moderateRateLimit } from './middleware/rateLimit.js'
import { broadcast } from './realtime.js'
import { getBaseUrl } from './lib/activitypubHelpers.js'
import { prisma } from './lib/prisma.js'

const app = new Hono()

// Attendance validation schema
const AttendanceSchema = z.object({
    status: z.enum(['attending', 'maybe', 'not_attending']),
})

// Set or update attendance status
app.post('/:id/attend', moderateRateLimit, async (c) => {
    try {
        const { id } = c.req.param()
        const userId = requireAuth(c)

        const body = await c.req.json()
        const { status } = AttendanceSchema.parse(body)

        // Get event
        const event = await prisma.event.findUnique({
            where: { id },
            include: { user: true },
        })

        if (!event) {
            return c.json({ error: 'Event not found' }, 404)
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
        })

        if (!user) {
            return c.json({ error: 'User not found' }, 404)
        }

        // Create or update attendance
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
        const baseUrl = getBaseUrl()
        const eventUrl = event.externalId || `${baseUrl}/events/${id}`
        const eventAuthorUrl = event.attributedTo!

        // Get event author's followers URL
        let eventAuthorFollowersUrl: string | undefined
        if (event.user) {
            eventAuthorFollowersUrl = `${baseUrl}/users/${event.user.username}/followers`
        } else if (eventAuthorUrl.startsWith(baseUrl)) {
            const username = eventAuthorUrl.split('/').pop()
            if (username) {
                eventAuthorFollowersUrl = `${baseUrl}/users/${username}/followers`
            }
        }

        // Get user's followers URL
        const userFollowersUrl = `${baseUrl}/users/${user.username}/followers`

        // Determine if event is public (default to true)
        const isPublic = true

        let activity
        if (status === AttendanceStatus.ATTENDING) {
            activity = buildAttendingActivity(
                user,
                eventUrl,
                eventAuthorUrl,
                eventAuthorFollowersUrl,
                userFollowersUrl,
                isPublic
            )
        } else if (status === AttendanceStatus.NOT_ATTENDING) {
            activity = buildNotAttendingActivity(
                user,
                eventUrl,
                eventAuthorUrl,
                eventAuthorFollowersUrl,
                userFollowersUrl,
                isPublic
            )
        } else {
            activity = buildMaybeAttendingActivity(
                user,
                eventUrl,
                eventAuthorUrl,
                eventAuthorFollowersUrl,
                userFollowersUrl,
                isPublic
            )
        }

        // Build addressing from activity's to/cc fields
        // The activity already includes userFollowersUrl in cc, so we just use the activity's addressing
        const { deliverActivity } = await import('./services/ActivityDelivery.js')
        const addressing = {
            to: activity.to || [],
            cc: activity.cc || [],
            bcc: [],
        }

        // Deliver using addressing (will resolve all recipients and deduplicate inboxes)
        await deliverActivity(activity, addressing, userId)

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

        return c.json(attendance)
    } catch (error) {
        if (error instanceof ZodError) {
            return c.json({ error: 'Validation failed', details: error.issues }, 400 as const)
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

        // Get existing attendance
        const attendance = await prisma.eventAttendance.findUnique({
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
        })

        if (!attendance) {
            return c.json({ error: 'Attendance not found' }, 404)
        }


        const user = await prisma.user.findUnique({
            where: { id: userId },
        })

        if (!user) {
            return c.json({ error: 'User not found' }, 404)
        }

        // Delete attendance
        await prisma.eventAttendance.delete({
            where: {
                eventId_userId: {
                    eventId: id,
                    userId,
                },
            },
        })

        // Build Undo activity
        const baseUrl = getBaseUrl()
        const eventUrl = attendance.event.externalId || `${baseUrl}/events/${id}`
        const eventAuthorUrl = attendance.event.attributedTo!

        // Get event author's followers URL
        let eventAuthorFollowersUrl: string | undefined
        if (attendance.event.user) {
            eventAuthorFollowersUrl = `${baseUrl}/users/${attendance.event.user.username}/followers`
        } else if (eventAuthorUrl.startsWith(baseUrl)) {
            const username = eventAuthorUrl.split('/').pop()
            if (username) {
                eventAuthorFollowersUrl = `${baseUrl}/users/${username}/followers`
            }
        }

        // Get user's followers URL
        const userFollowersUrl = `${baseUrl}/users/${user.username}/followers`

        const isPublic = true

        let originalActivity
        if (attendance.status === AttendanceStatus.ATTENDING) {
            originalActivity = buildAttendingActivity(
                user,
                eventUrl,
                eventAuthorUrl,
                eventAuthorFollowersUrl,
                userFollowersUrl,
                isPublic
            )
        } else if (attendance.status === AttendanceStatus.NOT_ATTENDING) {
            originalActivity = buildNotAttendingActivity(
                user,
                eventUrl,
                eventAuthorUrl,
                eventAuthorFollowersUrl,
                userFollowersUrl,
                isPublic
            )
        } else {
            originalActivity = buildMaybeAttendingActivity(
                user,
                eventUrl,
                eventAuthorUrl,
                eventAuthorFollowersUrl,
                userFollowersUrl,
                isPublic
            )
        }

        const undoActivity = buildUndoActivity(user, originalActivity)

        // Build addressing from undo activity's to/cc fields
        // The original activity already includes userFollowersUrl in cc, which is preserved in undo
        const { deliverActivity } = await import('./services/ActivityDelivery.js')
        
        let toArray: string[] = []
        if (Array.isArray(undoActivity.to)) {
            toArray = undoActivity.to
        } else if (undoActivity.to) {
            toArray = [undoActivity.to]
        }

        let ccArray: string[] = []
        if (Array.isArray(undoActivity.cc)) {
            ccArray = undoActivity.cc
        } else if (undoActivity.cc) {
            ccArray = [undoActivity.cc]
        }

        const addressing = {
            to: toArray,
            cc: ccArray,
            bcc: [] as string[],
        }

        // Deliver using addressing (will resolve all recipients and deduplicate inboxes)
        await deliverActivity(undoActivity, addressing, userId)

        // Broadcast real-time update
        broadcast({
            type: 'attendance:removed',
            data: {
                eventId: id,
                userId,
                username: user.username,
                name: user.name,
            },
        })

        return c.json({ success: true })
    } catch (error) {
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
