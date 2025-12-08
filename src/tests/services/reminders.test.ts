import { describe, it, expect, vi } from 'vitest'
import { scheduleReminderForEvent, computeRemindAt } from '../../services/reminders.js'
import { prisma } from '../../lib/prisma.js'
import { AppError } from '../../lib/errors.js'

vi.mock('../../lib/prisma.js', () => ({
    prisma: {
        eventReminder: {
            upsert: vi.fn(),
        },
    },
}))

describe('Reminder service - computeRemindAt overflow protection', () => {
    const mockEvent = {
        id: 'event_1',
        title: 'Test Event',
        startTime: new Date('2025-12-31T12:00:00Z'),
    }

    describe('computeRemindAt overflow validation', () => {
        it('should reject minutesBeforeStart that exceeds maximum', () => {
            const MAX_MINUTES = 5_256_000 // 10 years
            const excessiveMinutes = MAX_MINUTES + 1

            expect(() => {
                computeRemindAt(mockEvent.startTime, excessiveMinutes)
            }).toThrow(AppError)

            try {
                computeRemindAt(mockEvent.startTime, excessiveMinutes)
            } catch (error) {
                expect(error).toBeInstanceOf(AppError)
                if (error instanceof AppError) {
                    expect(error.code).toBe('REMINDER_INVALID_OFFSET')
                    expect(error.statusCode).toBe(400)
                }
            }
        })

        it('should reject negative minutesBeforeStart', () => {
            expect(() => {
                computeRemindAt(mockEvent.startTime, -1)
            }).toThrow(AppError)

            try {
                computeRemindAt(mockEvent.startTime, -1)
            } catch (error) {
                expect(error).toBeInstanceOf(AppError)
                if (error instanceof AppError) {
                    expect(error.code).toBe('REMINDER_INVALID_OFFSET')
                }
            }
        })

        it('should accept valid minutesBeforeStart within range', () => {
            const result = computeRemindAt(mockEvent.startTime, 30)
            expect(result).toBeInstanceOf(Date)
            expect(result.getTime()).toBeLessThan(mockEvent.startTime.getTime())
        })
    })

    describe('scheduleReminderForEvent integration', () => {
        it('should reject invalid reminder intervals via normalizeReminderMinutes', async () => {
            // Invalid values are caught by normalizeReminderMinutes first
            await expect(
                scheduleReminderForEvent(mockEvent, 'user_1', 999)
            ).rejects.toThrow(AppError)

            try {
                await scheduleReminderForEvent(mockEvent, 'user_1', 999)
            } catch (error) {
                expect(error).toBeInstanceOf(AppError)
                if (error instanceof AppError) {
                    expect(error.code).toBe('REMINDER_INTERVAL_UNSUPPORTED')
                }
            }
        })

        it('should accept valid minutesBeforeStart within range', async () => {
            vi.mocked(prisma.eventReminder.upsert).mockResolvedValue({
                id: 'reminder_1',
                eventId: 'event_1',
                userId: 'user_1',
                minutesBeforeStart: 30,
                remindAt: new Date('2025-12-31T11:30:00Z'),
                status: 'PENDING',
                createdAt: new Date(),
                updatedAt: new Date(),
                deliveredAt: null,
                lastAttemptAt: null,
                failureReason: null,
            } as any)

            const result = await scheduleReminderForEvent(mockEvent, 'user_1', 30)
            expect(result).toBeDefined()
            expect(result.minutesBeforeStart).toBe(30)
        })
    })
})
