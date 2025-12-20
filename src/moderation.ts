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

type ReportWithReporter = Awaited<ReturnType<typeof prisma.report.findMany>>

async function enrichReportsWithContentPaths(reports: ReportWithReporter) {
	// Extract all unique event, user, and comment IDs from reports
	const eventIds = new Set<string>()
	const userIds = new Set<string>()
	const commentIds = new Set<string>()

	for (const report of reports) {
		if (!report.contentUrl) continue
		const [type, id] = report.contentUrl.split(':')
		if (type === 'event' && id) {
			eventIds.add(id)
		} else if (type === 'user' && id) {
			userIds.add(id)
		} else if (type === 'comment' && id) {
			commentIds.add(id)
		}
	}

	// Fetch all events and users in bulk
	const [events, users, comments] = await Promise.all([
		eventIds.size > 0
			? prisma.event.findMany({
					where: { id: { in: Array.from(eventIds) } },
					select: {
						id: true,
						user: { select: { username: true } },
						sharedEvent: { select: { id: true } },
					},
				})
			: Promise.resolve([]),
		userIds.size > 0
			? prisma.user.findMany({
					where: { id: { in: Array.from(userIds) } },
					select: { id: true, username: true },
				})
			: Promise.resolve([]),
		commentIds.size > 0
			? prisma.comment.findMany({
					where: { id: { in: Array.from(commentIds) } },
					select: {
						id: true,
						event: { select: { id: true, user: { select: { username: true } } } },
					},
				})
			: Promise.resolve([]),
	])

	// Create maps for efficient lookups
	const eventMap = new Map(events.map((e) => [e.id, e]))
	const userMap = new Map(users.map((u) => [u.id, u]))
	const commentMap = new Map(comments.map((c) => [c.id, c]))

	// Construct contentPath for each report using the maps
	return reports.map((report) => {
		if (!report.contentUrl) {
			return { ...report, contentPath: null }
		}

		const [type, id] = report.contentUrl.split(':')

		if (type === 'event' && id) {
			const event = eventMap.get(id)
			if (event?.user?.username) {
				const eventId = event.sharedEvent?.id || event.id
				return { ...report, contentPath: `/@${event.user.username}/${eventId}` }
			}
		} else if (type === 'user' && id) {
			const user = userMap.get(id)
			if (user?.username) {
				return { ...report, contentPath: `/@${user.username}` }
			}
		} else if (type === 'comment' && id) {
			const comment = commentMap.get(id)
			if (comment?.event?.user?.username) {
				return {
					...report,
					contentPath: `/@${comment.event.user.username}/${comment.event.id}#${comment.id}`,
				}
			}
		}

		return { ...report, contentPath: null }
	})
}

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

// Get my reports
app.get('/reports/me', async (c) => {
	const userId = requireAuth(c)

	const reports = await prisma.report.findMany({
		where: { reporterId: userId },
		orderBy: { createdAt: 'desc' },
	})

	return c.json({ reports })
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

	const reportsWithPaths = await enrichReportsWithContentPaths(reports)

	return c.json({
		reports: reportsWithPaths,
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
		statusEnum = z
			.enum(['pending', 'approved', 'rejected'])
			.transform((val) => {
				if (val === 'pending') return AppealStatus.PENDING
				if (val === 'approved') return AppealStatus.APPROVED
				return AppealStatus.REJECTED
			})
			.parse(statusParam.toLowerCase())
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
