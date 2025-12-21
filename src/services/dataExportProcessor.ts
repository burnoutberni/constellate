/**
 * Data Export Processor
 * Background job that processes user data export requests asynchronously.
 * This prevents timeouts and performance issues when users have large amounts of data.
 */

import { prisma } from '../lib/prisma.js'
import { createNotification } from './notifications.js'
import { sendEmail } from '../lib/email.js'
import { getBaseUrl } from '../lib/activitypubHelpers.js'
import { Prisma, DataExportStatus } from '@prisma/client'

const POLL_INTERVAL_MS = 30000 // Check every 30 seconds
const PROCESSING_LIMIT = 5 // Process up to 5 exports per cycle
const EXPORT_EXPIRY_DAYS = 7 // Exports expire after 7 days
const CLEANUP_INTERVAL_MS = 3600000 // Run cleanup every hour
const PROCESSING_TIMEOUT_MS = 600000 // Consider PROCESSING jobs stuck after 10 minutes

let processorStarted = false
let isProcessing = false
let intervalHandle: NodeJS.Timeout | null = null
let lastCleanupTime: number = 0

export function getIsProcessing() {
	return isProcessing
}

/**
 * Fetch all user data for export
 */
async function fetchUserData(userId: string) {
	const [profile, events, comments, following, followers, attendance, likes, reports, appeals] =
		await Promise.all([
			// 1. Profile
			prisma.user.findUnique({
				where: { id: userId },
				select: {
					id: true,
					username: true,
					email: true,
					name: true,
					bio: true,
					displayColor: true,
					profileImage: true,
					headerImage: true,
					timezone: true,
					createdAt: true,
					updatedAt: true,
					isAdmin: true,
					autoAcceptFollowers: true,
					isPublicProfile: true,
				},
			}),
			// 2. Events created
			prisma.event.findMany({
				where: { userId },
				include: { tags: true },
			}),
			// 3. Comments
			prisma.comment.findMany({
				where: { authorId: userId },
			}),
			// 4. Following
			prisma.following.findMany({
				where: { userId },
			}),
			// 5. Followers
			prisma.follower.findMany({
				where: { userId },
			}),
			// 6. Event Attendance
			prisma.eventAttendance.findMany({
				where: { userId },
				include: { event: { select: { title: true, startTime: true } } },
			}),
			// 7. Event Likes
			prisma.eventLike.findMany({
				where: { userId },
				include: { event: { select: { title: true, startTime: true } } },
			}),
			// 8. Reports made
			prisma.report.findMany({
				where: { reporterId: userId },
			}),
			// 9. Appeals
			prisma.appeal.findMany({
				where: { userId },
			}),
		])

	if (!profile) {
		throw new Error('User not found')
	}

	// Construct the export object
	return {
		_meta: {
			exportedAt: new Date().toISOString(),
			version: '1.0',
		},
		profile,
		events,
		comments,
		social: {
			following,
			followers,
		},
		activity: {
			attendance,
			likes,
		},
		moderation: {
			reportsFiled: reports,
			appeals,
		},
	}
}

/**
 * Check if a data export job is stuck in PROCESSING state
 */
function isStuckProcessingJob(status: DataExportStatus, updatedAt: Date): boolean {
	return (
		status === DataExportStatus.PROCESSING &&
		updatedAt < new Date(Date.now() - PROCESSING_TIMEOUT_MS)
	)
}

/**
 * Check if export should be processed (PENDING or stuck PROCESSING)
 */
function shouldProcessExport(status: DataExportStatus, isStuck: boolean): boolean {
	return status === DataExportStatus.PENDING || isStuck
}

/**
 * Mark export as failed after max retries exceeded
 */
async function markExportAsFailedAfterMaxRetries(
	exportId: string,
	retryCount: number
): Promise<void> {
	try {
		await prisma.dataExport.update({
			where: { id: exportId },
			data: {
				status: DataExportStatus.FAILED,
				errorMessage: `Export failed after ${retryCount} retry attempts. The job was stuck in PROCESSING state repeatedly.`,
			},
		})
	} catch (updateError) {
		console.error(`Failed to mark export ${exportId} as FAILED after max retries:`, updateError)
	}
}

/**
 * Update export status to PROCESSING, incrementing retry count if needed
 */
async function markExportAsProcessing(
	exportId: string,
	isStuck: boolean,
	currentRetryCount: number
): Promise<void> {
	const updateData: { status: DataExportStatus; retryCount?: number } = {
		status: DataExportStatus.PROCESSING,
	}
	if (isStuck) {
		updateData.retryCount = currentRetryCount + 1
	}

	await prisma.dataExport.update({
		where: { id: exportId },
		data: updateData,
	})
}

/**
 * Send notifications to user about completed export
 */
async function sendExportReadyNotifications(
	exportId: string,
	userId: string,
	userEmail: string | null
): Promise<void> {
	const baseUrl = getBaseUrl()
	const exportUrl = `${baseUrl}/api/users/me/export/${exportId}`

	await createNotification({
		userId,
		type: 'SYSTEM',
		title: 'Data Export Ready',
		body: 'Your data export is ready for download. It will be available for 7 days.',
		contextUrl: exportUrl,
		data: { exportId },
	})

	if (userEmail) {
		try {
			await sendEmail({
				to: userEmail,
				subject: 'Your Data Export is Ready',
				text: `Your data export is ready for download.\n\nDownload: ${exportUrl}\n\nThe export will be available for 7 days.\n\n— Constellate`,
			})
		} catch (error) {
			console.warn('Failed to send export ready email:', error)
		}
	}
}

/**
 * Mark export as completed with data
 */
async function markExportAsCompleted(
	exportId: string,
	exportData: Awaited<ReturnType<typeof fetchUserData>>,
	expiresAt: Date
): Promise<void> {
	await prisma.dataExport.update({
		where: { id: exportId },
		data: {
			status: DataExportStatus.COMPLETED,
			data: exportData as Prisma.InputJsonValue,
			completedAt: new Date(),
			expiresAt,
			retryCount: 0,
		},
	})
}

/**
 * Mark export as failed with error message
 */
async function markExportAsFailed(exportId: string, errorMessage: string): Promise<void> {
	try {
		await prisma.dataExport.update({
			where: { id: exportId },
			data: {
				status: DataExportStatus.FAILED,
				errorMessage,
			},
		})
	} catch (updateError) {
		console.error(`Failed to mark export ${exportId} as FAILED:`, updateError)
	}
}

/**
 * Process a single data export job
 */
async function processExport(exportId: string) {
	const dataExport = await prisma.dataExport.findUnique({
		where: { id: exportId },
		include: { user: true },
	})

	if (!dataExport) {
		return
	}

	const isStuck = isStuckProcessingJob(dataExport.status, dataExport.updatedAt)

	if (!shouldProcessExport(dataExport.status, isStuck)) {
		return
	}

	if (isStuck && dataExport.retryCount >= dataExport.maxRetries) {
		await markExportAsFailedAfterMaxRetries(exportId, dataExport.retryCount)
		return
	}

	try {
		await markExportAsProcessing(exportId, isStuck, dataExport.retryCount)

		const exportData = await fetchUserData(dataExport.userId)

		const expiresAt = new Date()
		expiresAt.setDate(expiresAt.getDate() + EXPORT_EXPIRY_DAYS)

		await markExportAsCompleted(exportId, exportData, expiresAt)

		await sendExportReadyNotifications(exportId, dataExport.userId, dataExport.user.email)
	} catch (error) {
		console.error(`Error processing export ${exportId}:`, error)
		const errorMessage = error instanceof Error ? error.message : 'Unknown error'
		await markExportAsFailed(exportId, errorMessage)
	}
}

/**
 * Clean up expired exports
 * Should be called periodically (e.g., daily)
 */
async function cleanupExpiredExports() {
	try {
		const result = await prisma.dataExport.deleteMany({
			where: {
				expiresAt: {
					lt: new Date(),
				},
			},
		})

		if (result.count > 0) {
			console.log(`🧹 Cleaned up ${result.count} expired data exports`)
		}
	} catch (error) {
		console.error('Error cleaning up expired exports:', error)
	}
}

/**
 * Run a single processing cycle
 */
export async function runDataExportProcessorCycle(limit: number = PROCESSING_LIMIT) {
	if (isProcessing) {
		return
	}

	isProcessing = true
	try {
		// Run cleanup if enough time has passed since last cleanup
		const now = Date.now()
		if (now - lastCleanupTime >= CLEANUP_INTERVAL_MS) {
			await cleanupExpiredExports()
			lastCleanupTime = now
		}

		// Use a transaction with FOR UPDATE SKIP LOCKED to atomically select and claim exports
		// This prevents race conditions when multiple processor instances run simultaneously
		const exportIds = await prisma.$transaction(async (tx) => {
			// Select and lock pending exports and stuck processing exports atomically
			// A job is considered stuck if it's been in PROCESSING state for more than PROCESSING_TIMEOUT_MS
			const stuckThreshold = new Date(Date.now() - PROCESSING_TIMEOUT_MS)
			const exports = await tx.$queryRaw<Array<{ id: string }>>`
                SELECT id
                FROM "DataExport"
                WHERE (
                    status = 'PENDING'::"DataExportStatus"
                    OR (
                        status = 'PROCESSING'::"DataExportStatus"
                        AND "updatedAt" < ${stuckThreshold}
                    )
                )
                ORDER BY "createdAt" ASC
                LIMIT ${limit}
                FOR UPDATE SKIP LOCKED
            `

			return exports.map((e) => e.id)
		})

		// Process exports concurrently
		await Promise.allSettled(exportIds.map((exportId) => processExport(exportId)))
	} catch (error) {
		console.error('Data export processor error:', error)
	} finally {
		isProcessing = false
	}
}

/**
 * Start the data export processor background job
 */
export function startDataExportProcessor() {
	if (processorStarted) {
		return
	}

	processorStarted = true
	const runCycle = () => {
		void runDataExportProcessorCycle()
	}

	intervalHandle = setInterval(runCycle, POLL_INTERVAL_MS)
	runCycle() // Run immediately on startup
	console.log('📦 Data export processor started')
}

/**
 * Stop the data export processor background job
 */
export function stopDataExportProcessor() {
	if (intervalHandle) {
		clearInterval(intervalHandle)
		intervalHandle = null
	}
	processorStarted = false
}

