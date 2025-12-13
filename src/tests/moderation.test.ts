/**
 * Tests for Moderation API
 * User blocking, domain blocking, and content reporting
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import { ZodError } from 'zod'
import moderationApp from '../moderation.js'
import { prisma } from '../lib/prisma.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'

// Mock dependencies
vi.mock('../lib/prisma.js', () => ({
	prisma: {
		user: {
			findUnique: vi.fn(),
		},
		blockedUser: {
			upsert: vi.fn(),
			delete: vi.fn(),
			findUnique: vi.fn(),
			findMany: vi.fn(),
		},
		blockedDomain: {
			upsert: vi.fn(),
			delete: vi.fn(),
			findMany: vi.fn(),
		},
		report: {
			create: vi.fn(),
			findMany: vi.fn(),
			count: vi.fn(),
			update: vi.fn(),
		},
		event: {
			findUnique: vi.fn(),
		},
		comment: {
			findUnique: vi.fn(),
		},
	},
}))

vi.mock('../middleware/auth.js', () => ({
	requireAuth: vi.fn(),
	requireAdmin: vi.fn(),
}))

// Create test app
const app = new Hono()
app.route('/api/moderation', moderationApp)

describe('Moderation API', () => {
	const mockUser = {
		id: 'user_123',
		username: 'alice',
		email: 'alice@example.com',
		name: 'Alice Smith',
	}

	const mockTargetUser = {
		id: 'user_456',
		username: 'bob',
		email: 'bob@example.com',
		name: 'Bob Johnson',
	}

	const mockAdminUser = {
		id: 'admin_123',
		username: 'admin',
		email: 'admin@example.com',
		name: 'Admin User',
		isAdmin: true,
	}

	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(requireAuth).mockReturnValue('user_123')
		vi.mocked(requireAdmin).mockResolvedValue(undefined)
	})

	describe('POST /block/user', () => {
		it('should block a user successfully', async () => {
			const mockBlock = {
				id: 'block_123',
				blockingUserId: 'user_123',
				blockedUserId: 'user_456',
				createdAt: new Date(),
			}

			vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockTargetUser as any)
			vi.mocked(prisma.blockedUser.upsert).mockResolvedValue(mockBlock as any)

			const res = await app.request('/api/moderation/block/user', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username: 'bob' }),
			})

			expect(res.status).toBe(201)
			const body = (await res.json()) as typeof mockBlock
			expect(body.id).toBe('block_123')
			expect(prisma.blockedUser.upsert).toHaveBeenCalledWith({
				where: {
					blockingUserId_blockedUserId: {
						blockingUserId: 'user_123',
						blockedUserId: 'user_456',
					},
				},
				update: {},
				create: {
					blockingUserId: 'user_123',
					blockedUserId: 'user_456',
				},
			})
		})

		it('should block a user with reason', async () => {
			const mockBlock = {
				id: 'block_123',
				blockingUserId: 'user_123',
				blockedUserId: 'user_456',
				reason: 'Harassment',
				createdAt: new Date(),
			}

			vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockTargetUser as any)
			vi.mocked(prisma.blockedUser.upsert).mockResolvedValue(mockBlock as any)

			const res = await app.request('/api/moderation/block/user', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username: 'bob', reason: 'Harassment' }),
			})

			expect(res.status).toBe(201)
		})

		it('should return 404 when target user not found', async () => {
			vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

			const res = await app.request('/api/moderation/block/user', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username: 'nonexistent' }),
			})

			expect(res.status).toBe(404)
			const body = (await res.json()) as { error: string }
			expect(body.error).toBe('User not found')
			expect(prisma.blockedUser.upsert).not.toHaveBeenCalled()
		})

		it('should return 400 when trying to block yourself', async () => {
			vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)

			const res = await app.request('/api/moderation/block/user', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username: 'alice' }),
			})

			expect(res.status).toBe(400)
			const body = (await res.json()) as { error: string }
			expect(body.error).toBe('Cannot block yourself')
			expect(prisma.blockedUser.upsert).not.toHaveBeenCalled()
		})

		it('should return 400 for invalid request body', async () => {
			const res = await app.request('/api/moderation/block/user', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			})

			expect(res.status).toBe(400)
			const body = (await res.json()) as { error: string; details?: unknown }
			expect(body.error).toBe('Validation failed')
			expect(body.details).toBeDefined()
		})

		it('should handle errors gracefully', async () => {
			vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error('Database error'))

			const res = await app.request('/api/moderation/block/user', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username: 'bob' }),
			})

			expect(res.status).toBe(500)
			const body = (await res.json()) as { error: string }
			expect(body.error).toBe('Internal server error')
		})
	})

	describe('DELETE /block/user/:username', () => {
		it('should unblock a user successfully', async () => {
			vi.mocked(prisma.user.findUnique).mockResolvedValue(mockTargetUser as any)
			vi.mocked(prisma.blockedUser.delete).mockResolvedValue({
				id: 'block_123',
				blockingUserId: 'user_123',
				blockedUserId: 'user_456',
			} as any)

			const res = await app.request('/api/moderation/block/user/bob', {
				method: 'DELETE',
			})

			expect(res.status).toBe(200)
			const body = (await res.json()) as { success: boolean }
			expect(body.success).toBe(true)
			expect(prisma.blockedUser.delete).toHaveBeenCalledWith({
				where: {
					blockingUserId_blockedUserId: {
						blockingUserId: 'user_123',
						blockedUserId: 'user_456',
					},
				},
			})
		})

		it('should return 404 when target user not found', async () => {
			vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

			const res = await app.request('/api/moderation/block/user/nonexistent', {
				method: 'DELETE',
			})

			expect(res.status).toBe(404)
			const body = (await res.json()) as { error: string }
			expect(body.error).toBe('User not found')
		})

		it('should handle errors gracefully', async () => {
			vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error('Database error'))

			const res = await app.request('/api/moderation/block/user/bob', {
				method: 'DELETE',
			})

			expect(res.status).toBe(500)
		})
	})

	describe('GET /block/users', () => {
		it('should return list of blocked users', async () => {
			const mockBlocks = [
				{
					id: 'block_1',
					blockingUserId: 'user_123',
					blockedUserId: 'user_456',
					createdAt: new Date(),
				},
				{
					id: 'block_2',
					blockingUserId: 'user_123',
					blockedUserId: 'user_789',
					createdAt: new Date(),
				},
			]

			vi.mocked(prisma.blockedUser.findMany).mockResolvedValue(mockBlocks as any)

			const res = await app.request('/api/moderation/block/users')

			expect(res.status).toBe(200)
			const body = (await res.json()) as { blocks: unknown[] }
			expect(body.blocks).toHaveLength(2)
			expect(prisma.blockedUser.findMany).toHaveBeenCalledWith({
				where: { blockingUserId: 'user_123' },
				orderBy: { createdAt: 'desc' },
			})
		})

		it('should return empty list when no blocks', async () => {
			vi.mocked(prisma.blockedUser.findMany).mockResolvedValue([])

			const res = await app.request('/api/moderation/block/users')

			expect(res.status).toBe(200)
			const body = (await res.json()) as { blocks: unknown[] }
			expect(body.blocks).toHaveLength(0)
		})

		it('should handle errors gracefully', async () => {
			vi.mocked(prisma.blockedUser.findMany).mockRejectedValue(new Error('Database error'))

			const res = await app.request('/api/moderation/block/users')

			expect(res.status).toBe(500)
		})
	})

	describe('POST /block/domain', () => {
		it('should block a domain successfully (admin only)', async () => {
			vi.mocked(requireAuth).mockReturnValue('admin_123')
			const mockBlock = {
				id: 'domain_block_1',
				domain: 'spam.example.com',
				reason: 'Spam domain',
				createdAt: new Date(),
			}

			vi.mocked(prisma.blockedDomain.upsert).mockResolvedValue(mockBlock as any)

			const res = await app.request('/api/moderation/block/domain', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ domain: 'spam.example.com', reason: 'Spam domain' }),
			})

			expect(res.status).toBe(201)
			const body = (await res.json()) as typeof mockBlock
			expect(body.domain).toBe('spam.example.com')
			expect(prisma.blockedDomain.upsert).toHaveBeenCalledWith({
				where: { domain: 'spam.example.com' },
				update: {
					reason: 'Spam domain',
				},
				create: {
					domain: 'spam.example.com',
					reason: 'Spam domain',
				},
			})
		})

		it('should return 400 for invalid request body', async () => {
			const res = await app.request('/api/moderation/block/domain', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			})

			expect(res.status).toBe(400)
		})

		it('should handle errors gracefully', async () => {
			vi.mocked(prisma.blockedDomain.upsert).mockRejectedValue(new Error('Database error'))

			const res = await app.request('/api/moderation/block/domain', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ domain: 'spam.example.com' }),
			})

			expect(res.status).toBe(500)
		})
	})

	describe('DELETE /block/domain/:domain', () => {
		it('should unblock a domain successfully (admin only)', async () => {
			vi.mocked(requireAuth).mockReturnValue('admin_123')
			vi.mocked(prisma.blockedDomain.delete).mockResolvedValue({
				id: 'domain_block_1',
				domain: 'spam.example.com',
			} as any)

			const res = await app.request('/api/moderation/block/domain/spam.example.com', {
				method: 'DELETE',
			})

			expect(res.status).toBe(200)
			const body = (await res.json()) as { success: boolean }
			expect(body.success).toBe(true)
			expect(prisma.blockedDomain.delete).toHaveBeenCalledWith({
				where: { domain: 'spam.example.com' },
			})
		})

		it('should handle errors gracefully', async () => {
			vi.mocked(prisma.blockedDomain.delete).mockRejectedValue(new Error('Database error'))

			const res = await app.request('/api/moderation/block/domain/spam.example.com', {
				method: 'DELETE',
			})

			expect(res.status).toBe(500)
		})
	})

	describe('GET /block/domains', () => {
		it('should return list of blocked domains (admin only)', async () => {
			vi.mocked(requireAuth).mockReturnValue('admin_123')
			const mockBlocks = [
				{
					id: 'domain_block_1',
					domain: 'spam.example.com',
					reason: 'Spam',
					createdAt: new Date(),
				},
				{
					id: 'domain_block_2',
					domain: 'malicious.example.com',
					reason: 'Malicious content',
					createdAt: new Date(),
				},
			]

			vi.mocked(prisma.blockedDomain.findMany).mockResolvedValue(mockBlocks as any)

			const res = await app.request('/api/moderation/block/domains')

			expect(res.status).toBe(200)
			const body = (await res.json()) as { blocks: unknown[] }
			expect(body.blocks).toHaveLength(2)
			expect(prisma.blockedDomain.findMany).toHaveBeenCalledWith({
				orderBy: { createdAt: 'desc' },
			})
		})

		it('should return empty list when no domain blocks', async () => {
			vi.mocked(requireAuth).mockReturnValue('admin_123')
			vi.mocked(prisma.blockedDomain.findMany).mockResolvedValue([])

			const res = await app.request('/api/moderation/block/domains')

			expect(res.status).toBe(200)
			const body = (await res.json()) as { blocks: unknown[] }
			expect(body.blocks).toHaveLength(0)
		})
	})

	describe('POST /report', () => {
		it('should create a report for a user', async () => {
			const mockReport = {
				id: 'report_123',
				reporterId: 'user_123',
				reportedUserId: 'user_456',
				contentUrl: 'user:user_456',
				reason: 'Harassment',
				status: 'pending',
				createdAt: new Date(),
			}

			vi.mocked(prisma.user.findUnique).mockResolvedValue(mockTargetUser as any)
			vi.mocked(prisma.report.create).mockResolvedValue(mockReport as any)

			const res = await app.request('/api/moderation/report', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					targetType: 'user',
					targetId: 'user_456',
					reason: 'Harassment',
					category: 'harassment',
				}),
			})

			expect(res.status).toBe(201)
			const body = (await res.json()) as typeof mockReport
			expect(body.id).toBe('report_123')
			expect(prisma.report.create).toHaveBeenCalledWith({
				data: {
					reporterId: 'user_123',
					reportedUserId: 'user_456',
					contentUrl: 'user:user_456',
					reason: 'Harassment',
					status: 'pending',
				},
			})
		})

		it('should create a report for an event', async () => {
			const mockEvent = {
				id: 'event_123',
				title: 'Test Event',
			}

			const mockReport = {
				id: 'report_123',
				reporterId: 'user_123',
				reportedUserId: null,
				contentUrl: 'event:event_123',
				reason: 'Inappropriate content',
				status: 'pending',
				createdAt: new Date(),
			}

			vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as any)
			vi.mocked(prisma.report.create).mockResolvedValue(mockReport as any)

			const res = await app.request('/api/moderation/report', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					targetType: 'event',
					targetId: 'event_123',
					reason: 'Inappropriate content',
					category: 'inappropriate',
				}),
			})

			expect(res.status).toBe(201)
			expect(prisma.report.create).toHaveBeenCalledWith({
				data: {
					reporterId: 'user_123',
					reportedUserId: null,
					contentUrl: 'event:event_123',
					reason: 'Inappropriate content',
					status: 'pending',
				},
			})
		})

		it('should create a report for a comment', async () => {
			const mockComment = {
				id: 'comment_123',
				content: 'Test comment',
			}

			const mockReport = {
				id: 'report_123',
				reporterId: 'user_123',
				reportedUserId: null,
				contentUrl: 'comment:comment_123',
				reason: 'Spam',
				status: 'pending',
				createdAt: new Date(),
			}

			vi.mocked(prisma.comment.findUnique).mockResolvedValue(mockComment as any)
			vi.mocked(prisma.report.create).mockResolvedValue(mockReport as any)

			const res = await app.request('/api/moderation/report', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					targetType: 'comment',
					targetId: 'comment_123',
					reason: 'Spam',
					category: 'spam',
				}),
			})

			expect(res.status).toBe(201)
		})

		it('should return 404 when target user not found', async () => {
			vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

			const res = await app.request('/api/moderation/report', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					targetType: 'user',
					targetId: 'nonexistent',
					reason: 'Test reason',
				}),
			})

			expect(res.status).toBe(404)
			const body = (await res.json()) as { error: string }
			expect(body.error).toBe('User not found')
		})

		it('should return 404 when target event not found', async () => {
			vi.mocked(prisma.event.findUnique).mockResolvedValue(null)

			const res = await app.request('/api/moderation/report', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					targetType: 'event',
					targetId: 'nonexistent',
					reason: 'Test reason',
				}),
			})

			expect(res.status).toBe(404)
			const body = (await res.json()) as { error: string }
			expect(body.error).toBe('Event not found')
		})

		it('should return 404 when target comment not found', async () => {
			vi.mocked(prisma.comment.findUnique).mockResolvedValue(null)

			const res = await app.request('/api/moderation/report', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					targetType: 'comment',
					targetId: 'nonexistent',
					reason: 'Test reason',
				}),
			})

			expect(res.status).toBe(404)
			const body = (await res.json()) as { error: string }
			expect(body.error).toBe('Comment not found')
		})

		it('should return 400 for invalid request body', async () => {
			const res = await app.request('/api/moderation/report', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					targetType: 'invalid',
					targetId: 'test',
					reason: '',
				}),
			})

			expect(res.status).toBe(400)
		})

		it('should handle errors gracefully', async () => {
			vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error('Database error'))

			const res = await app.request('/api/moderation/report', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					targetType: 'user',
					targetId: 'user_456',
					reason: 'Test reason',
				}),
			})

			expect(res.status).toBe(500)
		})
	})

	describe('GET /reports', () => {
		it('should return list of reports (admin only)', async () => {
			vi.mocked(requireAuth).mockReturnValue('admin_123')
			const mockReports = [
				{
					id: 'report_1',
					reporterId: 'user_123',
					reportedUserId: 'user_456',
					contentUrl: 'user:user_456',
					reason: 'Harassment',
					status: 'pending',
					createdAt: new Date(),
					reporter: {
						id: 'user_123',
						username: 'alice',
						name: 'Alice',
					},
				},
			]

			vi.mocked(prisma.report.findMany).mockResolvedValue(mockReports as any)
			vi.mocked(prisma.report.count).mockResolvedValue(1)

			const res = await app.request('/api/moderation/reports')

			expect(res.status).toBe(200)
			const body = (await res.json()) as {
				reports: unknown[]
				pagination: { page: number; limit: number; total: number; pages: number }
			}
			expect(body.reports).toHaveLength(1)
			expect(body.pagination.total).toBe(1)
			expect(body.pagination.page).toBe(1)
		})

		it('should filter reports by status', async () => {
			vi.mocked(requireAuth).mockReturnValue('admin_123')
			vi.mocked(prisma.report.findMany).mockResolvedValue([])
			vi.mocked(prisma.report.count).mockResolvedValue(0)

			const res = await app.request('/api/moderation/reports?status=pending')

			expect(res.status).toBe(200)
			expect(prisma.report.findMany).toHaveBeenCalledWith({
				where: { status: 'pending' },
				include: {
					reporter: {
						select: {
							id: true,
							username: true,
							name: true,
						},
					},
				},
				orderBy: { createdAt: 'desc' },
				skip: 0,
				take: 20,
			})
		})

		it('should handle pagination', async () => {
			vi.mocked(requireAuth).mockReturnValue('admin_123')
			vi.mocked(prisma.report.findMany).mockResolvedValue([])
			vi.mocked(prisma.report.count).mockResolvedValue(50)

			const res = await app.request('/api/moderation/reports?page=2&limit=10')

			expect(res.status).toBe(200)
			expect(prisma.report.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					skip: 10,
					take: 10,
				})
			)
		})

		it('should limit max page size to 100', async () => {
			vi.mocked(requireAuth).mockReturnValue('admin_123')
			vi.mocked(prisma.report.findMany).mockResolvedValue([])
			vi.mocked(prisma.report.count).mockResolvedValue(0)

			const res = await app.request('/api/moderation/reports?limit=200')

			expect(res.status).toBe(200)
			expect(prisma.report.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					take: 100,
				})
			)
		})
	})

	describe('PUT /reports/:id', () => {
		it('should update report status (admin only)', async () => {
			vi.mocked(requireAuth).mockReturnValue('admin_123')
			const mockReport = {
				id: 'report_123',
				status: 'resolved',
				updatedAt: new Date(),
			}

			vi.mocked(prisma.report.update).mockResolvedValue(mockReport as any)

			const res = await app.request('/api/moderation/reports/report_123', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status: 'resolved' }),
			})

			expect(res.status).toBe(200)
			const body = (await res.json()) as typeof mockReport
			expect(body.status).toBe('resolved')
			expect(prisma.report.update).toHaveBeenCalledWith({
				where: { id: 'report_123' },
				data: { status: 'resolved' },
			})
		})

		it('should return 400 for invalid status', async () => {
			vi.mocked(requireAuth).mockReturnValue('admin_123')

			const res = await app.request('/api/moderation/reports/report_123', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status: 'invalid' }),
			})

			expect(res.status).toBe(400)
		})

		it('should handle errors gracefully', async () => {
			vi.mocked(requireAuth).mockReturnValue('admin_123')
			vi.mocked(prisma.report.update).mockRejectedValue(new Error('Database error'))

			const res = await app.request('/api/moderation/reports/report_123', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status: 'resolved' }),
			})

			expect(res.status).toBe(500)
		})
	})

	describe('GET /block/check/:username', () => {
		it('should return block status when user is blocked', async () => {
			const mockBlock = {
				id: 'block_123',
				blockingUserId: 'user_123',
				blockedUserId: 'user_456',
				createdAt: new Date(),
			}

			vi.mocked(prisma.user.findUnique).mockResolvedValue(mockTargetUser as any)
			vi.mocked(prisma.blockedUser.findUnique).mockResolvedValue(mockBlock as any)

			const res = await app.request('/api/moderation/block/check/bob')

			expect(res.status).toBe(200)
			const body = (await res.json()) as { blocked: boolean; block: unknown | null }
			expect(body.blocked).toBe(true)
			expect(body.block).toBeDefined()
		})

		it('should return block status when user is not blocked', async () => {
			vi.mocked(prisma.user.findUnique).mockResolvedValue(mockTargetUser as any)
			vi.mocked(prisma.blockedUser.findUnique).mockResolvedValue(null)

			const res = await app.request('/api/moderation/block/check/bob')

			expect(res.status).toBe(200)
			const body = (await res.json()) as { blocked: boolean; block: unknown | null }
			expect(body.blocked).toBe(false)
			expect(body.block).toBeNull()
		})

		it('should return 404 when target user not found', async () => {
			vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

			const res = await app.request('/api/moderation/block/check/nonexistent')

			expect(res.status).toBe(404)
			const body = (await res.json()) as { error: string }
			expect(body.error).toBe('User not found')
		})

		it('should handle errors gracefully', async () => {
			vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error('Database error'))

			const res = await app.request('/api/moderation/block/check/bob')

			expect(res.status).toBe(500)
		})
	})
})

