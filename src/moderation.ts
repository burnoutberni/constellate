/**
 * Moderation Features
 * User blocking, domain blocking, and content reporting
 */

import { Hono } from 'hono'
import { z } from 'zod'
import { AppealStatus, AppealType, ReportCategory } from '@prisma/client'
import { requireAuth, requireAdmin } from './middleware/auth.js'
import { prisma } from './lib/prisma.js'

const app = new Hono()

// Block user schema
const BlockUserSchema = z.object({
	username: z.string(),
	reason: z.string().optional(),
})

// Block domain schema
const BlockDomainSchema = z.object({
	domain: z.string(),
	reason: z.string().optional(),
})

// Report category enum values for Zod validation
const ReportCategoryValues = [
	ReportCategory.spam,
	ReportCategory.harassment,
	ReportCategory.inappropriate,
	ReportCategory.other,
] as const

// Report schema
const ReportSchema = z.object({
	targetType: z.enum(['user', 'event', 'comment']),
	targetId: z.string(),
	reason: z.string().min(1).max(1000),
	category: z.enum(ReportCategoryValues).optional(),
})

// Block a user
app.post('/block/user', async (c) => {
	const userId = requireAuth(c)

	const body = await c.req.json()
	const { username } = BlockUserSchema.parse(body)

	// Find target user
	const targetUser = await prisma.user.findUnique({
		where: { username },
	})

	if (!targetUser) {
		return c.json({ error: 'User not found' }, 404)
	}

	if (targetUser.id === userId) {
		return c.json({ error: 'Cannot block yourself' }, 400)
	}

	// Create block
	const block = await prisma.blockedUser.upsert({
		where: {
			blockingUserId_blockedUserId: {
				blockingUserId: userId,
				blockedUserId: targetUser.id,
			},
		},
		update: {},
		create: {
			blockingUserId: userId,
			blockedUserId: targetUser.id,
		},
	})

	return c.json(block, 201)
})

// Unblock a user
app.delete('/block/user/:username', async (c) => {
	const userId = requireAuth(c)

	const { username } = c.req.param()

	// Find target user
	const targetUser = await prisma.user.findUnique({
		where: { username },
	})

	if (!targetUser) {
		return c.json({ error: 'User not found' }, 404)
	}

	// Delete block
	await prisma.blockedUser.delete({
		where: {
			blockingUserId_blockedUserId: {
				blockingUserId: userId,
				blockedUserId: targetUser.id,
			},
		},
	})

	return c.json({ success: true })
})

// Get blocked users
app.get('/block/users', async (c) => {
	const userId = requireAuth(c)

	const blocks = await prisma.blockedUser.findMany({
		where: { blockingUserId: userId },
		orderBy: { createdAt: 'desc' },
	})

	return c.json({ blocks })
})

// Block a domain (admin only)
app.post('/block/domain', async (c) => {
	await requireAdmin(c)

	const body = await c.req.json()
	const { domain, reason } = BlockDomainSchema.parse(body)

	// Create domain block
	const block = await prisma.blockedDomain.upsert({
		where: { domain },
		update: {
			reason,
		},
		create: {
			domain,
			reason,
		},
	})

	return c.json(block, 201)
})

// Unblock a domain (admin only)
app.delete('/block/domain/:domain', async (c) => {
	await requireAdmin(c)

	const { domain } = c.req.param()

	await prisma.blockedDomain.delete({
		where: { domain },
	})

	return c.json({ success: true })
})

// Get blocked domains (admin only)
app.get('/block/domains', async (c) => {
	await requireAdmin(c)

	const blocks = await prisma.blockedDomain.findMany({
		orderBy: { createdAt: 'desc' },
	})

	return c.json({ blocks })
})

// Report content
app.post('/report', async (c) => {
	const userId = requireAuth(c)

	const body = await c.req.json()
	const { targetType, targetId, reason, category } = ReportSchema.parse(body)

	// Verify target exists
	if (targetType === 'user') {
		const user = await prisma.user.findUnique({ where: { id: targetId } })
		if (!user) {
			return c.json({ error: 'User not found' }, 404)
		}
	} else if (targetType === 'event') {
		const event = await prisma.event.findUnique({ where: { id: targetId } })
		if (!event) {
			return c.json({ error: 'Event not found' }, 404)
		}
	} else if (targetType === 'comment') {
		const comment = await prisma.comment.findUnique({ where: { id: targetId } })
		if (!comment) {
			return c.json({ error: 'Comment not found' }, 404)
		}
	}

	// Create report
	// Store target info in contentUrl field
	const contentUrl = `${targetType}:${targetId}`

	const report = await prisma.report.create({
		data: {
			reporterId: userId,
			reportedUserId: targetType === 'user' ? targetId : null,
			contentUrl,
			reason,
			category: category || ReportCategory.other,
			status: 'pending',
		},
	})

	return c.json(report, 201)
})

// Get reports (admin only)
app.get('/reports', async (c) => {
	await requireAdmin(c)

	const status = c.req.query('status') as 'pending' | 'resolved' | 'dismissed' | undefined
	const page = parseInt(c.req.query('page') || '1')
	const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100)
	const skip = (page - 1) * limit

	const where = status ? { status } : {}

	const [reports, total] = await Promise.all([
		prisma.report.findMany({
			where,
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
			skip,
			take: limit,
		}),
		prisma.report.count({ where }),
	])

	return c.json({
		reports,
		pagination: {
			page,
			limit,
			total,
			pages: Math.ceil(total / limit),
		},
	})
})

// Update report status (admin only)
app.put('/reports/:id', async (c) => {
	await requireAdmin(c)

	const { id } = c.req.param()
	const body = await c.req.json()
	const { status } = z
		.object({
			status: z.enum(['pending', 'resolved', 'dismissed']),
		})
		.parse(body)

	const report = await prisma.report.update({
		where: { id },
		data: {
			status,
		},
	})

	return c.json(report)
})

// Check if user is blocked
app.get('/block/check/:username', async (c) => {
	const userId = requireAuth(c)

	const { username } = c.req.param()

	const targetUser = await prisma.user.findUnique({
		where: { username },
	})

	if (!targetUser) {
		return c.json({ error: 'User not found' }, 404)
	}

	const block = await prisma.blockedUser.findUnique({
		where: {
			blockingUserId_blockedUserId: {
				blockingUserId: userId,
				blockedUserId: targetUser.id,
			},
		},
	})

	return c.json({
		blocked: !!block,
		block: block || null,
	})
})

// Appeal schema
const AppealSchema = z.object({
	type: z.nativeEnum(AppealType),
	reason: z.string().min(1).max(2000),
	referenceId: z.string().optional(),
	referenceType: z.string().optional(),
})

// Create an appeal
app.post('/appeals', async (c) => {
	const userId = requireAuth(c)
	const body = await c.req.json()
	const { type, reason, referenceId, referenceType } = AppealSchema.parse(body)

	const appeal = await prisma.appeal.create({
		data: {
			userId,
			type,
			reason,
			referenceId,
			referenceType,
			status: AppealStatus.PENDING,
		},
	})

	return c.json(appeal, 201)
})

// Get my appeals
app.get('/appeals', async (c) => {
	const userId = requireAuth(c)
	const appeals = await prisma.appeal.findMany({
		where: { userId },
		orderBy: { createdAt: 'desc' },
	})
	return c.json({ appeals })
})

// Get all appeals (admin only)
app.get('/admin/appeals', async (c) => {
	await requireAdmin(c)
	const statusParam = c.req.query('status')
	const page = parseInt(c.req.query('page') || '1')
	const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100)
	const skip = (page - 1) * limit

	// Validate and convert status query parameter to enum value
	let statusEnum: AppealStatus | undefined
	if (statusParam) {
		// Accept lowercase strings and convert to enum
		// Invalid values will throw an error, caught by global error handler
		const validated = z
			.enum(['pending', 'approved', 'rejected'])
			.transform((val) => {
				if (val === 'pending') return AppealStatus.PENDING
				if (val === 'approved') return AppealStatus.APPROVED
				if (val === 'rejected') return AppealStatus.REJECTED
				throw new Error(`Invalid status: ${val}`)
			})
			.parse(statusParam.toLowerCase())
		statusEnum = validated
	}

	const where = statusEnum ? { status: statusEnum } : {}

	const [appeals, total] = await Promise.all([
		prisma.appeal.findMany({
			where,
			include: {
				user: {
					select: { id: true, username: true, name: true },
				},
			},
			orderBy: { createdAt: 'desc' },
			skip,
			take: limit,
		}),
		prisma.appeal.count({ where }),
	])

	return c.json({
		appeals,
		pagination: {
			page,
			limit,
			total,
			pages: Math.ceil(total / limit),
		},
	})
})

// Resolve appeal (admin only)
app.put('/admin/appeals/:id', async (c) => {
	const userId = requireAuth(c)
	await requireAdmin(c)
	const { id } = c.req.param()
	const body = await c.req.json()
	const { status, adminNotes } = z
		.object({
			status: z
				.string()
				.transform((val) => val.toLowerCase())
				.pipe(
					z.enum(['approved', 'rejected'], {
						message: 'Status must be "approved" or "rejected"',
					})
				)
				.transform((val) =>
					val === 'approved' ? AppealStatus.APPROVED : AppealStatus.REJECTED
				),
			adminNotes: z.string().optional(),
		})
		.parse(body)

	const appeal = await prisma.appeal.update({
		where: { id },
		data: {
			status,
			adminNotes,
			resolvedAt: new Date(),
			resolvedBy: userId,
		},
	})

	return c.json(appeal)
})

export default app
