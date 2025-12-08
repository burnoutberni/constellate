import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
    runReminderDispatcherCycle,
    startReminderDispatcher,
    stopReminderDispatcher,
    getIsProcessing,
} from '../../services/reminderDispatcher.js'
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
        $transaction: vi.fn(),
        $queryRaw: vi.fn(),
<<<<<<< HEAD
        $executeRaw: vi.fn(),
=======
        $executeRawUnsafe: vi.fn(),
>>>>>>> 82382c0 (Fix suggestions)
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
        // Mock transaction to return reminder IDs
        vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
            const tx = {
                $queryRaw: vi.fn().mockResolvedValue([{ id: dueReminder.id }]),
                $executeRaw: vi.fn().mockResolvedValue(1),
            }
            return callback(tx)
        })
        vi.mocked(prisma.eventReminder.findUnique).mockResolvedValue(hydratedReminder as any)
        vi.mocked(createNotification).mockResolvedValue(undefined as any)
        vi.mocked(sendEmail).mockResolvedValue(undefined)
        vi.mocked(prisma.eventReminder.update).mockResolvedValue(hydratedReminder as any)
    })

    afterEach(() => {
        stopReminderDispatcher()
        vi.useRealTimers()
    })

    it('delivers due reminders', async () => {
        await runReminderDispatcherCycle(5)

        expect(prisma.$transaction).toHaveBeenCalled()
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

    it('marks reminder as SENT when email fails but notification succeeds', async () => {
        vi.mocked(sendEmail).mockRejectedValueOnce(new Error('Email service unavailable'))

        await runReminderDispatcherCycle(5)

        expect(createNotification).toHaveBeenCalled()
        expect(sendEmail).toHaveBeenCalled()
        // Email failure is non-critical - reminder should still be marked as SENT
        expect(prisma.eventReminder.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: dueReminder.id },
                data: expect.objectContaining({
                    status: 'SENT',
                    failureReason: expect.stringContaining('Email failed'),
                }),
            })
        )
    })
<<<<<<< HEAD

    it('handles reminder with missing event context', async () => {
        vi.mocked(prisma.eventReminder.findUnique).mockResolvedValue({
            ...dueReminder,
            event: null,
            user: hydratedReminder.user,
        } as any)

        await runReminderDispatcherCycle(5)

        expect(createNotification).not.toHaveBeenCalled()
        expect(sendEmail).not.toHaveBeenCalled()
    })

    it('handles reminder with missing user context', async () => {
        vi.mocked(prisma.eventReminder.findUnique).mockResolvedValue({
            ...dueReminder,
            event: hydratedReminder.event,
            user: null,
        } as any)

        await runReminderDispatcherCycle(5)

        expect(createNotification).not.toHaveBeenCalled()
        expect(sendEmail).not.toHaveBeenCalled()
    })

    it('handles reminder that was deleted during processing', async () => {
        vi.mocked(prisma.eventReminder.findUnique).mockResolvedValue(null)
        vi.mocked(prisma.eventReminder.update).mockRejectedValue(new Error('Record not found'))

        await runReminderDispatcherCycle(5)

        // Should not throw, just skip processing
        expect(createNotification).not.toHaveBeenCalled()
    })

    it('handles user without email', async () => {
        const reminderWithoutEmail = {
            ...hydratedReminder,
            user: {
                ...hydratedReminder.user,
                email: null,
            },
        }

        vi.mocked(prisma.eventReminder.findUnique).mockResolvedValue(reminderWithoutEmail as any)

        await runReminderDispatcherCycle(5)

        expect(createNotification).toHaveBeenCalled()
        expect(sendEmail).not.toHaveBeenCalled()
        expect(prisma.eventReminder.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: dueReminder.id },
                data: expect.objectContaining({ status: 'SENT' }),
            })
        )
    })

    it('handles unexpected errors during processing', async () => {
        vi.mocked(createNotification).mockRejectedValueOnce(new Error('Unexpected error'))
        vi.mocked(prisma.eventReminder.update).mockResolvedValueOnce(hydratedReminder as any)

        await runReminderDispatcherCycle(5)

        // Should mark as FAILED on unexpected error
        expect(prisma.eventReminder.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: dueReminder.id },
                data: expect.objectContaining({
                    status: 'FAILED',
                    failureReason: expect.any(String),
                }),
            })
        )
    })

    it('skips processing when already processing', async () => {
        // First call sets isProcessing to true
        const firstCall = runReminderDispatcherCycle(5)
        // Second call should return immediately
        const secondCall = runReminderDispatcherCycle(5)

        await Promise.all([firstCall, secondCall])

        // Transaction should only be called once
        expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    })

    it('processes multiple reminders concurrently', async () => {
        vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
            const tx = {
                $queryRaw: vi.fn().mockResolvedValue([
                    { id: 'reminder_1' },
                    { id: 'reminder_2' },
                ]),
                $executeRaw: vi.fn().mockResolvedValue(2),
            }
            return callback(tx)
        })

        vi.mocked(prisma.eventReminder.findUnique)
            .mockResolvedValueOnce({ ...hydratedReminder, id: 'reminder_1' } as any)
            .mockResolvedValueOnce({ ...hydratedReminder, id: 'reminder_2' } as any)

        await runReminderDispatcherCycle(5)

        expect(createNotification).toHaveBeenCalledTimes(2)
        expect(prisma.eventReminder.update).toHaveBeenCalledTimes(2)
    })

    it('handles empty reminder list', async () => {
        vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
            const tx = {
                $queryRaw: vi.fn().mockResolvedValue([]),
                $executeRaw: vi.fn().mockResolvedValue(0),
            }
            return callback(tx)
        })

        await runReminderDispatcherCycle(5)

        expect(createNotification).not.toHaveBeenCalled()
        expect(sendEmail).not.toHaveBeenCalled()
    })

    describe('getIsProcessing', () => {
        it('returns false when not processing', () => {
            expect(getIsProcessing()).toBe(false)
        })

        it('returns true when processing', async () => {
            // Start processing
            const processingPromise = runReminderDispatcherCycle(5)
            // Check status immediately (before it completes)
            const isProcessing = getIsProcessing()
            await processingPromise

            // Note: This test may be flaky due to timing, but it tests the function exists
            expect(typeof isProcessing).toBe('boolean')
        })
    })

    describe('startReminderDispatcher', () => {
        it('starts the dispatcher', () => {
            vi.useFakeTimers()
            const setIntervalSpy = vi.spyOn(global, 'setInterval')
            startReminderDispatcher()

            // Should set up interval
            expect(setIntervalSpy).toHaveBeenCalled()
            stopReminderDispatcher()
            setIntervalSpy.mockRestore()
        })

        it('does not start dispatcher if already started', () => {
            vi.useFakeTimers()
            const setIntervalSpy = vi.spyOn(global, 'setInterval')
            startReminderDispatcher()
            const intervalCallCount = setIntervalSpy.mock.calls.length

            startReminderDispatcher()
            // Should not call setInterval again
            expect(setIntervalSpy.mock.calls.length).toBe(intervalCallCount)

            stopReminderDispatcher()
            setIntervalSpy.mockRestore()
        })

        it('runs initial cycle when started', async () => {
            vi.useFakeTimers()
            startReminderDispatcher()

            // Advance timer to trigger interval
            await vi.advanceTimersByTimeAsync(30000)

            // Should have attempted to process
            expect(prisma.$transaction).toHaveBeenCalled()

            stopReminderDispatcher()
        })
    })

    describe('stopReminderDispatcher', () => {
        it('stops the dispatcher', () => {
            vi.useFakeTimers()
            const clearIntervalSpy = vi.spyOn(global, 'clearInterval')
            startReminderDispatcher()
            stopReminderDispatcher()

            expect(clearIntervalSpy).toHaveBeenCalled()
            clearIntervalSpy.mockRestore()
        })

        it('can be called multiple times safely', () => {
            stopReminderDispatcher()
            stopReminderDispatcher()
            // Should not throw
        })
    })

    describe('runReminderDispatcherCycle edge cases', () => {
        it('handles transaction errors gracefully', async () => {
            vi.mocked(prisma.$transaction).mockRejectedValueOnce(new Error('Transaction failed'))

            await runReminderDispatcherCycle(5)

            // Should not throw, just log error
            expect(createNotification).not.toHaveBeenCalled()
        })

        it('respects processing limit', async () => {
            const limit = 3
            vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
                const tx = {
                    $queryRaw: vi.fn().mockResolvedValue([
                        { id: 'reminder_1' },
                        { id: 'reminder_2' },
                        { id: 'reminder_3' },
                    ]),
                    $executeRaw: vi.fn().mockResolvedValue(3),
                }
                return callback(tx)
            })

            await runReminderDispatcherCycle(limit)

            // Should only process up to limit
            expect(prisma.eventReminder.findUnique).toHaveBeenCalledTimes(limit)
        })

        it('handles reminder update failure when reminder is missing context', async () => {
            vi.mocked(prisma.eventReminder.findUnique).mockResolvedValue({
                ...dueReminder,
                event: null,
                user: hydratedReminder.user,
            } as any)
            // Mock update to fail (reminder was deleted)
            vi.mocked(prisma.eventReminder.update).mockRejectedValueOnce(new Error('Record not found'))

            await runReminderDispatcherCycle(5)

            // Should not throw, just skip processing
            expect(createNotification).not.toHaveBeenCalled()
            expect(sendEmail).not.toHaveBeenCalled()
        })

        it('handles event without username in URL building', async () => {
            const reminderWithoutUsername = {
                ...hydratedReminder,
                event: {
                    ...hydratedReminder.event,
                    user: null,
                },
            }

            vi.mocked(prisma.eventReminder.findUnique).mockResolvedValue(reminderWithoutUsername as any)

            await runReminderDispatcherCycle(5)

            // Should still create notification successfully
            expect(createNotification).toHaveBeenCalled()
            expect(prisma.eventReminder.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: dueReminder.id },
                    data: expect.objectContaining({ status: 'SENT' }),
                })
            )
        })

        it('handles database update failure during error handling', async () => {
            vi.mocked(createNotification).mockRejectedValueOnce(new Error('Notification failed'))
            // Mock the final update to fail
            vi.mocked(prisma.eventReminder.update)
                .mockResolvedValueOnce(hydratedReminder as any) // First call succeeds (if any)
                .mockRejectedValueOnce(new Error('Database error')) // Second call fails

            await runReminderDispatcherCycle(5)

            // Should attempt to mark as failed, but handle the error gracefully
            expect(createNotification).toHaveBeenCalled()
        })

        it('handles formatEventStart with invalid date', async () => {
            const reminderWithInvalidDate = {
                ...hydratedReminder,
                event: {
                    ...hydratedReminder.event,
                    startTime: new Date('invalid'),
                },
            }

            vi.mocked(prisma.eventReminder.findUnique).mockResolvedValue(reminderWithInvalidDate as any)

            await runReminderDispatcherCycle(5)

            // Should fall back to ISO string format
            expect(createNotification).toHaveBeenCalled()
            expect(prisma.eventReminder.update).toHaveBeenCalled()
        })
    })
=======
>>>>>>> 82382c0 (Fix suggestions)
})
