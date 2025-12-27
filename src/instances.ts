/**
 * Instance Discovery Routes
 * API endpoints for discovering and browsing federated instances
 */

import { Hono } from 'hono'
import { z, ZodError } from 'zod'
import { Prisma } from '@prisma/client'
import { refreshInstance } from './services/instancePoller.js'
import { requireAuth, requireAdmin } from './middleware/auth.js'
import { getKnownInstances, searchInstances, getInstanceStats } from './lib/instanceHelpers.js'
import { prisma } from './lib/prisma.js'
import { handleError } from './lib/errors.js'

const app = new Hono()

// Query schema for listing instances
const ListInstancesQuerySchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).optional().default(50),
	offset: z.coerce.number().int().min(0).optional().default(0),
	sortBy: z.enum(['activity', 'users', 'created']).optional().default('activity'),
	includeBlocked: z.coerce.boolean().optional().default(false),
})

// Query schema for searching instances
const SearchInstancesQuerySchema = z.object({
	q: z.string().min(1),
	limit: z.coerce.number().int().min(1).max(50).optional().default(20),
})

// Query schema for instance events
const InstanceEventsQuerySchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).optional().default(20),
	offset: z.coerce.number().int().min(0).optional().default(0),
	time: z.enum(['upcoming', 'past']).optional(),
})

// Get list of known instances
app.get('/', async (c) => {
	try {
		await requireAuth(c)

		const query = ListInstancesQuerySchema.parse({
			limit: c.req.query('limit'),
			offset: c.req.query('offset'),
			sortBy: c.req.query('sortBy'),
			includeBlocked: c.req.query('includeBlocked'),
		})

		const result = await getKnownInstances({
			limit: query.limit,
			offset: query.offset,
			sortBy: query.sortBy,
			filterBlocked: !query.includeBlocked,
		})

		return c.json(result)
	} catch (error) {
		if (error instanceof ZodError) {
			return c.json({ error: 'Validation failed', details: error.issues }, 400)
		}
		return handleError(error, c)
	}
})

// Search instances
app.get('/search', async (c) => {
	try {
		await requireAuth(c)

		const query = SearchInstancesQuerySchema.parse({
			q: c.req.query('q'),
			limit: c.req.query('limit'),
		})

		const instances = await searchInstances(query.q, query.limit)

		return c.json({ instances })
	} catch (error) {
		if (error instanceof ZodError) {
			return c.json({ error: 'Validation failed', details: error.issues }, 400)
		}
		return handleError(error, c)
	}
})

// Get instance events
app.get('/:domain/events', async (c) => {
	try {
		const userId = await requireAuth(c)

		const { domain } = c.req.param()
		const query = InstanceEventsQuerySchema.parse({
			limit: c.req.query('limit'),
			offset: c.req.query('offset'),
			time: c.req.query('time'),
		})
		const { limit, offset, time } = query

		const now = new Date()

		let whereCondition: Prisma.EventWhereInput = {
			OR: [
				{ externalId: { contains: `://${domain}/` } },
				{ externalId: { contains: `://${domain}:` } },
			],
		}

		let orderBy: Prisma.EventOrderByWithRelationInput = { startTime: 'desc' }

		if (time === 'upcoming') {
			whereCondition = {
				...whereCondition,
				startTime: { gte: now },
			}
			orderBy = { startTime: 'asc' } // Soonest first
		} else if (time === 'past') {
			whereCondition = {
				...whereCondition,
				startTime: { lt: now },
			}
			orderBy = { startTime: 'desc' } // Most recent past first
		}

		const events = await prisma.event.findMany({
			where: whereCondition,
			orderBy,
			take: limit,
			skip: offset,
			include: {
				user: true,
				attendance: {
					where: { userId },
				},
			},
		})

		const total = await prisma.event.count({
			where: whereCondition,
		})

		return c.json({ events, total, limit, offset })
	} catch (error) {
		return handleError(error, c)
	}
})

// Get specific instance details
app.get('/:domain', async (c) => {
	try {
		await requireAuth(c)

		const { domain } = c.req.param()

		const instance = await prisma.instance.findUnique({
			where: { domain },
		})

		if (!instance) {
			return c.json({ error: 'Instance not found' }, 404)
		}

		// Get connection stats
		const stats = await getInstanceStats(domain)

		return c.json({
			...instance,
			stats,
		})
	} catch (error) {
		return handleError(error, c)
	}
})

// Refresh instance metadata (admin only)
app.post('/:domain/refresh', async (c) => {
	try {
		await requireAdmin(c)

		const { domain } = c.req.param()

		const instance = await prisma.instance.findUnique({
			where: { domain },
		})

		if (!instance) {
			return c.json({ error: 'Instance not found' }, 404)
		}

		// Trigger hard refresh (metadata + timeline)
		await refreshInstance(domain)

		// Fetch updated instance
		const updated = await prisma.instance.findUnique({
			where: { domain },
		})

		return c.json(updated)
	} catch (error) {
		return handleError(error, c)
	}
})

// Block instance (admin only)
app.post('/:domain/block', async (c) => {
	try {
		await requireAdmin(c)

		const { domain } = c.req.param()

		const instance = await prisma.instance.update({
			where: { domain },
			data: { isBlocked: true },
		})

		return c.json(instance)
	} catch (error) {
		return handleError(error, c)
	}
})

// Unblock instance (admin only)
app.post('/:domain/unblock', async (c) => {
	try {
		await requireAdmin(c)

		const { domain } = c.req.param()

		const instance = await prisma.instance.update({
			where: { domain },
			data: { isBlocked: false },
		})

		return c.json(instance)
	} catch (error) {
		return handleError(error, c)
	}
})

export default app
