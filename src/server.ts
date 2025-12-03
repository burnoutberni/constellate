/**
 * Main Server Entry Point
 * Hono-based server with ActivityPub support
 */

import { serve } from '@hono/node-server'
import { OpenAPIHono } from '@hono/zod-openapi'
import { Scalar } from '@scalar/hono-api-reference'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import activitypubRoutes from './activitypub.js'
import eventsRoutes from './events.js'
import attendanceRoutes from './attendance.js'
import likesRoutes from './likes.js'
import commentsRoutes from './comments.js'
import profileRoutes from './profile.js'
import realtimeRoutes from './realtime.js'
import calendarRoutes from './calendar.js'
import searchRoutes from './search.js'
import moderationRoutes from './moderation.js'
import userSearchRoutes from './userSearch.js'
import activityRoutes from './activity.js'
import adminRoutes from './admin.js'
import { auth } from './auth.js'
import { authMiddleware } from './middleware/auth.js'
import { securityHeaders } from './middleware/security.js'
import { csrfProtection } from './middleware/csrf.js'
import { strictRateLimit } from './middleware/rateLimit.js'
import { handleError } from './lib/errors.js'
import { prisma } from './lib/prisma.js'
import { config } from './config.js'

const app = new OpenAPIHono()

// OpenAPI Docs
// Serve static OpenAPI specification
app.get('/doc', async (c) => {
    const fs = await import('fs/promises')
    const path = await import('path')
    const { fileURLToPath } = await import('url')

    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    const openapiPath = path.join(__dirname, 'openapi.json')

    try {
        const spec = await fs.readFile(openapiPath, 'utf-8')
        const openapi = JSON.parse(spec)

        // Dynamically set server URL based on environment
        const serverUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000'
        openapi.servers = [
            {
                url: serverUrl,
                description: serverUrl.includes('localhost') ? 'Development server' : 'Docker instance'
            }
        ]

        return c.json(openapi)
    } catch (error) {
        return c.json({ error: 'OpenAPI spec not found' }, 500)
    }
})

app.get(
    '/reference',
    Scalar({
        spec: {
            url: '/doc',
        },
    } as unknown as Parameters<typeof Scalar>[0])
)

// Global error handler
app.onError((err, c) => {
    return handleError(err, c)
})

// Middleware (order matters)
// Only enable logger when not in test environment
if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
    app.use('*', logger())
}
app.use('*', securityHeaders) // Security headers first
app.use('*', cors({
    origin: config.corsOrigins,
    credentials: true,
}))
app.use('*', authMiddleware)
// Apply CSRF protection to all API routes (state-changing operations)
// Skip CSRF in test environment to allow tests to run without tokens
if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
    app.use('/api/*', csrfProtection)
}

// Health check endpoint with database connectivity check
app.get('/health', async (c) => {
    const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        checks: {
            database: 'unknown' as 'ok' | 'error' | 'unknown',
        },
    }
    
    // Check database connectivity
    try {
        await prisma.$queryRaw`SELECT 1`
        health.checks.database = 'ok'
    } catch (error) {
        health.checks.database = 'error'
        health.status = 'degraded'
        
        // In production, don't expose error details
        if (config.isDevelopment) {
            return c.json({
                ...health,
                error: error instanceof Error ? error.message : 'Database connection failed',
            }, 503)
        }
    }
    
    const statusCode = health.status === 'ok' ? 200 : 503
    return c.json(health, statusCode)
})

// Root endpoint
app.get('/', (c) => {
    return c.json({
        name: 'Stellar Calendar',
        version: '1.0.0',
        description: 'Federated event management platform',
    })
})

// Mount routes
// Auth routes (better-auth) - intercept to generate keys after signup
// Apply strict rate limiting to auth routes (especially POST for signup/login)
app.on(['POST'], '/api/auth/*', strictRateLimit, async (c) => {
    const response = await auth.handler(c.req.raw)

    // If this is a signup request, generate keys for the new user
    if (c.req.method === 'POST' && (c.req.path.includes('/sign-up') || c.req.path.includes('/signup'))) {
        // Only proceed if response is successful
        if (response.ok) {
            try {
                const responseClone = response.clone()
                const data = await responseClone.json() as unknown as { user?: { id: string } }

                // Try to get user ID from response
                const userId = data?.user?.id || (data as unknown as { data?: { user?: { id: string } } })?.data?.user?.id

                if (userId) {
                    // Query database to get the full user with username
                    const user = await prisma.user.findUnique({
                        where: { id: userId },
                        select: {
                            id: true,
                            username: true,
                            isRemote: true,
                            publicKey: true,
                            privateKey: true,
                        },
                    })

                    // Only generate keys if user exists, is local, and doesn't have keys
                    if (user && !user.isRemote && (!user.publicKey || !user.privateKey)) {
                        // Generate keys in the background (don't block the response)
                        const { generateUserKeys } = await import('./auth.js')
                        generateUserKeys(user.id, user.username).catch((err) => {
                            console.error('Error generating keys after signup:', err)
                        })
                    }
                }
            } catch (err) {
                // If we can't parse the response, that's okay - continue
                // This might happen if the response isn't JSON or is already consumed
            }
        }
    }

    return response
})

// GET requests to auth routes (no rate limiting needed, just for session checks)
app.on(['GET'], '/api/auth/*', async (c) => {
    return auth.handler(c.req.raw)
})

app.route('/', activitypubRoutes)
app.route('/api/events', eventsRoutes)
app.route('/api/events', attendanceRoutes)
app.route('/api/events', likesRoutes)
app.route('/api/events', commentsRoutes)
app.route('/api', profileRoutes)
app.route('/api', realtimeRoutes)
app.route('/api/calendar', calendarRoutes)
app.route('/api/search', searchRoutes)
app.route('/api/moderation', moderationRoutes)
app.route('/api/user-search', userSearchRoutes)
app.route('/api', activityRoutes)
app.route('/api/admin', adminRoutes)

// Only start server when not in test environment
if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
    console.log(`🚀 Server starting on port ${config.port}`)

    serve({
        fetch: app.fetch,
        port: config.port,
    })
}

export { app }
