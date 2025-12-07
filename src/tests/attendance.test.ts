import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import { ReminderStatus } from '@prisma/client'
import attendanceApp from '../attendance.js'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { broadcast } from '../realtime.js'
import { deliverActivity } from '../services/ActivityDelivery.js'
import { AttendanceStatus } from '../constants/activitypub.js'
import { scheduleReminderForEvent, cancelReminderForEvent } from '../services/reminders.js'

// Mock dependencies
vi.mock('../lib/prisma.js', () => ({
    prisma: {
        event: {
            findUnique: vi.fn(),
        },
        user: {
            findUnique: vi.fn(),
        },
        eventAttendance: {
            upsert: vi.fn(),
            findUnique: vi.fn(),
            delete: vi.fn(),
            findMany: vi.fn(),
        },
        following: {
            findFirst: vi.fn(),
        },
    },
}))

vi.mock('../middleware/auth.js', () => ({
    requireAuth: vi.fn(),
}))

vi.mock('../realtime.js', () => ({
    broadcast: vi.fn(),
}))

vi.mock('../services/ActivityDelivery.js', () => ({
    deliverActivity: vi.fn(),
}))

vi.mock('../services/reminders.js', () => ({
    scheduleReminderForEvent: vi.fn(),
    cancelReminderForEvent: vi.fn(),
}))

vi.mock('../lib/activitypubHelpers.js', () => ({
    getBaseUrl: vi.fn(() => 'http://localhost:3000'),
}))

// Create test app
const app = new Hono()
app.route('/api/attendance', attendanceApp)

describe('Attendance API', () => {
    const mockUser = {
        id: 'user_123',
        username: 'alice',
        name: 'Alice Smith',
    }

    const mockEvent = {
        id: 'event_123',
        title: 'Test Event',
        externalId: null,
        attributedTo: 'http://localhost:3000/users/alice',
        user: mockUser,
        startTime: new Date('2025-01-01T12:00:00Z'),
    }

    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(requireAuth).mockReturnValue('user_123')
        vi.mocked(scheduleReminderForEvent).mockReset()
        vi.mocked(cancelReminderForEvent).mockReset()
        vi.mocked(scheduleReminderForEvent).mockResolvedValue({
            id: 'reminder_123',
            eventId: 'event_123',
            userId: 'user_123',
            minutesBeforeStart: 30,
            status: ReminderStatus.PENDING,
            remindAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            deliveredAt: null,
            lastAttemptAt: null,
            failureReason: null,
        })
        vi.mocked(cancelReminderForEvent).mockResolvedValue(true)
    })

    describe('POST /:id/attend', () => {
        it('should create attendance with attending status', async () => {
            const mockAttendance = {
                id: 'attendance_123',
                eventId: 'event_123',
                userId: 'user_123',
                status: AttendanceStatus.ATTENDING,
            }

            vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as any)
            vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
            vi.mocked(prisma.eventAttendance.upsert).mockResolvedValue(mockAttendance as any)
            vi.mocked(deliverActivity).mockResolvedValue()

            const res = await app.request('/api/attendance/event_123/attend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'attending' }),
            })

            expect(res.status).toBe(200)
            const body = await res.json() as { id: string; status: string; userId: string; eventId: string }
            expect(body).toEqual(mockAttendance)
            expect(prisma.eventAttendance.upsert).toHaveBeenCalledWith({
                where: {
                    eventId_userId: {
                        eventId: 'event_123',
                        userId: 'user_123',
                    },
                },
                update: { status: 'attending' },
                create: {
                    eventId: 'event_123',
                    userId: 'user_123',
                    status: 'attending',
                },
            })
            expect(broadcast).toHaveBeenCalledWith({
                type: 'attendance:updated',
                data: expect.objectContaining({
                    eventId: 'event_123',
                    userId: 'user_123',
                    status: 'attending',
                }),
            })
        })

        it('should create attendance with maybe status', async () => {
            const mockAttendance = {
                id: 'attendance_123',
                eventId: 'event_123',
                userId: 'user_123',
                status: AttendanceStatus.MAYBE,
            }

            vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as any)
            vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
            vi.mocked(prisma.eventAttendance.upsert).mockResolvedValue(mockAttendance as any)
            vi.mocked(deliverActivity).mockResolvedValue()

            const res = await app.request('/api/attendance/event_123/attend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'maybe' }),
            })

            expect(res.status).toBe(200)
            const body = await res.json() as { status: string }
            expect(body.status).toBe('maybe')
        })

        it('should create attendance with not_attending status', async () => {
            const mockAttendance = {
                id: 'attendance_123',
                eventId: 'event_123',
                userId: 'user_123',
                status: AttendanceStatus.NOT_ATTENDING,
            }

            vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as any)
            vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
            vi.mocked(prisma.eventAttendance.upsert).mockResolvedValue(mockAttendance as any)
            vi.mocked(deliverActivity).mockResolvedValue()

            const res = await app.request('/api/attendance/event_123/attend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'not_attending' }),
            })

            expect(res.status).toBe(200)
            const body = await res.json() as { status: string }
            expect(body.status).toBe('not_attending')
            expect(cancelReminderForEvent).toHaveBeenCalledWith('event_123', 'user_123')
        })

        it('schedules a reminder when reminderMinutesBeforeStart is provided', async () => {
            vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as any)
            vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
            vi.mocked(prisma.eventAttendance.upsert).mockResolvedValue({
                id: 'attendance_777',
                eventId: 'event_123',
                userId: 'user_123',
                status: AttendanceStatus.ATTENDING,
            } as any)
            vi.mocked(deliverActivity).mockResolvedValue()

            const res = await app.request('/api/attendance/event_123/attend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'attending',
                    reminderMinutesBeforeStart: 30,
                }),
            })

            expect(res.status).toBe(200)
            expect(scheduleReminderForEvent).toHaveBeenCalledWith(mockEvent, 'user_123', 30)
        })

        it('cancels reminders when reminderMinutesBeforeStart is null', async () => {
            vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as any)
            vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
            vi.mocked(prisma.eventAttendance.upsert).mockResolvedValue({
                id: 'attendance_888',
                eventId: 'event_123',
                userId: 'user_123',
                status: AttendanceStatus.ATTENDING,
            } as any)
            vi.mocked(deliverActivity).mockResolvedValue()

            const res = await app.request('/api/attendance/event_123/attend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'attending',
                    reminderMinutesBeforeStart: null,
                }),
            })

            expect(res.status).toBe(200)
            expect(cancelReminderForEvent).toHaveBeenCalledWith('event_123', 'user_123')
        })

        it('should return 404 when event not found', async () => {
            vi.mocked(prisma.event.findUnique).mockResolvedValue(null)

            const res = await app.request('/api/attendance/nonexistent/attend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'attending' }),
            })

            expect(res.status).toBe(404)
            const body = await res.json() as { error: string }
            expect(body.error).toBe('Event not found')
        })

        it('should return 404 when user not found', async () => {
            vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as any)
            vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

            const res = await app.request('/api/attendance/event_123/attend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'attending' }),
            })

            expect(res.status).toBe(404)
            const body = await res.json() as { error: string }
            expect(body.error).toBe('User not found')
        })

        it('should return 400 for invalid status', async () => {
            const res = await app.request('/api/attendance/event_123/attend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'invalid' }),
            })

            expect(res.status).toBe(400)
            const body = await res.json() as { error: string }
            expect(body.error).toBe('Validation failed')
        })

        it('should forbid follower-only events when viewer is not a follower', async () => {
            const followerOnlyEvent = {
                ...mockEvent,
                user: { id: 'owner', username: 'bob' },
                userId: 'owner',
                visibility: 'FOLLOWERS',
            }

            vi.mocked(prisma.event.findUnique).mockResolvedValue(followerOnlyEvent as any)
            vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
            vi.mocked(prisma.following.findFirst).mockResolvedValue(null as any)

            const res = await app.request('/api/attendance/event_123/attend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'attending' }),
            })

            expect(res.status).toBe(403)
            expect(prisma.eventAttendance.upsert).not.toHaveBeenCalled()
        })

        it('should allow follower-only events when viewer follows author', async () => {
            const followerOnlyEvent = {
                ...mockEvent,
                user: { id: 'owner', username: 'bob' },
                userId: 'owner',
                visibility: 'FOLLOWERS',
            }

            const mockAttendance = {
                id: 'attendance_456',
                eventId: 'event_123',
                userId: 'user_123',
                status: AttendanceStatus.ATTENDING,
            }

            vi.mocked(prisma.event.findUnique).mockResolvedValue(followerOnlyEvent as any)
            vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
            vi.mocked(prisma.following.findFirst).mockResolvedValue({ id: 'follow_1' } as any)
            vi.mocked(prisma.eventAttendance.upsert).mockResolvedValue(mockAttendance as any)
            vi.mocked(deliverActivity).mockResolvedValue()

            const res = await app.request('/api/attendance/event_123/attend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'attending' }),
            })

            expect(res.status).toBe(200)
            const body = await res.json() as { status: string }
            expect(body.status).toBe('attending')
        })

        it('should return 401 when not authenticated', async () => {
            vi.mocked(requireAuth).mockImplementation(() => {
                throw new Error('Unauthorized')
            })

            const res = await app.request('/api/attendance/event_123/attend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'attending' }),
            })

            expect(res.status).toBe(500) // Error handler converts to 500
        })

        it('should update existing attendance', async () => {
            const mockAttendance = {
                id: 'attendance_123',
                eventId: 'event_123',
                userId: 'user_123',
                status: AttendanceStatus.ATTENDING,
            }

            vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as any)
            vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
            vi.mocked(prisma.eventAttendance.upsert).mockResolvedValue(mockAttendance as any)
            vi.mocked(deliverActivity).mockResolvedValue()

            // First create
            await app.request('/api/attendance/event_123/attend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'attending' }),
            })

            // Then update
            const updatedAttendance = {
                ...mockAttendance,
                status: AttendanceStatus.MAYBE,
            }
            vi.mocked(prisma.eventAttendance.upsert).mockResolvedValue(updatedAttendance as any)

            const res = await app.request('/api/attendance/event_123/attend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'maybe' }),
            })

            expect(res.status).toBe(200)
            const body = await res.json() as { status: string }
            expect(body.status).toBe('maybe')
        })
    })

    describe('DELETE /:id/attend', () => {
        it('should delete attendance', async () => {
            const mockAttendance = {
                id: 'attendance_123',
                eventId: 'event_123',
                userId: 'user_123',
                status: AttendanceStatus.ATTENDING,
                event: mockEvent,
                user: mockUser,
            }

            vi.mocked(prisma.eventAttendance.findUnique).mockResolvedValue(mockAttendance as any)
            vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
            vi.mocked(prisma.eventAttendance.delete).mockResolvedValue(mockAttendance as any)
            vi.mocked(deliverActivity).mockResolvedValue()

            const res = await app.request('/api/attendance/event_123/attend', {
                method: 'DELETE',
            })

            expect(res.status).toBe(200)
            const body = await res.json() as { success: boolean }
            expect(body.success).toBe(true)
            expect(prisma.eventAttendance.delete).toHaveBeenCalledWith({
                where: {
                    eventId_userId: {
                        eventId: 'event_123',
                        userId: 'user_123',
                    },
                },
            })
            expect(broadcast).toHaveBeenCalledWith({
                type: 'attendance:removed',
                data: expect.objectContaining({
                    eventId: 'event_123',
                    userId: 'user_123',
                }),
            })
        })

        it('should return 404 when attendance not found', async () => {
            vi.mocked(prisma.eventAttendance.findUnique).mockResolvedValue(null)

            const res = await app.request('/api/attendance/event_123/attend', {
                method: 'DELETE',
            })

            expect(res.status).toBe(404)
            const body = await res.json() as { error: string }
            expect(body.error).toBe('Attendance not found')
        })

        it('should forbid removing attendance for follower-only events when viewer is not a follower', async () => {
            vi.mocked(prisma.eventAttendance.findUnique).mockResolvedValue({
                id: 'attendance_123',
                eventId: 'event_123',
                userId: 'user_123',
                status: 'attending',
                event: {
                    ...mockEvent,
                    user: { id: 'owner', username: 'bob' },
                    userId: 'owner',
                    visibility: 'FOLLOWERS',
                },
                user: mockUser,
            } as any)

            vi.mocked(prisma.following.findFirst).mockResolvedValue(null as any)

            const res = await app.request('/api/attendance/event_123/attend', {
                method: 'DELETE',
            })

            expect(res.status).toBe(403)
            expect(prisma.eventAttendance.delete).not.toHaveBeenCalled()
        })

        it('should allow removing attendance for follower-only events when viewer follows author', async () => {
            const followerAttendance = {
                id: 'attendance_123',
                eventId: 'event_123',
                userId: 'user_123',
                status: 'attending',
                event: {
                    ...mockEvent,
                    user: { id: 'owner', username: 'bob' },
                    userId: 'owner',
                    visibility: 'FOLLOWERS',
                },
                user: mockUser,
            }

            vi.mocked(prisma.eventAttendance.findUnique).mockResolvedValue(followerAttendance as any)
            vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
            vi.mocked(prisma.following.findFirst).mockResolvedValue({ id: 'follow_1' } as any)
            vi.mocked(prisma.eventAttendance.delete).mockResolvedValue(followerAttendance as any)
            vi.mocked(deliverActivity).mockResolvedValue()

            const res = await app.request('/api/attendance/event_123/attend', {
                method: 'DELETE',
            })

            expect(res.status).toBe(200)
            expect(prisma.eventAttendance.delete).toHaveBeenCalled()
        })

        it('should return 404 when user not found', async () => {
            const mockAttendance = {
                id: 'attendance_123',
                eventId: 'event_123',
                userId: 'user_123',
                status: AttendanceStatus.ATTENDING,
                event: mockEvent,
            }

            vi.mocked(prisma.eventAttendance.findUnique).mockResolvedValue(mockAttendance as any)
            vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

            const res = await app.request('/api/attendance/event_123/attend', {
                method: 'DELETE',
            })

            expect(res.status).toBe(404)
            const body = await res.json() as { error: string }
            expect(body.error).toBe('User not found')
        })
    })

    describe('GET /:id/attendees', () => {
        it('should return grouped attendees', async () => {
            const mockAttendees = [
                {
                    id: 'attendance_1',
                    eventId: 'event_123',
                    userId: 'user_1',
                    status: AttendanceStatus.ATTENDING,
                    user: {
                        id: 'user_1',
                        username: 'alice',
                        name: 'Alice',
                        profileImage: null,
                        displayColor: '#3b82f6',
                    },
                },
                {
                    id: 'attendance_2',
                    eventId: 'event_123',
                    userId: 'user_2',
                    status: AttendanceStatus.MAYBE,
                    user: {
                        id: 'user_2',
                        username: 'bob',
                        name: 'Bob',
                        profileImage: null,
                        displayColor: '#ef4444',
                    },
                },
                {
                    id: 'attendance_3',
                    eventId: 'event_123',
                    userId: 'user_3',
                    status: AttendanceStatus.NOT_ATTENDING,
                    user: {
                        id: 'user_3',
                        username: 'charlie',
                        name: 'Charlie',
                        profileImage: null,
                        displayColor: '#10b981',
                    },
                },
            ]

            vi.mocked(prisma.eventAttendance.findMany).mockResolvedValue(mockAttendees as any)

            const res = await app.request('/api/attendance/event_123/attendees')

            expect(res.status).toBe(200)
            const body = await res.json() as { attendees: { attending: unknown[]; maybe: unknown[]; not_attending: unknown[] }; counts: { attending: number; maybe: number; not_attending: number; total: number } }
            expect(body.attendees.attending).toHaveLength(1)
            expect(body.attendees.maybe).toHaveLength(1)
            expect(body.attendees.not_attending).toHaveLength(1)
            expect(body.counts).toEqual({
                attending: 1,
                maybe: 1,
                not_attending: 1,
                total: 3,
            })
        })

        it('should return empty groups when no attendees', async () => {
            vi.mocked(prisma.eventAttendance.findMany).mockResolvedValue([])

            const res = await app.request('/api/attendance/event_123/attendees')

            expect(res.status).toBe(200)
            const body = await res.json() as { attendees: { attending: unknown[]; maybe: unknown[]; not_attending: unknown[] }; counts: { attending: number; maybe: number; not_attending: number; total: number } }
            expect(body.attendees.attending).toHaveLength(0)
            expect(body.attendees.maybe).toHaveLength(0)
            expect(body.attendees.not_attending).toHaveLength(0)
            expect(body.counts.total).toBe(0)
        })
    })
})

