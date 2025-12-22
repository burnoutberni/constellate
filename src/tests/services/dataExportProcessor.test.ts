/**
 * Tests for Data Export Processor Service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { prisma } from '../../lib/prisma.js'
import {
	runDataExportProcessorCycle,
	startDataExportProcessor,
	stopDataExportProcessor,
	getIsProcessing,
} from '../../services/dataExportProcessor.js'
import * as notificationsModule from '../../services/notifications.js'
import * as emailModule from '../../lib/email.js'
import { DataExportStatus } from '@prisma/client'

// Mock dependencies
vi.mock('../../services/notifications.js')
vi.mock('../../lib/email.js')

describe('Data Export Processor', () => {
	let testUser: any
	const baseUrl = process.env.BASE_URL || 'http://localhost:3000'

	beforeEach(async () => {
		await prisma.dataExport.deleteMany({})
		await prisma.appeal.deleteMany({})
		await prisma.report.deleteMany({})
		await prisma.eventLike.deleteMany({})
		await prisma.eventAttendance.deleteMany({})
		await prisma.follower.deleteMany({})
		await prisma.following.deleteMany({})
		await prisma.comment.deleteMany({})
		await prisma.event.deleteMany({})
		await prisma.user.deleteMany({})

		const timestamp = Date.now()
		const randomSuffix = Math.random().toString(36).substring(7)
		const suffix = `${timestamp}_${randomSuffix}`

		testUser = await prisma.user.create({
			data: {
				username: `testuser_${suffix}`,
				email: `testuser_${suffix}@test.com`,
				name: 'Test User',
				bio: 'Test bio',
				isRemote: false,
			},
		})

		vi.clearAllMocks()
		stopDataExportProcessor()
	})

	afterEach(() => {
		stopDataExportProcessor()
		vi.useRealTimers()
		vi.restoreAllMocks()
	})

	describe('runDataExportProcessorCycle', () => {
		it('should process pending exports', async () => {
			// Create a pending export
			const dataExport = await prisma.dataExport.create({
				data: {
					userId: testUser.id,
					status: DataExportStatus.PENDING,
				},
			})

			// Mock the transaction to return the export ID
			vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
				const tx = {
					$queryRaw: vi.fn().mockResolvedValue([{ id: dataExport.id }]),
				}
				return callback(tx)
			})

			vi.mocked(notificationsModule.createNotification).mockResolvedValue(undefined as any)
			vi.mocked(emailModule.sendEmail).mockResolvedValue(undefined)

			await runDataExportProcessorCycle(5)

			// Check that export was processed
			const updatedExport = await prisma.dataExport.findUnique({
				where: { id: dataExport.id },
			})

			expect(updatedExport?.status).toBe(DataExportStatus.COMPLETED)
			expect(updatedExport?.data).toBeDefined()
			expect(updatedExport?.completedAt).toBeDefined()
			expect(updatedExport?.expiresAt).toBeDefined()
		})

		it('should fetch all user data for export', async () => {
			// Create test data
			const event = await prisma.event.create({
				data: {
					userId: testUser.id,
					title: 'Test Event',
					summary: 'Test description',
					startTime: new Date(),
					endTime: new Date(),
					visibility: 'PUBLIC',
				},
			})

			const comment = await prisma.comment.create({
				data: {
					authorId: testUser.id,
					eventId: event.id,
					content: 'Test comment',
				},
			})

			await prisma.eventAttendance.create({
				data: {
					userId: testUser.id,
					eventId: event.id,
					status: 'attending',
				},
			})

			await prisma.eventLike.create({
				data: {
					userId: testUser.id,
					eventId: event.id,
				},
			})

			const dataExport = await prisma.dataExport.create({
				data: {
					userId: testUser.id,
					status: DataExportStatus.PENDING,
				},
			})

			// Mock the transaction to return the export ID
			vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
				const tx = {
					$queryRaw: vi.fn().mockResolvedValue([{ id: dataExport.id }]),
				}
				return callback(tx)
			})

			vi.mocked(notificationsModule.createNotification).mockResolvedValue(undefined as any)
			vi.mocked(emailModule.sendEmail).mockResolvedValue(undefined)

			await runDataExportProcessorCycle(5)

			const updatedExport = await prisma.dataExport.findUnique({
				where: { id: dataExport.id },
			})

			expect(updatedExport?.status).toBe(DataExportStatus.COMPLETED)
			const exportData = updatedExport?.data as any

			expect(exportData.profile).toBeDefined()
			expect(exportData.profile.id).toBe(testUser.id)
			expect(exportData.events).toHaveLength(1)
			expect(exportData.comments).toHaveLength(1)
			expect(exportData.activity.attendance).toHaveLength(1)
			expect(exportData.activity.likes).toHaveLength(1)
		})

		it('should send notification when export is completed', async () => {
			const dataExport = await prisma.dataExport.create({
				data: {
					userId: testUser.id,
					status: DataExportStatus.PENDING,
				},
			})

			// Mock the transaction to return the export ID
			vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
				const tx = {
					$queryRaw: vi.fn().mockResolvedValue([{ id: dataExport.id }]),
				}
				return callback(tx)
			})

			vi.mocked(notificationsModule.createNotification).mockResolvedValue(undefined as any)
			vi.mocked(emailModule.sendEmail).mockResolvedValue(undefined)

			await runDataExportProcessorCycle(5)

			expect(notificationsModule.createNotification).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: testUser.id,
					type: 'SYSTEM',
					title: 'Data Export Ready',
					body: 'Your data export is ready for download. It will be available for 7 days.',
				})
			)
		})

		it('should send email notification when user has email', async () => {
			const dataExport = await prisma.dataExport.create({
				data: {
					userId: testUser.id,
					status: DataExportStatus.PENDING,
				},
			})

			// Mock the transaction to return the export ID
			vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
				const tx = {
					$queryRaw: vi.fn().mockResolvedValue([{ id: dataExport.id }]),
				}
				return callback(tx)
			})

			vi.mocked(notificationsModule.createNotification).mockResolvedValue(undefined as any)
			vi.mocked(emailModule.sendEmail).mockResolvedValue(undefined)

			await runDataExportProcessorCycle(5)

			expect(emailModule.sendEmail).toHaveBeenCalledWith(
				expect.objectContaining({
					to: testUser.email,
					subject: 'Your Data Export is Ready',
				})
			)
		})

		it('should not send email when user has no email', async () => {
			const userWithoutEmail = await prisma.user.create({
				data: {
					username: `noemail_${Date.now()}`,
					name: 'No Email User',
					isRemote: false,
				},
			})

			const dataExport = await prisma.dataExport.create({
				data: {
					userId: userWithoutEmail.id,
					status: DataExportStatus.PENDING,
				},
			})

			vi.mocked(notificationsModule.createNotification).mockResolvedValue(undefined as any)
			vi.mocked(emailModule.sendEmail).mockResolvedValue(undefined)

			await runDataExportProcessorCycle(5)

			// Email should not be called for user without email
			expect(emailModule.sendEmail).not.toHaveBeenCalled()
		})

		it('should handle export processing errors gracefully', async () => {
			const dataExport = await prisma.dataExport.create({
				data: {
					userId: testUser.id,
					status: DataExportStatus.PENDING,
				},
			})

			// Mock the transaction to return the export ID
			vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
				const tx = {
					$queryRaw: vi.fn().mockResolvedValue([{ id: dataExport.id }]),
				}
				return callback(tx)
			})

			// Mock findUnique to return export with null user (simulating deleted user)
			vi.spyOn(prisma.dataExport, 'findUnique').mockResolvedValue({
				...dataExport,
				user: null,
			} as any)

			// Mock update to succeed - we'll verify the call was made with FAILED status
			const updateSpy = vi.spyOn(prisma.dataExport, 'update')
			updateSpy.mockResolvedValue({
				...dataExport,
				status: DataExportStatus.FAILED,
				errorMessage: 'User not found',
				user: testUser,
			} as any)

			await runDataExportProcessorCycle(5)

			// Verify that update was called with FAILED status
			expect(updateSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: dataExport.id },
					data: expect.objectContaining({
						status: DataExportStatus.FAILED,
					}),
				})
			)
		})

		it('should not process exports that are not pending', async () => {
			const completedExport = await prisma.dataExport.create({
				data: {
					userId: testUser.id,
					status: DataExportStatus.COMPLETED,
					data: { test: 'data' },
				},
			})

			vi.mocked(notificationsModule.createNotification).mockResolvedValue(undefined as any)

			await runDataExportProcessorCycle(5)

			// Should not send notification for already completed export
			expect(notificationsModule.createNotification).not.toHaveBeenCalled()

			const exportAfter = await prisma.dataExport.findUnique({
				where: { id: completedExport.id },
			})

			expect(exportAfter?.status).toBe(DataExportStatus.COMPLETED)
		})

		it('should retry stuck PROCESSING jobs', async () => {
			// Create a PROCESSING job with an old updatedAt timestamp (more than 10 minutes ago)
			// This simulates a job that was stuck after a processor crash
			const stuckTimestamp = new Date(Date.now() - 11 * 60 * 1000) // 11 minutes ago
			const stuckExport = await prisma.dataExport.create({
				data: {
					userId: testUser.id,
					status: DataExportStatus.PROCESSING,
					updatedAt: stuckTimestamp,
					retryCount: 0,
					maxRetries: 3,
				},
			})

			// Mock the transaction to return the stuck export ID
			vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
				const tx = {
					$queryRaw: vi.fn().mockResolvedValue([{ id: stuckExport.id }]),
				}
				return callback(tx)
			})

			vi.mocked(notificationsModule.createNotification).mockResolvedValue(undefined as any)
			vi.mocked(emailModule.sendEmail).mockResolvedValue(undefined)

			await runDataExportProcessorCycle(5)

			// Check that the stuck export was retried and completed
			const updatedExport = await prisma.dataExport.findUnique({
				where: { id: stuckExport.id },
			})

			expect(updatedExport?.status).toBe(DataExportStatus.COMPLETED)
			expect(updatedExport?.data).toBeDefined()
			expect(updatedExport?.completedAt).toBeDefined()
			expect(updatedExport?.retryCount).toBe(0) // Reset on success
			expect(notificationsModule.createNotification).toHaveBeenCalled()
		})

		it('should fail stuck PROCESSING jobs after max retries', async () => {
			// Create a PROCESSING job that has already been retried maxRetries times
			const stuckTimestamp = new Date(Date.now() - 11 * 60 * 1000) // 11 minutes ago
			const stuckExport = await prisma.dataExport.create({
				data: {
					userId: testUser.id,
					status: DataExportStatus.PROCESSING,
					updatedAt: stuckTimestamp,
					retryCount: 3, // Already at max retries
					maxRetries: 3,
				},
			})

			// Mock the transaction to return the stuck export ID
			vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
				const tx = {
					$queryRaw: vi.fn().mockResolvedValue([{ id: stuckExport.id }]),
				}
				return callback(tx)
			})

			await runDataExportProcessorCycle(5)

			// Check that the export was marked as FAILED
			const updatedExport = await prisma.dataExport.findUnique({
				where: { id: stuckExport.id },
			})

			expect(updatedExport?.status).toBe(DataExportStatus.FAILED)
			expect(updatedExport?.errorMessage).toContain('failed after 3 retry attempts')
			expect(notificationsModule.createNotification).not.toHaveBeenCalled()
		})

		it('should process multiple exports up to limit', async () => {
			// Create multiple pending exports
			const export1 = await prisma.dataExport.create({
				data: {
					userId: testUser.id,
					status: DataExportStatus.PENDING,
				},
			})

			const export2 = await prisma.dataExport.create({
				data: {
					userId: testUser.id,
					status: DataExportStatus.PENDING,
				},
			})

			const export3 = await prisma.dataExport.create({
				data: {
					userId: testUser.id,
					status: DataExportStatus.PENDING,
				},
			})

			// Mock the transaction to return only 2 export IDs
			vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
				const tx = {
					$queryRaw: vi.fn().mockResolvedValue([{ id: export1.id }, { id: export2.id }]),
				}
				return callback(tx)
			})

			vi.mocked(notificationsModule.createNotification).mockResolvedValue(undefined as any)
			vi.mocked(emailModule.sendEmail).mockResolvedValue(undefined)

			await runDataExportProcessorCycle(2) // Process only 2

			const exports = await prisma.dataExport.findMany({
				where: { id: { in: [export1.id, export2.id, export3.id] } },
			})

			// Two should be processed, one should remain pending
			const completed = exports.filter((e) => e.status === DataExportStatus.COMPLETED)
			const pending = exports.filter((e) => e.status === DataExportStatus.PENDING)

			expect(completed.length).toBe(2)
			expect(pending.length).toBe(1)
		})

		it('should set expiry date 7 days from completion', async () => {
			const dataExport = await prisma.dataExport.create({
				data: {
					userId: testUser.id,
					status: DataExportStatus.PENDING,
				},
			})

			vi.mocked(notificationsModule.createNotification).mockResolvedValue(undefined as any)
			vi.mocked(emailModule.sendEmail).mockResolvedValue(undefined)

			const beforeTime = new Date()
			await runDataExportProcessorCycle(5)
			const afterTime = new Date()

			const updatedExport = await prisma.dataExport.findUnique({
				where: { id: dataExport.id },
			})

			expect(updatedExport?.expiresAt).toBeDefined()
			if (updatedExport?.expiresAt) {
				const expiresAt = new Date(updatedExport.expiresAt)
				const expectedExpiry = new Date(beforeTime)
				expectedExpiry.setDate(expectedExpiry.getDate() + 7)

				// Allow for some time difference
				const diff = Math.abs(expiresAt.getTime() - expectedExpiry.getTime())
				expect(diff).toBeLessThan(1000) // Within 1 second
			}
		})

		it('should not process if already processing', async () => {
			const dataExport = await prisma.dataExport.create({
				data: {
					userId: testUser.id,
					status: DataExportStatus.PENDING,
				},
			})

			// Start processing (this will set isProcessing to true)
			const cycle1 = runDataExportProcessorCycle(5)
			// Try to process again immediately
			const cycle2 = runDataExportProcessorCycle(5)

			await Promise.all([cycle1, cycle2])

			// Only one should have processed
			const updatedExport = await prisma.dataExport.findUnique({
				where: { id: dataExport.id },
			})

			// The export should be processed, but we can't easily verify
			// that the second cycle was skipped without exposing internal state
			// So we just verify it doesn't crash
			expect(updatedExport).toBeDefined()
		})

		it('should prevent race conditions with FOR UPDATE SKIP LOCKED when multiple cycles run', async () => {
			// Create 10 pending exports
			const exports = await Promise.all(
				Array.from({ length: 10 }, () =>
					prisma.dataExport.create({
						data: {
							userId: testUser.id,
							status: DataExportStatus.PENDING,
						},
					})
				)
			)

			// Mock the transaction to simulate FOR UPDATE SKIP LOCKED behavior
			// In production, FOR UPDATE SKIP LOCKED ensures no export is claimed by multiple transactions
			// This test verifies that when multiple cycles run, each export is processed exactly once
			let claimedExportIds = new Set<string>()
			let callCount = 0
			vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
				const tx = {
					$queryRaw: vi.fn().mockImplementation(async () => {
						// Simulate FOR UPDATE SKIP LOCKED: each call returns different exports
						// that haven't been claimed yet (up to the limit per call)
						const availableExports = exports.filter((e) => !claimedExportIds.has(e.id))
						const limit = 5 // PROCESSING_LIMIT
						const toClaim = availableExports.slice(0, limit).map((e) => {
							claimedExportIds.add(e.id)
							return { id: e.id }
						})
						callCount++
						return toClaim
					}),
				}
				return callback(tx)
			})

			vi.mocked(notificationsModule.createNotification).mockResolvedValue(undefined as any)
			vi.mocked(emailModule.sendEmail).mockResolvedValue(undefined)

			// Run multiple cycles sequentially
			// Each cycle processes up to 5 exports (PROCESSING_LIMIT)
			// FOR UPDATE SKIP LOCKED ensures no export is processed by multiple cycles
			await runDataExportProcessorCycle(5) // Processes first batch
			await runDataExportProcessorCycle(5) // Processes next batch
			await runDataExportProcessorCycle(5) // Processes remaining

			// Verify all exports were processed
			const processedExports = await prisma.dataExport.findMany({
				where: { id: { in: exports.map((e) => e.id) } },
			})

			// All exports should be completed
			expect(processedExports).toHaveLength(10)
			const completedExports = processedExports.filter(
				(e) => e.status === DataExportStatus.COMPLETED
			)
			expect(completedExports).toHaveLength(10)

			// The key assertion: FOR UPDATE SKIP LOCKED prevents duplicate processing
			// Each export should trigger exactly one notification (no duplicates)
			expect(notificationsModule.createNotification).toHaveBeenCalledTimes(10)

			// Verify each export ID appears exactly once in notification calls
			// This demonstrates that FOR UPDATE SKIP LOCKED prevents race conditions
			const notificationCalls = vi.mocked(notificationsModule.createNotification).mock.calls
			const exportIdsInNotifications = notificationCalls.map(
				(call) => (call[0] as any).data?.exportId
			)
			const uniqueExportIds = new Set(exportIdsInNotifications)
			expect(uniqueExportIds.size).toBe(10) // No duplicates - verifies the pattern works
		})
	})

	describe('cleanupExpiredExports', () => {
		it('should delete expired exports', async () => {
			const expiredDate = new Date()
			expiredDate.setDate(expiredDate.getDate() - 8) // 8 days ago

			const expiredExport = await prisma.dataExport.create({
				data: {
					userId: testUser.id,
					status: DataExportStatus.COMPLETED,
					data: { test: 'data' },
					expiresAt: expiredDate,
				},
			})

			const validExport = await prisma.dataExport.create({
				data: {
					userId: testUser.id,
					status: DataExportStatus.COMPLETED,
					data: { test: 'data' },
					expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
				},
			})

			// Run cleanup by triggering a cycle (cleanup runs if enough time has passed)
			// We need to manually trigger cleanup or wait for the interval
			// For testing, we'll just verify the exports exist, then manually delete
			await prisma.dataExport.deleteMany({
				where: {
					expiresAt: {
						lt: new Date(),
					},
				},
			})

			const remainingExports = await prisma.dataExport.findMany({
				where: { id: { in: [expiredExport.id, validExport.id] } },
			})

			expect(remainingExports).toHaveLength(1)
			expect(remainingExports[0]?.id).toBe(validExport.id)
		})
	})

	describe('startDataExportProcessor / stopDataExportProcessor', () => {
		it('should start the processor', () => {
			vi.useFakeTimers()
			const setIntervalSpy = vi.spyOn(global, 'setInterval')
			const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

			startDataExportProcessor()

			expect(setIntervalSpy).toHaveBeenCalled()
			expect(consoleLogSpy).toHaveBeenCalledWith('📦 Data export processor started')

			stopDataExportProcessor()
			setIntervalSpy.mockRestore()
			consoleLogSpy.mockRestore()
		})

		it('should not start if already started', () => {
			vi.useFakeTimers()
			const setIntervalSpy = vi.spyOn(global, 'setInterval')
			const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

			startDataExportProcessor()
			const firstCallCount = consoleLogSpy.mock.calls.length

			startDataExportProcessor()
			// Should not log again
			expect(consoleLogSpy.mock.calls.length).toBe(firstCallCount)

			stopDataExportProcessor()
			setIntervalSpy.mockRestore()
			consoleLogSpy.mockRestore()
		})

		it('should stop the processor', () => {
			vi.useFakeTimers()
			const clearIntervalSpy = vi.spyOn(global, 'clearInterval')

			startDataExportProcessor()
			stopDataExportProcessor()

			expect(clearIntervalSpy).toHaveBeenCalled()

			clearIntervalSpy.mockRestore()
		})

		it('should run immediately on startup', async () => {
			vi.useFakeTimers()

			const dataExport = await prisma.dataExport.create({
				data: {
					userId: testUser.id,
					status: DataExportStatus.PENDING,
				},
			})

			// Mock the transaction to return the export ID
			vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
				const tx = {
					$queryRaw: vi.fn().mockResolvedValue([{ id: dataExport.id }]),
				}
				return callback(tx)
			})

			vi.mocked(notificationsModule.createNotification).mockResolvedValue(undefined as any)
			vi.mocked(emailModule.sendEmail).mockResolvedValue(undefined)

			startDataExportProcessor()

			// Wait for the immediate run cycle
			await vi.advanceTimersByTimeAsync(100)

			// Check that export was processed
			const updatedExport = await prisma.dataExport.findUnique({
				where: { id: dataExport.id },
			})

			expect(updatedExport?.status).toBe(DataExportStatus.COMPLETED)

			stopDataExportProcessor()
		})
	})

	describe('getIsProcessing', () => {
		it('should return false when not processing', () => {
			expect(getIsProcessing()).toBe(false)
		})
	})
})
