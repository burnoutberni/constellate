import { describe, it, expect, beforeEach, vi } from 'vitest'
import { runReminderDispatcherCycle } from '../../services/reminderDispatcher.js'
import { prisma } from '../../lib/prisma.js'
import { createNotification } from '../../services/notifications.js'
import { sendEmail } from '../../lib/email.js'

vi.mock('../../lib/prisma.js', () => ({
    prisma: {
        eventReminder: {
            findMany: vi.fn(),
            updateMany: vi.fn(),
            findUnique: vi.fn(),
            update: vi.fn(),
        },
    },
}))

vi.mock('../../services/notifications.js', () => ({
    createNotification: vi.fn(),
}))

vi.mock('../../lib/email.js', () => ({
    sendEmail: vi.fn(),
}))

const dueReminder = {
    id: 'rem-1',
    status: 'PENDING',
    remindAt: new Date('2025-02-01T09:00:00Z'),
}

const hydratedReminder = {
    ...dueReminder,
    event: {
        id: 'event-1',
        title: 'Reminder Event',
        startTime: new Date('2025-02-01T10:00:00Z'),
        user: {
            username: 'alice',
        },
    },
    user: {
        id: 'user-1',
        username: 'bob',
        name: 'Bob',
        email: 'bob@example.com',
    },
}

describe('Reminder dispatcher', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(prisma.eventReminder.findMany).mockResolvedValue([dueReminder] as any)
        vi.mocked(prisma.eventReminder.updateMany).mockResolvedValue(1 as any)
        vi.mocked(prisma.eventReminder.findUnique).mockResolvedValue(hydratedReminder as any)
        vi.mocked(createNotification).mockResolvedValue(undefined as any)
        vi.mocked(sendEmail).mockResolvedValue(undefined)
        vi.mocked(prisma.eventReminder.update).mockResolvedValue(hydratedReminder as any)
    })

    it('delivers due reminders', async () => {
        await runReminderDispatcherCycle(5)

        expect(prisma.eventReminder.findMany).toHaveBeenCalled()
        expect(prisma.eventReminder.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    id: dueReminder.id,
                    status: 'PENDING',
                },
            })
        )
        expect(createNotification).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'user-1',
                title: expect.stringContaining('Reminder'),
            })
        )
        expect(sendEmail).toHaveBeenCalled()
        expect(prisma.eventReminder.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: dueReminder.id },
                data: expect.objectContaining({ status: 'SENT' }),
            })
        )
    })

    it('marks reminder as failed on notification error', async () => {
        vi.mocked(createNotification).mockRejectedValueOnce(new Error('boom'))

        await runReminderDispatcherCycle(5)

        expect(prisma.eventReminder.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: dueReminder.id },
                data: expect.objectContaining({ status: 'FAILED' }),
            })
        )
    })

    it('marks reminder as failed when email fails but notification succeeds', async () => {
        vi.mocked(sendEmail).mockRejectedValueOnce(new Error('Email service unavailable'))

        await runReminderDispatcherCycle(5)

        expect(createNotification).toHaveBeenCalled()
        expect(sendEmail).toHaveBeenCalled()
        expect(prisma.eventReminder.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: dueReminder.id },
                data: expect.objectContaining({ status: 'FAILED' }),
            })
        )
    })
})
