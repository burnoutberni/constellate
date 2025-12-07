import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import { ReminderStatus } from '@prisma/client'
import remindersApp from '../reminders.js'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { canUserViewEvent } from '../lib/eventVisibility.js'
import {
    listEventRemindersForUser,
    scheduleReminderForEvent,
    cancelReminderForEvent,
    deleteReminderById,
    getReminderOptions,
} from '../services/reminders.js'

vi.mock('../lib/prisma.js', () => ({
    prisma: {
        event: {
            findUnique: vi.fn(),
        },
    },
}))

vi.mock('../middleware/auth.js', () => ({
    requireAuth: vi.fn(),
}))

vi.mock('../lib/eventVisibility.js', () => ({
    canUserViewEvent: vi.fn(),
}))

vi.mock('../services/reminders.js', () => ({
    listEventRemindersForUser: vi.fn(),
    scheduleReminderForEvent: vi.fn(),
    cancelReminderForEvent: vi.fn(),
    deleteReminderById: vi.fn(),
    getReminderOptions: vi.fn(() => [5, 15, 30]),
}))

const app = new Hono()
app.route('/api/events', remindersApp)

const mockEvent = {
    id: 'event_1',
    title: 'Reminder Test',
    startTime: new Date('2025-02-01T10:00:00Z'),
    visibility: 'PUBLIC',
    userId: 'owner_1',
    attributedTo: 'http://localhost:3000/users/alice',
    user: {
        id: 'owner_1',
        username: 'alice',
    },
}

const mockReminder = {
    id: 'reminder_1',
    eventId: 'event_1',
    userId: 'user_1',
    minutesBeforeStart: 30,
    status: ReminderStatus.PENDING,
    remindAt: new Date('2025-02-01T09:30:00Z').toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deliveredAt: null,
    lastAttemptAt: null,
    failureReason: null,
}

describe('Event reminders API', () => {
    beforeEach(() => {
        vi.mocked(requireAuth).mockReturnValue('user_1')
        vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as any)
        vi.mocked(canUserViewEvent).mockResolvedValue(true)
        vi.mocked(listEventRemindersForUser).mockResolvedValue([mockReminder])
        vi.mocked(scheduleReminderForEvent).mockResolvedValue(mockReminder)
        vi.mocked(cancelReminderForEvent).mockResolvedValue(true)
        vi.mocked(deleteReminderById).mockResolvedValue(mockReminder)
        vi.mocked(getReminderOptions).mockReturnValue([5, 15, 30, 60])
    })

    it('returns reminders with options', async () => {
        const res = await app.request('/api/events/event_1/reminders')
        expect(res.status).toBe(200)
        const body = await res.json() as { reminders: unknown[]; options: number[] }
        expect(body.reminders).toEqual([mockReminder])
        expect(body.options).toEqual([5, 15, 30, 60])
        expect(listEventRemindersForUser).toHaveBeenCalledWith('event_1', 'user_1')
    })

    it('creates reminders via POST', async () => {
        const res = await app.request('/api/events/event_1/reminders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ minutesBeforeStart: 15 }),
        })

        expect(res.status).toBe(201)
        expect(scheduleReminderForEvent).toHaveBeenCalledWith(mockEvent, 'user_1', 15)
        const body = await res.json() as { reminder: typeof mockReminder }
        expect(body.reminder.id).toBe('reminder_1')
    })

    it('removes reminders with DELETE', async () => {
        const res = await app.request('/api/events/event_1/reminders', {
            method: 'DELETE',
        })

        expect(res.status).toBe(200)
        expect(cancelReminderForEvent).toHaveBeenCalledWith('event_1', 'user_1')
    })

    it('removes reminders by id', async () => {
        const res = await app.request('/api/events/event_1/reminders/reminder_1', {
            method: 'DELETE',
        })

        expect(res.status).toBe(200)
        expect(deleteReminderById).toHaveBeenCalledWith('reminder_1', 'user_1')
        const body = await res.json() as { reminder: typeof mockReminder }
        expect(body.reminder.id).toBe('reminder_1')
    })

    it('returns 403 when viewer lacks access', async () => {
        vi.mocked(canUserViewEvent).mockResolvedValue(false)
        const res = await app.request('/api/events/event_1/reminders')
        expect(res.status).toBe(403)
    })
})
