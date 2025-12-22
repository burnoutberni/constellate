/**
 * Tests for Enhanced Email Functionality
 * Tests for email templates, preferences, and notification emails
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock nodemailer before importing email module
const mockSendMail = vi.fn()
vi.mock('nodemailer', () => ({
	default: {
		createTransport: vi.fn(() => ({
			sendMail: mockSendMail,
		})),
	},
	createTransport: vi.fn(() => ({
		sendMail: mockSendMail,
	})),
}))

// Mock config
vi.mock('../../config.js', () => ({
	config: {
		smtp: {
			host: 'smtp.test.com',
			port: 587,
			secure: false,
			user: 'test',
			pass: 'test',
			from: 'test@example.com',
		},
	},
}))

// Import after mocks
const { prisma } = await import('../../lib/prisma.js')
const { sendEmail, sendTemplatedEmail, sendNotificationEmail, getUserEmailPreference } =
	await import('../../lib/email.js')

describe('Enhanced Email Library', () => {
	let testUser: any

	beforeEach(async () => {
		// Reset mock
		mockSendMail.mockClear()
		mockSendMail.mockResolvedValue({ messageId: 'test-message-id' })

		testUser = await prisma.user.create({
			data: {
				username: 'testuser',
				email: 'test@example.com',
				tosAcceptedAt: new Date(),
				tosVersion: 1,
			},
		})

		// Mock console methods to avoid noise in tests
		vi.spyOn(console, 'log').mockImplementation(() => {})
		vi.spyOn(console, 'error').mockImplementation(() => {})
	})

	afterEach(async () => {
		await prisma.user.delete({ where: { id: testUser.id } })
		await prisma.emailDelivery.deleteMany({ where: { userId: testUser.id } })
		vi.restoreAllMocks()
	})

	describe('sendTemplatedEmail', () => {
		it('should send templated email with tracking', async () => {
			mockSendMail.mockResolvedValue({ messageId: 'test-message-id' })

			const result = await sendTemplatedEmail({
				to: 'test@example.com',
				subject: 'Test Subject',
				html: '<p>Test content</p>',
				templateName: 'test_template',
				userId: testUser.id,
			})

			expect(mockSendMail).toHaveBeenCalledWith({
				from: expect.any(String),
				to: 'test@example.com',
				subject: 'Test Subject',
				text: 'Test content',
				html: '<p>Test content</p>',
			})

			// Check delivery record was created
			const delivery = await prisma.emailDelivery.findFirst({
				where: { userId: testUser.id },
			})

			expect(delivery).toMatchObject({
				userId: testUser.id,
				to: 'test@example.com',
				templateName: 'test_template',
				subject: 'Test Subject',
				status: 'SENT',
			})

			expect(result?.messageId).toBe('test-message-id')
		})

		it('should handle missing userId gracefully', async () => {
			mockSendMail.mockResolvedValue({ messageId: 'test-message-id' })

			await sendTemplatedEmail({
				to: 'test@example.com',
				subject: 'Test Subject',
				html: '<p>Test content</p>',
				templateName: 'test_template',
			})

			expect(mockSendMail).toHaveBeenCalled()

			// Should not create delivery record without userId
			const delivery = await prisma.emailDelivery.findFirst({
				where: { templateName: 'test_template' },
			})

			expect(delivery).toBeNull()
		})

		it('should generate text from HTML when not provided', async () => {
			mockSendMail.mockResolvedValue({ messageId: 'test-message-id' })

			await sendTemplatedEmail({
				to: 'test@example.com',
				subject: 'Test Subject',
				html: '<p>Hello <strong>World</strong>!</p>',
				templateName: 'test_template',
			})

			expect(mockSendMail).toHaveBeenCalledWith({
				to: 'test@example.com',
				from: 'test@example.com',
				subject: 'Test Subject',
				text: 'Hello World!',
				html: '<p>Hello <strong>World</strong>!</p>',
			})
		})

		it('should handle delivery record creation failure', async () => {
			// Mock prisma to throw error
			const mockCreate = vi
				.spyOn(prisma.emailDelivery, 'create')
				.mockRejectedValue(new Error('Database error'))
			mockSendMail.mockResolvedValue({ messageId: 'test-message-id' })

			// Should still send email even if tracking fails
			const result = await sendTemplatedEmail({
				to: 'test@example.com',
				subject: 'Test Subject',
				html: '<p>Test content</p>',
				templateName: 'test_template',
				userId: testUser.id,
			})

			expect(mockSendMail).toHaveBeenCalled()
			expect(result?.messageId).toBe('test-message-id')
			expect(console.error).toHaveBeenCalledWith(
				'⚠️ Failed to record email delivery:',
				expect.any(Error)
			)

			mockCreate.mockRestore()
		})
	})

	describe('getUserEmailPreference', () => {
		it('should return true when user has no preferences set', async () => {
			const result = await getUserEmailPreference(testUser.id, 'FOLLOW')
			expect(result).toBe(true)
		})

		it('should return user preference when set', async () => {
			await prisma.user.update({
				where: { id: testUser.id },
				data: {
					emailNotifications: {
						FOLLOW: false,
						COMMENT: true,
						LIKE: false,
					},
				},
			})

			const followResult = await getUserEmailPreference(testUser.id, 'FOLLOW')
			const commentResult = await getUserEmailPreference(testUser.id, 'COMMENT')
			const likeResult = await getUserEmailPreference(testUser.id, 'LIKE')

			expect(followResult).toBe(false)
			expect(commentResult).toBe(true)
			expect(likeResult).toBe(false)
		})

		it('should return true for unknown notification types', async () => {
			await prisma.user.update({
				where: { id: testUser.id },
				data: {
					emailNotifications: {
						FOLLOW: false,
					},
				},
			})

			const result = await getUserEmailPreference(testUser.id, 'UNKNOWN_TYPE' as any)
			expect(result).toBe(true)
		})

		it('should handle database errors gracefully', async () => {
			// Mock prisma to throw error
			const mockFindUnique = vi
				.spyOn(prisma.user, 'findUnique')
				.mockRejectedValue(new Error('Database error'))

			const result = await getUserEmailPreference(testUser.id, 'FOLLOW')
			expect(result).toBe(true) // Should default to true on error
			expect(console.error).toHaveBeenCalledWith(
				'Error checking email preferences:',
				expect.any(Error)
			)

			mockFindUnique.mockRestore()
		})
	})

	describe('sendNotificationEmail', () => {
		it('should send notification email when enabled', async () => {
			mockSendMail.mockResolvedValue({ messageId: 'test-message-id' })

			await sendNotificationEmail({
				userId: testUser.id,
				type: 'FOLLOW',
				title: 'New follower',
				body: 'Someone followed you',
				actorName: 'follower',
				data: { eventTitle: 'Test Event' },
			})

			expect(mockSendMail).toHaveBeenCalledWith({
				to: 'test@example.com',
				from: 'test@example.com',
				subject: 'New follower',
				html: expect.stringContaining('New Follower'),
				text: expect.stringContaining('New follower'),
			})

			// Check delivery record
			const delivery = await prisma.emailDelivery.findFirst({
				where: { userId: testUser.id, templateName: 'notification_follow' },
			})

			expect(delivery).toMatchObject({
				userId: testUser.id,
				templateName: 'notification_follow',
				subject: 'New follower',
				status: 'SENT',
			})
		})

		it('should not send email when disabled', async () => {
			await prisma.user.update({
				where: { id: testUser.id },
				data: {
					emailNotifications: {
						FOLLOW: false,
					},
				},
			})

			await sendNotificationEmail({
				userId: testUser.id,
				type: 'FOLLOW',
				title: 'New follower',
			})

			expect(mockSendMail).not.toHaveBeenCalled()

			// No delivery record should be created
			const delivery = await prisma.emailDelivery.findFirst({
				where: { templateName: 'notification_follow' },
			})

			expect(delivery).toBeNull()
		})

		it('should handle user without email', async () => {
			const userWithoutEmail = await prisma.user.create({
				data: {
					username: 'noemail',
					tosAcceptedAt: new Date(),
					tosVersion: 1,
				},
			})

			await sendNotificationEmail({
				userId: userWithoutEmail.id,
				type: 'SYSTEM',
				title: 'Test notification',
			})

			expect(mockSendMail).not.toHaveBeenCalled()
			expect(console.log).toHaveBeenCalledWith(
				`📧 User ${userWithoutEmail.id} has no email address, skipping notification`
			)

			await prisma.user.delete({ where: { id: userWithoutEmail.id } })
		})

		it('should handle email sending failure gracefully', async () => {
			mockSendMail.mockReset()
			mockSendMail.mockImplementation(() => Promise.reject(new Error('SMTP failed')))

			const result = await sendNotificationEmail({
				userId: testUser.id,
				type: 'SYSTEM',
				title: 'Test notification',
			})

			expect(result).toBeUndefined()
			expect(console.error).toHaveBeenCalledWith(
				'Failed to send email notification:',
				expect.any(Error)
			)
		})

		it('should include actor information when available', async () => {
			const actor = await prisma.user.create({
				data: {
					username: 'actor',
					name: 'Actor User',
					tosAcceptedAt: new Date(),
					tosVersion: 1,
				},
			})

			mockSendMail.mockResolvedValue({ messageId: 'test-message-id' })

			await sendNotificationEmail({
				userId: testUser.id,
				type: 'COMMENT',
				title: 'New comment',
				actorName: actor.name || actor.username,
				actorUrl: `/@${actor.username}`,
			})

			expect(mockSendMail).toHaveBeenCalledWith({
				to: 'test@example.com',
				from: 'test@example.com',
				subject: 'New comment',
				html: expect.stringContaining('Actor User'),
				text: expect.stringContaining('Actor User'),
			})

			await prisma.user.delete({ where: { id: actor.id } })
		})
	})

	describe('Email Delivery Tracking', () => {
		it('should track email delivery status', async () => {
			mockSendMail.mockResolvedValue({ messageId: 'smtp-message-id' })

			await sendTemplatedEmail({
				to: 'test@example.com',
				subject: 'Test Email',
				html: '<p>Test</p>',
				templateName: 'test_tracking',
				userId: testUser.id,
			})

			const delivery = await prisma.emailDelivery.findFirst({
				where: { userId: testUser.id, templateName: 'test_tracking' },
			})

			expect(delivery).toMatchObject({
				status: 'SENT',
				sentAt: expect.any(Date),
				messageId: 'smtp-message-id',
			})
		})

		it('should not create tracking for system emails without userId', async () => {
			mockSendMail.mockResolvedValue({ messageId: 'system-message-id' })

			await sendTemplatedEmail({
				to: 'admin@example.com',
				subject: 'System Alert',
				html: '<p>System message</p>',
				templateName: 'system_alert',
			})

			const delivery = await prisma.emailDelivery.findFirst({
				where: { templateName: 'system_alert' },
			})

			expect(delivery).toBeNull()
		})
	})
})
