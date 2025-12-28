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
import notificationsRoutes from './notifications.js'
import realtimeRoutes from './realtime.js'
import calendarRoutes from './calendar.js'
import templatesRoutes from './templates.js'
import remindersRoutes from './reminders.js'
import searchRoutes from './search.js'
import moderationRoutes from './moderation.js'
import userSearchRoutes from './userSearch.js'
import locationRoutes from './location.js'
import activityRoutes from './activity.js'
import adminRoutes from './admin.js'
import setupRoutes from './setup.js'
import recommendationsRoutes from './recommendations.js'
import instancesRoutes from './instances.js'
import sitemapRoutes from './sitemap.js'
import emailPreferencesRoutes from './email-preferences.js'
import { auth } from './auth.js'
import { authMiddleware } from './middleware/auth.js'
import { securityHeaders } from './middleware/security.js'
import { csrfProtection } from './middleware/csrf.js'
import { strictRateLimit } from './middleware/rateLimit.js'
import { handleError } from './lib/errors.js'
import { prisma } from './lib/prisma.js'
import { config } from './config.js'
import {
	startReminderDispatcher,
	stopReminderDispatcher,
	getIsProcessing,
} from './services/reminderDispatcher.js'
import {
	startPopularityUpdater,
	stopPopularityUpdater,
	getIsProcessing as getIsPopularityProcessing,
} from './services/popularityUpdater.js'
import { startInstancePoller, stopInstancePoller } from './services/instancePoller.js'
import {
	startDataExportProcessor,
	stopDataExportProcessor,
	getIsProcessing as getIsExportProcessing,
} from './services/dataExportProcessor.js'

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
		const openapi = JSON.parse(spec) as { servers: { url: string; description: string }[] }

		// Dynamically set server URL based on environment
		const serverUrl = process.env.BASE_URL || 'http://localhost:3000'
		openapi.servers = [
			{
				url: serverUrl,
				description: serverUrl.includes('localhost')
					? 'Development server'
					: 'Docker instance',
			},
		]

		return c.json(openapi)
	} catch {
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
app.use(
	'*',
	cors({
		origin: config.corsOrigins,
		credentials: true,
	})
)
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
			return c.json(
				{
					...health,
					error: error instanceof Error ? error.message : 'Database connection failed',
				},
				503
			)
		}
	}

	const statusCode = health.status === 'ok' ? 200 : 503
	return c.json(health, statusCode)
})

// Root endpoint - serve frontend in production, JSON in development
app.get('/', async (c) => {
	// In production, serve the frontend index.html
	if (process.env.NODE_ENV === 'production') {
		const fs = await import('fs/promises')
		const path = await import('path')
		const { fileURLToPath } = await import('url')

		const __filename = fileURLToPath(import.meta.url)
		const __dirname = path.dirname(__filename)
		const indexPath = path.join(__dirname, '..', 'client', 'dist', 'index.html')

		try {
			const indexContent = await fs.readFile(indexPath)
			return c.body(indexContent, 200, {
				'Content-Type': 'text/html',
			})
		} catch (error) {
			console.error('Error serving index.html:', error)
			return c.json({
				name: 'Constellate',
				version: '1.0.0',
				description: 'Federated event management platform',
				error: 'Frontend not found',
			})
		}
	}

	// In development, return JSON
	return c.json({
		name: 'Constellate',
		version: '1.0.0',
		description: 'Federated event management platform',
	})
})

// Mount routes
// Auth routes (better-auth)
// Note: ToS validation and post-signup actions (key generation, ToS timestamp) are now
// handled via better-auth hooks in src/auth.ts. This is more maintainable than
// intercepting and parsing request/response bodies, as it uses the official hooks API
// which is less brittle to changes in better-auth's internal structure.
// Apply strict rate limiting to auth routes (especially POST for signup/login)
app.on(['POST'], '/api/auth/*', strictRateLimit, async (c) => {
	return auth.handler(c.req.raw)
})

// GET requests to auth routes (no rate limiting needed, just for session checks)
app.on(['GET'], '/api/auth/*', async (c) => {
	return auth.handler(c.req.raw)
})

app.route('/', activitypubRoutes)
app.route('/api/events', eventsRoutes)
app.route('/api/events', attendanceRoutes)
app.route('/api/events', remindersRoutes)
app.route('/api/events', likesRoutes)
app.route('/api/events', commentsRoutes)
app.route('/api', profileRoutes)
app.route('/api/notifications', notificationsRoutes)
app.route('/api', realtimeRoutes)
app.route('/api/calendar', calendarRoutes)
app.route('/api', templatesRoutes)
app.route('/api/search', searchRoutes)
app.route('/api/recommendations', recommendationsRoutes)
app.route('/api/location', locationRoutes)
app.route('/api/moderation', moderationRoutes)
app.route('/api/user-search', userSearchRoutes)
app.route('/api', activityRoutes)
app.route('/api/admin', adminRoutes)
app.route('/api/setup', setupRoutes)
app.route('/api/instances', instancesRoutes)
app.route('/api/email-preferences', emailPreferencesRoutes)
app.route('/', sitemapRoutes)

// Serve static frontend files in production
// This should be after all API routes to ensure they take precedence
if (process.env.NODE_ENV === 'production') {
	app.get('*', async (c) => {
		const fs = await import('fs/promises')
		const path = await import('path')
		const { fileURLToPath } = await import('url')

		const __filename = fileURLToPath(import.meta.url)
		const __dirname = path.dirname(__filename)
		const clientDistPath = path.join(__dirname, '..', 'client', 'dist')
		const requestPath = c.req.path

		// Skip if this is an API route or special route
		if (
			requestPath.startsWith('/api') ||
			requestPath.startsWith('/doc') ||
			requestPath.startsWith('/reference') ||
			requestPath.startsWith('/health') ||
			requestPath.startsWith('/.well-known') ||
			requestPath.startsWith('/users') ||
			requestPath.startsWith('/inbox') ||
			requestPath.startsWith('/outbox') ||
			requestPath.startsWith('/followers') ||
			requestPath.startsWith('/following') ||
			requestPath === '/sitemap.xml' ||
			requestPath === '/robots.txt' ||
			requestPath.startsWith('/sitemap-')
		) {
			return c.notFound()
		}

		try {
			// Try to serve the requested file
			const filePath = path.join(
				clientDistPath,
				requestPath === '/' ? 'index.html' : requestPath
			)

			// Security: ensure the file is within the dist directory
			const resolvedPath = path.resolve(filePath)
			const resolvedDistPath = path.resolve(clientDistPath)
			if (!resolvedPath.startsWith(resolvedDistPath)) {
				return c.notFound()
			}

			// Check if file exists
			try {
				const stats = await fs.stat(filePath)
				if (stats.isFile()) {
					// Read the file content
					const fileContent = await fs.readFile(filePath)

					// Determine content type
					const ext = path.extname(filePath).toLowerCase()
					const contentTypes: Record<string, string> = {
						'.html': 'text/html',
						'.js': 'application/javascript',
						'.css': 'text/css',
						'.json': 'application/json',
						'.png': 'image/png',
						'.jpg': 'image/jpeg',
						'.jpeg': 'image/jpeg',
						'.gif': 'image/gif',
						'.svg': 'image/svg+xml',
						'.ico': 'image/x-icon',
						'.woff': 'font/woff',
						'.woff2': 'font/woff2',
						'.ttf': 'font/ttf',
						'.eot': 'application/vnd.ms-fontobject',
					}

					const contentType = contentTypes[ext] || 'application/octet-stream'

					return c.body(fileContent, 200, {
						'Content-Type': contentType,
					})
				}
			} catch (error) {
				// File doesn't exist, fall through to SPA routing
				console.debug('Static file not found, falling back to SPA:', error)
			}

			// SPA routing: serve index.html for any non-API route
			const indexPath = path.join(clientDistPath, 'index.html')
			try {
				const indexContent = await fs.readFile(indexPath)
				return c.body(indexContent, 200, {
					'Content-Type': 'text/html',
				})
			} catch (error) {
				console.error('Error serving index.html:', error)
				return c.notFound()
			}
		} catch (error) {
			console.error('Error serving static file:', error)
			return c.notFound()
		}
	})
}

// Only start background jobs and server when not in test environment
if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
	if (config.enableReminderDispatcher) {
		startReminderDispatcher()
	}

	// Start popularity updater background job
	startPopularityUpdater()

	// Start data export processor background job
	startDataExportProcessor()

	startInstancePoller()

	// Graceful shutdown handler
	const shutdown = async () => {
		console.log('🛑 Shutting down gracefully...')

		// Stop accepting new work
		stopReminderDispatcher()
		stopPopularityUpdater()
		stopDataExportProcessor()
		stopInstancePoller()

		// Wait for current processing cycles to complete (with timeout)
		const shutdownTimeout = 30000 // 30 seconds
		const startTime = Date.now()

		while (
			(getIsProcessing() || getIsPopularityProcessing() || getIsExportProcessing()) &&
			Date.now() - startTime < shutdownTimeout
		) {
			await new Promise((resolve) => setTimeout(resolve, 100))
		}

		if (getIsProcessing() || getIsPopularityProcessing() || getIsExportProcessing()) {
			console.warn('⚠️  Shutdown timeout reached, some operations may be incomplete')
		} else {
			console.log('✅ All operations completed')
		}

		// Close database connection
		try {
			await prisma.$disconnect()
		} catch (error) {
			console.error('Error disconnecting from database:', error)
		}

		process.exit(0)
	}

	process.on('SIGTERM', shutdown)
	process.on('SIGINT', shutdown)

	console.log(`🚀 Server starting on port ${config.port}`)

	serve({
		fetch: app.fetch,
		port: config.port,
	})
}

export { app }
