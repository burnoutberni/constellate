/**
 * Moderation Features
 * User blocking, domain blocking, and content reporting
 */

import { Hono } from 'hono'
import { z, ZodError } from 'zod'
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

// Report schema
const ReportSchema = z.object({
    targetType: z.enum(['user', 'event', 'comment']),
    targetId: z.string(),
    reason: z.string().min(1).max(1000),
    category: z.enum(['spam', 'harassment', 'inappropriate', 'other']).optional(),
})

// Block a user
app.post('/block/user', async (c) => {
    try {
        const userId = requireAuth(c)

        const body = await c.req.json()
        const { username, reason } = BlockUserSchema.parse(body)

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
    } catch (error) {
        if (error instanceof ZodError) {
            return c.json({ error: 'Validation failed', details: error.issues }, 400 as const)
        }
        console.error('Error blocking user:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Unblock a user
app.delete('/block/user/:username', async (c) => {
    try {
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
    } catch (error) {
        console.error('Error unblocking user:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Get blocked users
app.get('/block/users', async (c) => {
    try {
        const userId = requireAuth(c)

        const blocks = await prisma.blockedUser.findMany({
            where: { blockingUserId: userId },
            orderBy: { createdAt: 'desc' },
        })

        return c.json({ blocks })
    } catch (error) {
        console.error('Error getting blocked users:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Block a domain (admin only)
app.post('/block/domain', async (c) => {
    try {
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
    } catch (error) {
        if (error instanceof ZodError) {
            return c.json({ error: 'Validation failed', details: error.issues }, 400 as const)
        }
        console.error('Error blocking domain:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Unblock a domain (admin only)
app.delete('/block/domain/:domain', async (c) => {
    try {
        await requireAdmin(c)

        const { domain } = c.req.param()

        await prisma.blockedDomain.delete({
            where: { domain },
        })

        return c.json({ success: true })
    } catch (error) {
        console.error('Error unblocking domain:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Get blocked domains (admin only)
app.get('/block/domains', async (c) => {
    try {
        await requireAdmin(c)

        const blocks = await prisma.blockedDomain.findMany({
            orderBy: { createdAt: 'desc' },
        })

        return c.json({ blocks })
    } catch (error) {
        console.error('Error getting blocked domains:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Report content
app.post('/report', async (c) => {
    try {
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
                status: 'pending',
            },
        })

        return c.json(report, 201)
    } catch (error) {
        if (error instanceof ZodError) {
            return c.json({ error: 'Validation failed', details: error.issues }, 400 as const)
        }
        console.error('Error creating report:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Get reports (admin only)
app.get('/reports', async (c) => {
    try {
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
    } catch (error) {
        console.error('Error getting reports:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Update report status (admin only)
app.put('/reports/:id', async (c) => {
    try {
        await requireAdmin(c)

        const { id } = c.req.param()
        const body = await c.req.json()
        const { status } = z.object({
            status: z.enum(['pending', 'resolved', 'dismissed']),
        }).parse(body)

        const report = await prisma.report.update({
            where: { id },
            data: {
                status,
            },
        })

        return c.json(report)
    } catch (error) {
        if (error instanceof ZodError) {
            return c.json({ error: 'Validation failed', details: error.issues }, 400 as const)
        }
        console.error('Error updating report:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Check if user is blocked
app.get('/block/check/:username', async (c) => {
    try {
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
    } catch (error) {
        console.error('Error checking block:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

export default app
