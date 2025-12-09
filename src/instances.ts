/**
 * Instance Discovery Routes
 * API endpoints for discovering and browsing federated instances
 */

import { Hono } from 'hono'
import { z, ZodError } from 'zod'
import { requireAuth, requireAdmin } from './middleware/auth.js'
import { getKnownInstances, searchInstances, refreshInstanceMetadata } from './lib/instanceHelpers.js'
import { prisma } from './lib/prisma.js'
import { handleError } from './lib/errors.js'

const app = new Hono()

// Query schema for listing instances
const ListInstancesQuerySchema = z.object({
    limit: z.string().optional().transform((val) => Math.min(parseInt(val || '50'), 100)),
    offset: z.string().optional().transform((val) => parseInt(val || '0')),
    sortBy: z.enum(['activity', 'users', 'created']).optional().default('activity'),
})

// Query schema for searching instances
const SearchInstancesQuerySchema = z.object({
    q: z.string().min(1),
    limit: z.string().optional().transform((val) => Math.min(parseInt(val || '20'), 50)),
})

// Get list of known instances
app.get('/', async (c) => {
    try {
        await requireAuth(c)

        const query = ListInstancesQuerySchema.parse({
            limit: c.req.query('limit'),
            offset: c.req.query('offset'),
            sortBy: c.req.query('sortBy'),
        })

        const result = await getKnownInstances({
            limit: query.limit,
            offset: query.offset,
            sortBy: query.sortBy,
            filterBlocked: true,
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
        const [remoteUserCount, remoteEventCount, localFollowingCount, localFollowersCount] = await Promise.all([
            prisma.user.count({
                where: {
                    isRemote: true,
                    externalActorUrl: {
                        contains: domain,
                    },
                },
            }),
            prisma.event.count({
                where: {
                    externalId: {
                        contains: domain,
                    },
                },
            }),
            prisma.following.count({
                where: {
                    actorUrl: {
                        contains: domain,
                    },
                },
            }),
            prisma.follower.count({
                where: {
                    actorUrl: {
                        contains: domain,
                    },
                },
            }),
        ])

        return c.json({
            ...instance,
            stats: {
                remoteUsers: remoteUserCount,
                remoteEvents: remoteEventCount,
                localFollowing: localFollowingCount,
                localFollowers: localFollowersCount,
            },
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

        await refreshInstanceMetadata(domain)

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
