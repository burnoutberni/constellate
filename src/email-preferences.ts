import { Hono } from 'hono'
import { requireAuth } from './middleware/auth.js'
import { moderateRateLimit } from './middleware/rateLimit.js'
import { AppError } from './lib/errors.js'
import { prisma } from './lib/prisma.js'
import { type NotificationType } from '@prisma/client'

type JsonStatusCode = 200 | 201 | 400 | 401 | 403 | 404 | 409 | 429 | 500

const app = new Hono()

// Default email preferences for new users
const DEFAULT_EMAIL_PREFERENCES = {
	FOLLOW: true,
	COMMENT: true,
	LIKE: true,
	MENTION: true,
	EVENT: true,
	SYSTEM: true,
}

app.get('/', moderateRateLimit, async (c) => {
	try {
		const userId = requireAuth(c)

		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { emailNotifications: true },
		})

		if (!user) {
			throw new AppError('USER_NOT_FOUND', 'User not found')
		}

		// Return preferences with defaults for missing values
		const preferences = (user.emailNotifications as Record<string, boolean>) || {}
		const preferencesWithDefaults = Object.keys(DEFAULT_EMAIL_PREFERENCES).reduce(
			(acc, key) => ({
				...acc,
				[key]:
					preferences[key] !== undefined
						? preferences[key]
						: DEFAULT_EMAIL_PREFERENCES[key as NotificationType],
			}),
			{}
		)

		return c.json({
			preferences: preferencesWithDefaults,
		})
	} catch (error) {
		if (error instanceof AppError) {
			return c.json(
				{ error: error.code, message: error.message },
				error.statusCode as JsonStatusCode
			)
		}
		console.error('Error fetching email preferences:', error)
		return c.json({ error: 'Internal server error' }, 500)
	}
})

app.put('/', moderateRateLimit, async (c) => {
	try {
		const userId = requireAuth(c)

		let body
		try {
			body = await c.req.json()
		} catch {
			return c.json({ error: 'Invalid JSON' }, 400)
		}

		// Validate the preferences object
		if (!body || typeof body !== 'object') {
			return c.json({ error: 'Invalid preferences object' }, 400)
		}

		// Validate each preference key and value
		const validatedPreferences: Record<string, boolean> = {}
		const validKeys = Object.keys(DEFAULT_EMAIL_PREFERENCES)

		for (const [key, value] of Object.entries(body)) {
			if (!validKeys.includes(key)) {
				return c.json({ error: `Invalid preference key: ${key}` }, 400)
			}
			if (typeof value !== 'boolean') {
				return c.json({ error: `Invalid value for ${key}: must be boolean` }, 400)
			}
			validatedPreferences[key] = value
		}

		// Fetch existing preferences and merge
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { emailNotifications: true },
		})

		if (!user) {
			throw new AppError('USER_NOT_FOUND', 'User not found')
		}

		const existingPreferences = (user.emailNotifications as Record<string, boolean>) || {}
		const mergedPreferences = { ...existingPreferences, ...validatedPreferences }

		// Update user preferences
		await prisma.user.update({
			where: { id: userId },
			data: {
				emailNotifications: mergedPreferences,
			},
		})

		return c.json({
			preferences: mergedPreferences,
			message: 'Email preferences updated successfully',
		})
	} catch (error) {
		if (error instanceof AppError) {
			return c.json(
				{ error: error.code, message: error.message },
				error.statusCode as JsonStatusCode
			)
		}
		console.error('Error updating email preferences:', error)
		return c.json({ error: 'Internal server error' }, 500)
	}
})

app.post('/reset', moderateRateLimit, async (c) => {
	try {
		const userId = requireAuth(c)

		// Reset to default preferences
		await prisma.user.update({
			where: { id: userId },
			data: {
				emailNotifications: DEFAULT_EMAIL_PREFERENCES,
			},
		})

		return c.json({
			preferences: DEFAULT_EMAIL_PREFERENCES,
			message: 'Email preferences reset to defaults',
		})
	} catch (error) {
		if (error instanceof AppError) {
			return c.json(
				{ error: error.code, message: error.message },
				error.statusCode as JsonStatusCode
			)
		}
		console.error('Error resetting email preferences:', error)
		return c.json({ error: 'Internal server error' }, 500)
	}
})

// Get email delivery history for the user
app.get('/deliveries', moderateRateLimit, async (c) => {
	try {
		const userId = requireAuth(c)
		const limit = Math.max(1, Math.min(parseInt(c.req.query('limit') || '20'), 100))
		const offset = Math.max(0, parseInt(c.req.query('offset') || '0'))

		const deliveries = await prisma.emailDelivery.findMany({
			where: { userId },
			orderBy: { sentAt: 'desc' },
			take: limit,
			skip: offset,
			select: {
				id: true,
				templateName: true,
				subject: true,
				status: true,
				sentAt: true,
				deliveredAt: true,
				openedAt: true,
				errorMessage: true,
			},
		})

		const total = await prisma.emailDelivery.count({
			where: { userId },
		})

		return c.json({
			deliveries,
			pagination: {
				total,
				limit,
				offset,
				hasMore: offset + limit < total,
			},
		})
	} catch (error) {
		if (error instanceof AppError) {
			return c.json(
				{ error: error.code, message: error.message },
				error.statusCode as JsonStatusCode
			)
		}
		console.error('Error fetching email deliveries:', error)
		return c.json({ error: 'Internal server error' }, 500)
	}
})

export default app
