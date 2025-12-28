/**
 * Activity Feed
 * Returns activities from people the user follows
 */

import { Hono } from 'hono'
import { prisma } from './lib/prisma.js'
import { FeedService } from './services/FeedService.js'
import { EventVisibility } from '@prisma/client'

// Re-export type for FeedService usage if needed

export interface FeedEventSummary {
	id: string
	title: string
	startTime: string
	location: string | null
	visibility?: EventVisibility | null
	tags: Array<{
		id: string
		tag: string
	}>
	user: {
		id: string
		username: string
		name: string | null
		displayColor: string
	} | null
}

export interface FeedActivity {
	id: string
	type: string
	createdAt: string
	user: {
		id: string
		username: string
		name: string | null
		displayColor: string
		profileImage: string | null
	} | null
	event: FeedEventSummary
	sharedEvent?: FeedEventSummary
	data?: Record<string, unknown>
}

const app = new Hono()

// Get activity feed for authenticated user
app.get('/activity/feed', async (c) => {
	try {
		const userId = c.get('userId')
		const cursor = c.req.query('cursor')
		const limitParam = c.req.query('limit')
		const limit = limitParam ? parseInt(limitParam) : 20

		if (!userId) {
			return c.json({ items: [] })
		}

		const result = await FeedService.getFeed(userId, cursor, limit)
		return c.json(result)
	} catch (error) {
		console.error('Error getting activity feed:', error)
		return c.json({ error: 'Internal server error' }, 500)
	}
})

// Debug endpoint to check following relationships
// Only available in development
if (process.env.NODE_ENV !== 'production' && !process.env.VITEST) {
	app.get('/activity/debug', async (c) => {
		try {
			const userId = c.get('userId')

			if (!userId) {
				return c.json({ error: 'Not authenticated' }, 401)
			}

			const allFollowing = await prisma.following.findMany({
				where: { userId },
				select: {
					actorUrl: true,
					username: true,
					accepted: true,
				},
			})

			const allFollowers = await prisma.follower.findMany({
				where: { userId },
				select: {
					actorUrl: true,
					username: true,
					accepted: true,
					createdAt: true,
				},
			})

			return c.json({
				userId,
				following: allFollowing,
				followers: allFollowers,
				acceptedFollowing: allFollowing.filter((f) => f.accepted),
				unacceptedFollowing: allFollowing.filter((f) => !f.accepted),
			})
		} catch (error) {
			console.error('Error in debug endpoint:', error)
			return c.json({ error: 'Internal server error' }, 500)
		}
	})
}

export default app
