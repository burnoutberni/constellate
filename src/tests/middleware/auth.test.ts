/**
 * Tests for Authentication Middleware
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Context } from 'hono'
import { requireAuth, requireOwnership, requireAdmin } from '../../middleware/auth.js'
import { Errors } from '../../lib/errors.js'
import { prisma } from '../../lib/prisma.js'
import * as authModule from '../../auth.js'

// Mock dependencies
vi.mock('../../auth.js')
// Mock dependencies (prisma is already mocked in setupVitest.ts)

describe('Auth Middleware', () => {
	let mockContext: Context
	const testUserId = 'user_123'
	const testUser = {
		id: testUserId,
		username: 'alice',
		email: 'alice@test.com',
		isAdmin: false,
	}

	beforeEach(() => {
		vi.clearAllMocks()

		// Create a mock context
		mockContext = {
			get: vi.fn(),
			set: vi.fn(),
		} as unknown as Context
	})

	describe('requireAuth', () => {
		it('should return userId when authenticated', () => {
			;(mockContext.get as any) = vi.fn((key: string) => {
				if (key === 'userId') return testUserId
				return undefined
			})

			const userId = requireAuth(mockContext)
			expect(userId).toBe(testUserId)
		})

		it('should throw unauthorized error when not authenticated', () => {
			;(mockContext.get as any) = vi.fn(() => undefined)

			expect(() => requireAuth(mockContext)).toThrow()
		})

		it('should throw when userId is null', () => {
			;(mockContext.get as any) = vi.fn((key: string) => {
				if (key === 'userId') return null
				return undefined
			})

			expect(() => requireAuth(mockContext)).toThrow()
		})

		it('should throw when userId is empty string', () => {
			;(mockContext.get as any) = vi.fn((key: string) => {
				if (key === 'userId') return ''
				return undefined
			})

			expect(() => requireAuth(mockContext)).toThrow()
		})
	})

	describe('requireOwnership', () => {
		it('should not throw when user owns the resource', async () => {
			;(mockContext.get as any) = vi.fn((key: string) => {
				if (key === 'userId') return testUserId
				return undefined
			})

			await expect(requireOwnership(mockContext, testUserId)).resolves.not.toThrow()
		})

		it('should throw forbidden error when user does not own the resource', async () => {
			;(mockContext.get as any) = vi.fn((key: string) => {
				if (key === 'userId') return testUserId
				return undefined
			})

			await expect(requireOwnership(mockContext, 'other_user_id')).rejects.toThrow()
		})

		it('should throw unauthorized error when not authenticated', async () => {
			;(mockContext.get as any) = vi.fn(() => undefined)

			await expect(requireOwnership(mockContext, testUserId)).rejects.toThrow()
		})

		it('should allow access to public resources (null resourceUserId)', async () => {
			;(mockContext.get as any) = vi.fn((key: string) => {
				if (key === 'userId') return testUserId
				return undefined
			})

			// This should not throw - public resources can be accessed by authenticated users
			await expect(requireOwnership(mockContext, null)).resolves.not.toThrow()
		})

		it('should use custom resource name in error message', async () => {
			;(mockContext.get as any) = vi.fn((key: string) => {
				if (key === 'userId') return testUserId
				return undefined
			})

			try {
				await requireOwnership(mockContext, 'other_user_id', 'event')
			} catch (error: any) {
				expect(error.message).toContain('event')
			}
		})
	})

	describe('requireAdmin', () => {
		it('should not throw when user is admin', async () => {
			;(mockContext.get as any) = vi.fn((key: string) => {
				if (key === 'userId') return testUserId
				return undefined
			})

			vi.mocked(prisma.user.findUnique).mockResolvedValue({
				id: testUserId,
				isAdmin: true,
			} as any)

			await expect(requireAdmin(mockContext)).resolves.not.toThrow()
		})

		it('should throw forbidden error when user is not admin', async () => {
			;(mockContext.get as any) = vi.fn((key: string) => {
				if (key === 'userId') return testUserId
				return undefined
			})

			vi.mocked(prisma.user.findUnique).mockResolvedValue({
				id: testUserId,
				isAdmin: false,
			} as any)

			await expect(requireAdmin(mockContext)).rejects.toThrow()
		})

		it('should throw forbidden error when user does not exist', async () => {
			;(mockContext.get as any) = vi.fn((key: string) => {
				if (key === 'userId') return testUserId
				return undefined
			})

			vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

			await expect(requireAdmin(mockContext)).rejects.toThrow()
		})

		it('should throw unauthorized error when not authenticated', async () => {
			;(mockContext.get as any) = vi.fn(() => undefined)

			await expect(requireAdmin(mockContext)).rejects.toThrow()
		})

		it('should query database for user admin status', async () => {
			;(mockContext.get as any) = vi.fn((key: string) => {
				if (key === 'userId') return testUserId
				return undefined
			})

			vi.mocked(prisma.user.findUnique).mockResolvedValue({
				id: testUserId,
				isAdmin: true,
			} as any)

			await requireAdmin(mockContext)

			expect(prisma.user.findUnique).toHaveBeenCalledWith({
				where: { id: testUserId },
				select: { isAdmin: true },
			})
		})
	})
})
