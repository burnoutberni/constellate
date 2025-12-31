import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
	scheduleReminderForEvent,
	computeRemindAt,
	serializeReminder,
	formatReminderList,
	listEventRemindersForUser,
	cancelReminderForEvent,
	deleteReminderById,
	getReminderOptions,
} from '../../services/reminders.js'
import { prisma } from '../../lib/prisma.js'
import { AppError } from '../../lib/errors.js'
import { ReminderStatus } from '@prisma/client'

vi.mock('../../lib/prisma.js', () => ({
	prisma: {
		eventReminder: {
			upsert: vi.fn(),
			findMany: vi.fn(),
			findUnique: vi.fn(),
			findFirst: vi.fn(),
			update: vi.fn(),
		},
	},
}))

describe('Reminder service', () => {
	const mockEvent = {
		id: 'event_1',
		title: 'Test Event',
		startTime: new Date('2026-12-31T12:00:00Z'),
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

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
			await expect(scheduleReminderForEvent(mockEvent, 'user_1', 999)).rejects.toThrow(
				AppError
			)

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
				remindAt: new Date('2026-12-31T11:30:00Z'),
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

	describe('computeRemindAt edge cases', () => {
		it('should reject reminder time in the past', () => {
			const pastEvent = {
				startTime: new Date(Date.now() + 1000), // 1 second in future
			}
			expect(() => {
				computeRemindAt(pastEvent.startTime, 5) // 5 minutes before
			}).toThrow(AppError)

			try {
				computeRemindAt(pastEvent.startTime, 5)
			} catch (error) {
				expect(error).toBeInstanceOf(AppError)
				if (error instanceof AppError) {
					expect(error.code).toBe('REMINDER_TOO_LATE')
				}
			}
		})

		it('should handle zero minutesBeforeStart', () => {
			const futureTime = new Date(Date.now() + 60000) // 1 minute in future
			const result = computeRemindAt(futureTime, 0)
			expect(result).toBeInstanceOf(Date)
			expect(result.getTime()).toBe(futureTime.getTime())
		})

		it('should handle maximum valid minutesBeforeStart', () => {
			const MAX_MINUTES = 5_256_000
			const futureTime = new Date(Date.now() + MAX_MINUTES * 60000 + 60000) // Just enough time
			const result = computeRemindAt(futureTime, MAX_MINUTES)
			expect(result).toBeInstanceOf(Date)
			expect(result.getTime()).toBeLessThan(futureTime.getTime())
		})

		it('should reject invalid startTime (NaN)', () => {
			const invalidDate = new Date('invalid')
			expect(() => {
				computeRemindAt(invalidDate, 30)
			}).toThrow()
		})
	})

	describe('serializeReminder', () => {
		it('should serialize reminder with all fields', () => {
			const reminder = {
				id: 'reminder_1',
				eventId: 'event_1',
				userId: 'user_1',
				minutesBeforeStart: 30,
				status: ReminderStatus.PENDING,
				remindAt: new Date('2025-12-31T11:30:00Z'),
				createdAt: new Date('2025-12-01T10:00:00Z'),
				updatedAt: new Date('2025-12-01T10:00:00Z'),
				deliveredAt: null,
				lastAttemptAt: null,
				failureReason: null,
			} as any

			const serialized = serializeReminder(reminder)
			expect(serialized).toEqual({
				id: 'reminder_1',
				eventId: 'event_1',
				userId: 'user_1',
				minutesBeforeStart: 30,
				status: ReminderStatus.PENDING,
				remindAt: '2025-12-31T11:30:00.000Z',
				createdAt: '2025-12-01T10:00:00.000Z',
				updatedAt: '2025-12-01T10:00:00.000Z',
				deliveredAt: null,
				lastAttemptAt: null,
				failureReason: null,
			})
		})

		it('should serialize reminder with optional fields', () => {
			const reminder = {
				id: 'reminder_2',
				eventId: 'event_2',
				userId: 'user_2',
				minutesBeforeStart: 60,
				status: ReminderStatus.SENT,
				remindAt: new Date('2025-12-31T11:00:00Z'),
				createdAt: new Date('2025-12-01T10:00:00Z'),
				updatedAt: new Date('2025-12-01T10:00:00Z'),
				deliveredAt: new Date('2025-12-31T11:00:00Z'),
				lastAttemptAt: new Date('2025-12-31T11:00:00Z'),
				failureReason: null,
			} as any

			const serialized = serializeReminder(reminder)
			expect(serialized.deliveredAt).toBe('2025-12-31T11:00:00.000Z')
			expect(serialized.lastAttemptAt).toBe('2025-12-31T11:00:00.000Z')
		})
	})

	describe('formatReminderList', () => {
		it('should format list of reminders', () => {
			const reminders = [
				{
					id: 'reminder_1',
					eventId: 'event_1',
					userId: 'user_1',
					minutesBeforeStart: 30,
					status: ReminderStatus.PENDING,
					remindAt: new Date('2025-12-31T11:30:00Z'),
					createdAt: new Date('2025-12-01T10:00:00Z'),
					updatedAt: new Date('2025-12-01T10:00:00Z'),
					deliveredAt: null,
					lastAttemptAt: null,
					failureReason: null,
				},
				{
					id: 'reminder_2',
					eventId: 'event_1',
					userId: 'user_1',
					minutesBeforeStart: 60,
					status: ReminderStatus.PENDING,
					remindAt: new Date('2025-12-31T11:00:00Z'),
					createdAt: new Date('2025-12-01T10:00:00Z'),
					updatedAt: new Date('2025-12-01T10:00:00Z'),
					deliveredAt: null,
					lastAttemptAt: null,
					failureReason: null,
				},
			] as any

			const formatted = formatReminderList(reminders)
			expect(formatted).toHaveLength(2)
			expect(formatted[0].id).toBe('reminder_1')
			expect(formatted[1].id).toBe('reminder_2')
		})
	})

	describe('listEventRemindersForUser', () => {
		it('should list reminders for user and event', async () => {
			const mockReminders = [
				{
					id: 'reminder_1',
					eventId: 'event_1',
					userId: 'user_1',
					minutesBeforeStart: 30,
					status: ReminderStatus.PENDING,
					remindAt: new Date('2025-12-31T11:30:00Z'),
					createdAt: new Date(),
					updatedAt: new Date(),
					deliveredAt: null,
					lastAttemptAt: null,
					failureReason: null,
				},
			] as any

			vi.mocked(prisma.eventReminder.findMany).mockResolvedValue(mockReminders)

			const result = await listEventRemindersForUser('event_1', 'user_1')
			expect(result).toHaveLength(1)
			expect(result[0].id).toBe('reminder_1')
			expect(prisma.eventReminder.findMany).toHaveBeenCalledWith({
				where: { eventId: 'event_1', userId: 'user_1' },
				orderBy: { remindAt: 'asc' },
			})
		})

		it('should return empty array when no reminders exist', async () => {
			vi.mocked(prisma.eventReminder.findMany).mockResolvedValue([])
			const result = await listEventRemindersForUser('event_1', 'user_1')
			expect(result).toEqual([])
		})
	})

	describe('cancelReminderForEvent', () => {
		it('should cancel pending reminder', async () => {
			const mockReminder = {
				id: 'reminder_1',
				eventId: 'event_1',
				userId: 'user_1',
				status: ReminderStatus.PENDING,
			} as any

			vi.mocked(prisma.eventReminder.findUnique).mockResolvedValue(mockReminder)
			vi.mocked(prisma.eventReminder.update).mockResolvedValue({
				...mockReminder,
				status: ReminderStatus.CANCELLED,
			} as any)

			const result = await cancelReminderForEvent('event_1', 'user_1')
			expect(result).toBe(true)
			expect(prisma.eventReminder.update).toHaveBeenCalledWith({
				where: {
					eventId_userId: {
						eventId: 'event_1',
						userId: 'user_1',
					},
				},
				data: {
					status: ReminderStatus.CANCELLED,
				},
			})
		})

		it('should cancel sending reminder', async () => {
			const mockReminder = {
				id: 'reminder_1',
				eventId: 'event_1',
				userId: 'user_1',
				status: ReminderStatus.SENDING,
			} as any

			vi.mocked(prisma.eventReminder.findUnique).mockResolvedValue(mockReminder)
			vi.mocked(prisma.eventReminder.update).mockResolvedValue({
				...mockReminder,
				status: ReminderStatus.CANCELLED,
			} as any)

			const result = await cancelReminderForEvent('event_1', 'user_1')
			expect(result).toBe(true)
		})

		it('should cancel failed reminder', async () => {
			const mockReminder = {
				id: 'reminder_1',
				eventId: 'event_1',
				userId: 'user_1',
				status: ReminderStatus.FAILED,
			} as any

			vi.mocked(prisma.eventReminder.findUnique).mockResolvedValue(mockReminder)
			vi.mocked(prisma.eventReminder.update).mockResolvedValue({
				...mockReminder,
				status: ReminderStatus.CANCELLED,
			} as any)

			const result = await cancelReminderForEvent('event_1', 'user_1')
			expect(result).toBe(true)
		})

		it('should return false for already sent reminder', async () => {
			const mockReminder = {
				id: 'reminder_1',
				eventId: 'event_1',
				userId: 'user_1',
				status: ReminderStatus.SENT,
			} as any

			vi.mocked(prisma.eventReminder.findUnique).mockResolvedValue(mockReminder)

			const result = await cancelReminderForEvent('event_1', 'user_1')
			expect(result).toBe(false)
			expect(prisma.eventReminder.update).not.toHaveBeenCalled()
		})

		it('should return false when reminder does not exist', async () => {
			vi.mocked(prisma.eventReminder.findUnique).mockResolvedValue(null)

			const result = await cancelReminderForEvent('event_1', 'user_1')
			expect(result).toBe(false)
		})

		it('should return false on P2025 error (record not found)', async () => {
			vi.mocked(prisma.eventReminder.findUnique).mockResolvedValue({
				id: 'reminder_1',
				status: ReminderStatus.PENDING,
			} as any)
			vi.mocked(prisma.eventReminder.update).mockRejectedValue({
				code: 'P2025',
			})

			const result = await cancelReminderForEvent('event_1', 'user_1')
			expect(result).toBe(false)
		})

		it('should throw on other database errors', async () => {
			vi.mocked(prisma.eventReminder.findUnique).mockResolvedValue({
				id: 'reminder_1',
				status: ReminderStatus.PENDING,
			} as any)
			vi.mocked(prisma.eventReminder.update).mockRejectedValue(new Error('Database error'))

			await expect(cancelReminderForEvent('event_1', 'user_1')).rejects.toThrow(
				'Database error'
			)
		})
	})

	describe('deleteReminderById', () => {
		it('should delete reminder by id', async () => {
			const mockReminder = {
				id: 'reminder_1',
				eventId: 'event_1',
				userId: 'user_1',
				minutesBeforeStart: 30,
				status: ReminderStatus.PENDING,
				remindAt: new Date(),
				createdAt: new Date(),
				updatedAt: new Date(),
				deliveredAt: null,
				lastAttemptAt: null,
				failureReason: null,
			} as any

			vi.mocked(prisma.eventReminder.findFirst).mockResolvedValue(mockReminder)
			vi.mocked(prisma.eventReminder.update).mockResolvedValue({
				...mockReminder,
				status: ReminderStatus.CANCELLED,
			} as any)

			const result = await deleteReminderById('reminder_1', 'user_1')
			expect(result.id).toBe('reminder_1')
			expect(result.status).toBe(ReminderStatus.CANCELLED)
			expect(prisma.eventReminder.findFirst).toHaveBeenCalledWith({
				where: {
					id: 'reminder_1',
					userId: 'user_1',
				},
			})
		})

		it('should throw error when reminder not found', async () => {
			vi.mocked(prisma.eventReminder.findFirst).mockResolvedValue(null)

			await expect(deleteReminderById('reminder_1', 'user_1')).rejects.toThrow(AppError)
			try {
				await deleteReminderById('reminder_1', 'user_1')
			} catch (error) {
				expect(error).toBeInstanceOf(AppError)
				if (error instanceof AppError) {
					expect(error.code).toBe('REMINDER_NOT_FOUND')
				}
			}
		})

		it('should throw error when reminder belongs to different user', async () => {
			vi.mocked(prisma.eventReminder.findFirst).mockResolvedValue(null)

			await expect(deleteReminderById('reminder_1', 'user_2')).rejects.toThrow(AppError)
		})
	})

	describe('getReminderOptions', () => {
		it('should return reminder minute options', () => {
			const options = getReminderOptions()
			expect(options).toEqual([5, 15, 30, 60, 120, 1440])
			expect(options).toHaveLength(6)
		})
	})

	describe('scheduleReminderForEvent edge cases', () => {
		it('should reject event with invalid startTime', async () => {
			const invalidEvent = {
				id: 'event_1',
				title: 'Test Event',
				startTime: new Date('invalid'),
			}

			await expect(scheduleReminderForEvent(invalidEvent, 'user_1', 30)).rejects.toThrow(
				AppError
			)

			try {
				await scheduleReminderForEvent(invalidEvent, 'user_1', 30)
			} catch (error) {
				expect(error).toBeInstanceOf(AppError)
				if (error instanceof AppError) {
					expect(error.code).toBe('REMINDER_INVALID_EVENT')
				}
			}
		})

		it('should reject event that has already started', async () => {
			const pastEvent = {
				id: 'event_1',
				title: 'Test Event',
				startTime: new Date(Date.now() - 1000),
			}

			await expect(scheduleReminderForEvent(pastEvent, 'user_1', 30)).rejects.toThrow(
				AppError
			)

			try {
				await scheduleReminderForEvent(pastEvent, 'user_1', 30)
			} catch (error) {
				expect(error).toBeInstanceOf(AppError)
				if (error instanceof AppError) {
					expect(error.code).toBe('REMINDER_EVENT_PAST')
				}
			}
		})

		it('should update existing reminder', async () => {
			const futureTime = new Date(Date.now() + 7200000) // 2 hours in future (enough for 60 min reminder)
			const updatedEvent = {
				id: 'event_1',
				title: 'Test Event',
				startTime: futureTime,
			}

			vi.mocked(prisma.eventReminder.upsert).mockResolvedValue({
				id: 'reminder_1',
				eventId: 'event_1',
				userId: 'user_1',
				minutesBeforeStart: 60,
				remindAt: new Date(futureTime.getTime() - 60 * 60000),
				status: ReminderStatus.PENDING,
				createdAt: new Date(),
				updatedAt: new Date(),
				deliveredAt: null,
				lastAttemptAt: null,
				failureReason: null,
			} as any)

			const result = await scheduleReminderForEvent(updatedEvent, 'user_1', 60)
			expect(result.minutesBeforeStart).toBe(60)
			expect(prisma.eventReminder.upsert).toHaveBeenCalled()
		})
	})
})
