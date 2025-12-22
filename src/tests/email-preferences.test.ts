/**
 * Tests for Email Preferences API
 * Tests for email preferences management endpoints
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '../../lib/prisma.js'
import { app } from '../../email-preferences.js'
import { AppError } from '../../lib/errors.js'

// Mock auth middleware
const mockRequireAuth = vi.fn()
vi.mock('../../middleware/auth.js', () => ({
	requireAuth: mockRequireAuth,
}))

describe('Email Preferences API', () => {
	let testUser: any

	beforeEach(async () => {
		// Create test user
		testUser = await prisma.user.create({
			data: {
				username: 'testuser',
				email: 'test@example.com',
				tosAcceptedAt: new Date(),
				tosVersion: 1,
			},
		})

		mockRequireAuth.mockReturnValue(testUser.id)
	})

	afterEach(async () => {
		// Clean up test data
		await prisma.user.deleteMany({ where: { id: testUser.id } })
		await prisma.emailDelivery.deleteMany({ where: { userId: testUser.id } })
		vi.clearAllMocks()
	})

	describe('GET /', () => {
		it('should return user email preferences', async () => {
			// Set some preferences
			await prisma.user.update({
				where: { id: testUser.id },
				data: {
					emailNotifications: {
						FOLLOW: true,
						COMMENT: false,
						LIKE: true,
						MENTION: false,
						EVENT: true,
						SYSTEM: false,
					},
				},
			})

			const res = await app.request('/email-preferences')
			const data = await res.json()

			expect(res.status).toBe(200)
			expect(data.preferences).toEqual({
				FOLLOW: true,
				COMMENT: false,
				LIKE: true,
				MENTION: false,
				EVENT: true,
				SYSTEM: false,
			})
		})

		it('should return default preferences when none set', async () => {
			const res = await app.request('/email-preferences')
			const data = await res.json()

			expect(res.status).toBe(200)
			expect(data.preferences).toEqual({
				FOLLOW: true,
				COMMENT: true,
				LIKE: true,
				MENTION: true,
				EVENT: true,
				SYSTEM: true,
			})
		})

		it('should require authentication', async () => {
			mockRequireAuth.mockImplementation(() => {
				throw new AppError('UNAUTHORIZED', 'Authentication required')
			})

			const res = await app.request('/email-preferences')
			const data = await res.json()

			expect(res.status).toBe(401)
			expect(data.error).toBe('UNAUTHORIZED')
		})
	})

	describe('PUT /', () => {
		it('should update email preferences', async () => {
			const newPreferences = {
				FOLLOW: false,
				COMMENT: true,
				LIKE: false,
				MENTION: true,
				EVENT: false,
				SYSTEM: true,
			}

			const res = await app.request('/email-preferences', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(newPreferences),
			})

			const data = await res.json()

			expect(res.status).toBe(200)
			expect(data.preferences).toEqual(newPreferences)
			expect(data.message).toBe('Email preferences updated successfully')

			// Verify in database
			const user = await prisma.user.findUnique({
				where: { id: testUser.id },
				select: { emailNotifications: true },
			})

			expect(user?.emailNotifications).toEqual(newPreferences)
		})

		it('should validate preference keys', async () => {
			const invalidPreferences = {
				FOLLOW: true,
				INVALID_KEY: false, // Invalid key
			}

			const res = await app.request('/email-preferences', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(invalidPreferences),
			})

			const data = await res.json()

			expect(res.status).toBe(400)
			expect(data.error).toBe('Invalid preference key: INVALID_KEY')
		})

		it('should validate preference values', async () => {
			const invalidPreferences = {
				FOLLOW: 'not-a-boolean', // Invalid value type
			}

			const res = await app.request('/email-preferences', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(invalidPreferences),
			})

			const data = await res.json()

			expect(res.status).toBe(400)
			expect(data.error).toBe('Invalid value for FOLLOW: must be boolean')
		})

		it('should allow partial updates', async () => {
			// Set initial preferences
			await prisma.user.update({
				where: { id: testUser.id },
				data: {
					emailNotifications: {
						FOLLOW: true,
						COMMENT: true,
						LIKE: true,
						MENTION: true,
						EVENT: true,
						SYSTEM: true,
					},
				},
			})

			// Update only some preferences
			const partialUpdate = {
				FOLLOW: false,
				COMMENT: false,
			}

			const res = await app.request('/email-preferences', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(partialUpdate),
			})

			const data = await res.json()

			expect(res.status).toBe(200)
			expect(data.preferences).toEqual({
				FOLLOW: false,
				COMMENT: false,
				LIKE: true, // Should remain unchanged
				MENTION: true, // Should remain unchanged
				EVENT: true, // Should remain unchanged
				SYSTEM: true, // Should remain unchanged
			})
		})

		it('should require authentication', async () => {
			mockRequireAuth.mockImplementation(() => {
				throw new AppError('UNAUTHORIZED', 'Authentication required')
			})

			const res = await app.request('/email-preferences', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ FOLLOW: false }),
			})

			const data = await res.json()

			expect(res.status).toBe(401)
			expect(data.error).toBe('UNAUTHORIZED')
		})

		it('should handle malformed JSON', async () => {
			const res = await app.request('/email-preferences', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: 'invalid json',
			})

			expect(res.status).toBe(400)
		})
	})

	describe('POST /reset', () => {
		it('should reset preferences to defaults', async () => {
			// Set custom preferences first
			await prisma.user.update({
				where: { id: testUser.id },
				data: {
					emailNotifications: {
						FOLLOW: false,
						COMMENT: false,
						LIKE: false,
						MENTION: false,
						EVENT: false,
						SYSTEM: false,
					},
				},
			})

			const res = await app.request('/email-preferences/reset', {
				method: 'POST',
			})

			const data = await res.json()

			expect(res.status).toBe(200)
			expect(data.preferences).toEqual({
				FOLLOW: true,
				COMMENT: true,
				LIKE: true,
				MENTION: true,
				EVENT: true,
				SYSTEM: true,
			})
			expect(data.message).toBe('Email preferences reset to defaults')

			// Verify in database
			const user = await prisma.user.findUnique({
				where: { id: testUser.id },
				select: { emailNotifications: true },
			})

			expect(user?.emailNotifications).toEqual({
				FOLLOW: true,
				COMMENT: true,
				LIKE: true,
				MENTION: true,
				EVENT: true,
				SYSTEM: true,
			})
		})

		it('should require authentication', async () => {
			mockRequireAuth.mockImplementation(() => {
				throw new AppError('UNAUTHORIZED', 'Authentication required')
			})

			const res = await app.request('/email-preferences/reset', {
				method: 'POST',
			})

			const data = await res.json()

			expect(res.status).toBe(401)
			expect(data.error).toBe('UNAUTHORIZED')
		})
	})

	describe('GET /deliveries', () => {
		beforeEach(async () => {
			// Create some email delivery records
			await prisma.emailDelivery.createMany({
				data: [
					{
						userId: testUser.id,
						to: 'test@example.com',
						templateName: 'magic_link',
						subject: 'Login to Constellate',
						status: 'SENT',
						sentAt: new Date('2024-01-10T10:00:00Z'),
					},
					{
						userId: testUser.id,
						to: 'test@example.com',
						templateName: 'notification_follow',
						subject: 'New follower',
						status: 'DELIVERED',
						sentAt: new Date('2024-01-11T15:30:00Z'),
						deliveredAt: new Date('2024-01-11T15:31:00Z'),
					},
					{
						userId: testUser.id,
						to: 'test@example.com',
						templateName: 'notification_comment',
						subject: 'New comment',
						status: 'FAILED',
						sentAt: new Date('2024-01-12T09:00:00Z'),
						errorMessage: 'SMTP connection failed',
					},
				],
			})
		})

		it('should return email delivery history', async () => {
			const res = await app.request('/email-preferences/deliveries?limit=10&offset=0')
			const data = await res.json()

			expect(res.status).toBe(200)
			expect(data.deliveries).toHaveLength(3)
			expect(data.pagination).toEqual({
				total: 3,
				limit: 10,
				offset: 0,
				hasMore: false,
			})

			// Check delivery records
			expect(data.deliveries[0]).toMatchObject({
				templateName: 'notification_comment',
				subject: 'New comment',
				status: 'FAILED',
				errorMessage: 'SMTP connection failed',
			})
		})

		it('should paginate results', async () => {
			const res = await app.request('/email-preferences/deliveries?limit=1&offset=0')
			const data = await res.json()

			expect(res.status).toBe(200)
			expect(data.deliveries).toHaveLength(1)
			expect(data.pagination).toEqual({
				total: 3,
				limit: 1,
				offset: 0,
				hasMore: true,
			})

			// Get second page
			const res2 = await app.request('/email-preferences/deliveries?limit=1&offset=1')
			const data2 = await res2.json()

			expect(data2.deliveries).toHaveLength(1)
			expect(data2.deliveries[0].id).not.toBe(data.deliveries[0].id)
		})

		it('should limit and clamp parameters', async () => {
			const res = await app.request('/email-preferences/deliveries?limit=200&offset=-10')
			const data = await res.json()

			expect(res.status).toBe(200)
			expect(data.pagination.limit).toBe(100) // Should be clamped to max 100
			expect(data.pagination.offset).toBe(0) // Should be clamped to min 0
		})

		it('should require authentication', async () => {
			mockRequireAuth.mockImplementation(() => {
				throw new AppError('UNAUTHORIZED', 'Authentication required')
			})

			const res = await app.request('/email-preferences/deliveries')
			const data = await res.json()

			expect(res.status).toBe(401)
			expect(data.error).toBe('UNAUTHORIZED')
		})
	})
})
