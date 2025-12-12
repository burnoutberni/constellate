/**
 * Integration tests for Activity Feed API
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { config } from 'dotenv'
config()
import { app } from '../server.js'
import { prisma } from '../lib/prisma.js'
import * as authModule from '../auth.js'

// Mock dependencies
vi.mock('../services/ActivityBuilder.js')
vi.mock('../services/ActivityDelivery.js')
vi.mock('../realtime.js')

describe('Activity Feed API', () => {
	let testUser: any
	let followedUser: any
	const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000'

	beforeEach(async () => {
		// Clean up
		await prisma.eventTag.deleteMany({})
		await prisma.eventAttendance.deleteMany({})
		await prisma.eventLike.deleteMany({})
		await prisma.comment.deleteMany({})
		await prisma.event.deleteMany({})
		await prisma.following.deleteMany({})
		await prisma.user.deleteMany({})

		// Create test user
		const timestamp = Date.now()
		const randomSuffix = Math.random().toString(36).substring(7)
		const suffix = `${timestamp}_${randomSuffix}`

		testUser = await prisma.user.create({
			data: {
				username: `viewer_${suffix}`,
				email: `viewer_${suffix}@test.com`,
				name: 'Viewer User',
				isRemote: false,
			},
		})

		followedUser = await prisma.user.create({
			data: {
				username: `followed_${suffix}`,
				email: `followed_${suffix}@test.com`,
				name: 'Followed User',
				isRemote: false,
			},
		})

		// Create following relationship
		await prisma.following.create({
			data: {
				userId: testUser.id,
				actorUrl: `${baseUrl}/users/${followedUser.username}`,
				username: followedUser.username,
				inboxUrl: `${baseUrl}/users/${followedUser.username}/inbox`,
				accepted: true,
			},
		})

		vi.clearAllMocks()

		// Mock auth
		vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue({
			user: {
				id: testUser.id,
				username: testUser.username,
				email: testUser.email,
			},
			session: {
				id: 'test-session',
				userId: testUser.id,
			},
		} as any)
	})

	afterEach(async () => {
		vi.restoreAllMocks()
	})

	describe('GET /api/activity/feed', () => {
		it('should return empty array when user has no following', async () => {
			// Remove following relationship
			await prisma.following.deleteMany({})

			const res = await app.request('/api/activity/feed', {
				headers: {
					Cookie: 'better-auth.session_token=test-token',
				},
			})

			expect(res.status).toBe(200)
			const body = (await res.json()) as any
			expect(body.activities).toEqual([])
		})

		it('should include tags in like activities', async () => {
			// Create event with tags
			const event = await prisma.event.create({
				data: {
					title: 'Tech Conference',
					startTime: new Date(Date.now() + 86400000),
					userId: followedUser.id,
					attributedTo: `${baseUrl}/users/${followedUser.username}`,
					visibility: 'PUBLIC',
					tags: {
						create: [{ tag: 'tech' }, { tag: 'conference' }],
					},
				},
			})

			// Create like
			await prisma.eventLike.create({
				data: {
					eventId: event.id,
					userId: followedUser.id,
				},
			})

			const res = await app.request('/api/activity/feed', {
				headers: {
					Cookie: 'better-auth.session_token=test-token',
				},
			})

			expect(res.status).toBe(200)
			const body = (await res.json()) as any
			const likeActivity = body.activities.find((a: any) => a.type === 'like')
			expect(likeActivity).toBeDefined()
			expect(likeActivity.event.tags).toBeDefined()
			expect(Array.isArray(likeActivity.event.tags)).toBe(true)
			expect(likeActivity.event.tags).toHaveLength(2)
			expect(likeActivity.event.tags[0].tag).toBe('tech')
			expect(likeActivity.event.tags[1].tag).toBe('conference')
		})

		it('should include tags in RSVP activities', async () => {
			// Create event with tags
			const event = await prisma.event.create({
				data: {
					title: 'Networking Event',
					startTime: new Date(Date.now() + 86400000),
					userId: followedUser.id,
					attributedTo: `${baseUrl}/users/${followedUser.username}`,
					visibility: 'PUBLIC',
					tags: {
						create: [{ tag: 'networking' }, { tag: 'social' }],
					},
				},
			})

			// Create RSVP
			await prisma.eventAttendance.create({
				data: {
					eventId: event.id,
					userId: followedUser.id,
					status: 'attending',
				},
			})

			const res = await app.request('/api/activity/feed', {
				headers: {
					Cookie: 'better-auth.session_token=test-token',
				},
			})

			expect(res.status).toBe(200)
			const body = (await res.json()) as any
			const rsvpActivity = body.activities.find((a: any) => a.type === 'rsvp')
			expect(rsvpActivity).toBeDefined()
			expect(rsvpActivity.event.tags).toBeDefined()
			expect(rsvpActivity.event.tags).toHaveLength(2)
			expect(rsvpActivity.event.tags[0].tag).toBe('networking')
			expect(rsvpActivity.event.tags[1].tag).toBe('social')
		})

		it('should include tags in comment activities', async () => {
			// Create event with tags
			const event = await prisma.event.create({
				data: {
					title: 'Discussion Event',
					startTime: new Date(Date.now() + 86400000),
					userId: followedUser.id,
					attributedTo: `${baseUrl}/users/${followedUser.username}`,
					visibility: 'PUBLIC',
					tags: {
						create: [{ tag: 'discussion' }],
					},
				},
			})

			// Create comment
			await prisma.comment.create({
				data: {
					eventId: event.id,
					authorId: followedUser.id,
					content: 'Looking forward to this!',
				},
			})

			const res = await app.request('/api/activity/feed', {
				headers: {
					Cookie: 'better-auth.session_token=test-token',
				},
			})

			expect(res.status).toBe(200)
			const body = (await res.json()) as any
			const commentActivity = body.activities.find((a: any) => a.type === 'comment')
			expect(commentActivity).toBeDefined()
			expect(commentActivity.event.tags).toBeDefined()
			expect(commentActivity.event.tags).toHaveLength(1)
			expect(commentActivity.event.tags[0].tag).toBe('discussion')
		})

		it('should include tags in event_created activities', async () => {
			// Create event with tags
			await prisma.event.create({
				data: {
					title: 'New Product Launch',
					startTime: new Date(Date.now() + 86400000),
					userId: followedUser.id,
					attributedTo: `${baseUrl}/users/${followedUser.username}`,
					visibility: 'PUBLIC',
					tags: {
						create: [{ tag: 'launch' }, { tag: 'product' }, { tag: 'announcement' }],
					},
				},
			})

			const res = await app.request('/api/activity/feed', {
				headers: {
					Cookie: 'better-auth.session_token=test-token',
				},
			})

			expect(res.status).toBe(200)
			const body = (await res.json()) as any
			expect(body.activities).toHaveLength(1)
			expect(body.activities[0].type).toBe('event_created')
			expect(body.activities[0].event.tags).toBeDefined()
			expect(body.activities[0].event.tags).toHaveLength(3)
			expect(body.activities[0].event.tags.map((t: { tag: string }) => t.tag)).toEqual([
				'launch',
				'product',
				'announcement',
			])
		})

		it('should return empty tags array for events without tags', async () => {
			// Create event without tags
			const event = await prisma.event.create({
				data: {
					title: 'Event Without Tags',
					startTime: new Date(Date.now() + 86400000),
					userId: followedUser.id,
					attributedTo: `${baseUrl}/users/${followedUser.username}`,
					visibility: 'PUBLIC',
				},
			})

			// Create like
			await prisma.eventLike.create({
				data: {
					eventId: event.id,
					userId: followedUser.id,
				},
			})

			const res = await app.request('/api/activity/feed', {
				headers: {
					Cookie: 'better-auth.session_token=test-token',
				},
			})

			expect(res.status).toBe(200)
			const body = (await res.json()) as any
			const likeActivity = body.activities.find((a: any) => a.type === 'like')
			expect(likeActivity).toBeDefined()
			expect(likeActivity.event.tags).toBeDefined()
			expect(Array.isArray(likeActivity.event.tags)).toBe(true)
			expect(likeActivity.event.tags).toHaveLength(0)
		})

		it('should include tags in all activity types in mixed feed', async () => {
			// Create multiple events with tags
			const event1 = await prisma.event.create({
				data: {
					title: 'Event 1',
					startTime: new Date(Date.now() + 86400000),
					userId: followedUser.id,
					attributedTo: `${baseUrl}/users/${followedUser.username}`,
					visibility: 'PUBLIC',
					tags: { create: [{ tag: 'tag1' }] },
				},
			})

			const event2 = await prisma.event.create({
				data: {
					title: 'Event 2',
					startTime: new Date(Date.now() + 86400000),
					userId: followedUser.id,
					attributedTo: `${baseUrl}/users/${followedUser.username}`,
					visibility: 'PUBLIC',
					tags: { create: [{ tag: 'tag2' }] },
				},
			})

			const event3 = await prisma.event.create({
				data: {
					title: 'Event 3',
					startTime: new Date(Date.now() + 86400000),
					userId: followedUser.id,
					attributedTo: `${baseUrl}/users/${followedUser.username}`,
					visibility: 'PUBLIC',
					tags: { create: [{ tag: 'tag3' }] },
				},
			})

			// Create different activity types
			await prisma.eventLike.create({
				data: { eventId: event1.id, userId: followedUser.id },
			})

			await prisma.eventAttendance.create({
				data: { eventId: event2.id, userId: followedUser.id, status: 'attending' },
			})

			await prisma.comment.create({
				data: { eventId: event3.id, authorId: followedUser.id, content: 'Comment' },
			})

			const res = await app.request('/api/activity/feed', {
				headers: {
					Cookie: 'better-auth.session_token=test-token',
				},
			})

			expect(res.status).toBe(200)
			const body = (await res.json()) as any
			expect(body.activities.length).toBeGreaterThanOrEqual(3)

			// Verify all activities have tags
			body.activities.forEach((activity: any) => {
				expect(activity.event.tags).toBeDefined()
				expect(Array.isArray(activity.event.tags)).toBe(true)
			})
		})
	})
})
