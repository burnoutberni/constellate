/**
 * Tests for Likes API
 * Event likes/unlikes with ActivityPub federation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import likesApp from '../likes.js'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { broadcast } from '../realtime.js'
import { deliverToActors, deliverToFollowers } from '../services/ActivityDelivery.js'
import { buildLikeActivity, buildUndoActivity } from '../services/ActivityBuilder.js'
import { updateEventPopularityScore } from '../services/popularityUpdater.js'
import { canUserViewEvent, isPublicVisibility } from '../lib/eventVisibility.js'

// Mock dependencies
vi.mock('../lib/prisma.js', () => ({
	prisma: {
		event: {
			findUnique: vi.fn(),
		},
		user: {
			findUnique: vi.fn(),
		},
		eventLike: {
			findUnique: vi.fn(),
			create: vi.fn(),
			delete: vi.fn(),
			findMany: vi.fn(),
		},
	},
}))

vi.mock('../middleware/auth.js', () => ({
	requireAuth: vi.fn(),
}))

vi.mock('../realtime.js', () => ({
	broadcast: vi.fn(),
	BroadcastEvents: {
		LIKE_ADDED: 'like:added',
		LIKE_REMOVED: 'like:removed',
	},
}))

vi.mock('../services/ActivityDelivery.js', () => ({
	deliverToActors: vi.fn(),
	deliverToFollowers: vi.fn(),
}))

vi.mock('../services/ActivityBuilder.js', () => ({
	buildLikeActivity: vi.fn(),
	buildUndoActivity: vi.fn(),
}))

vi.mock('../services/popularityUpdater.js', () => ({
	updateEventPopularityScore: vi.fn(),
}))

vi.mock('../lib/eventVisibility.js', () => ({
	canUserViewEvent: vi.fn(),
	isPublicVisibility: vi.fn(),
}))

vi.mock('../lib/activitypubHelpers.js', () => ({
	getBaseUrl: vi.fn(() => 'http://localhost:3000'),
}))

// Create test app
const app = new Hono()
app.route('/api/likes', likesApp)

describe('Likes API', () => {
	const mockUser = {
		id: 'user_123',
		username: 'alice',
		name: 'Alice Smith',
		profileImage: null,
		displayColor: '#3b82f6',
	}

	const mockEventAuthor = {
		id: 'user_456',
		username: 'bob',
		name: 'Bob Johnson',
	}

	const mockEvent = {
		id: 'event_123',
		title: 'Test Event',
		externalId: null,
		attributedTo: 'http://localhost:3000/users/bob',
		visibility: 'PUBLIC' as const,
		user: mockEventAuthor,
	}

	const mockLike = {
		id: 'like_123',
		eventId: 'event_123',
		userId: 'user_123',
		createdAt: new Date(),
		user: {
			id: mockUser.id,
			username: mockUser.username,
			name: mockUser.name,
			profileImage: mockUser.profileImage,
			displayColor: mockUser.displayColor,
		},
	}

	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(requireAuth).mockReturnValue('user_123')
		vi.mocked(canUserViewEvent).mockResolvedValue(true)
		vi.mocked(isPublicVisibility).mockReturnValue(true)
		vi.mocked(buildLikeActivity).mockReturnValue({
			type: 'Like',
			actor: 'http://localhost:3000/users/alice',
			object: 'http://localhost:3000/events/event_123',
		} as any)
		vi.mocked(buildUndoActivity).mockReturnValue({
			type: 'Undo',
			actor: 'http://localhost:3000/users/alice',
			object: {
				type: 'Like',
				actor: 'http://localhost:3000/users/alice',
				object: 'http://localhost:3000/events/event_123',
			},
		} as any)
		vi.mocked(updateEventPopularityScore).mockResolvedValue(undefined)
	})

	describe('POST /:id/like', () => {
		it('should like an event successfully', async () => {
			vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as any)
			vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
			vi.mocked(prisma.eventLike.findUnique).mockResolvedValue(null)
			vi.mocked(prisma.eventLike.create).mockResolvedValue(mockLike as any)
			vi.mocked(deliverToActors).mockResolvedValue()
			vi.mocked(deliverToFollowers).mockResolvedValue()

			const res = await app.request('/api/likes/event_123/like', {
				method: 'POST',
			})

			expect(res.status).toBe(201)
			const body = (await res.json()) as typeof mockLike
			expect(body.id).toBe('like_123')
			expect(prisma.eventLike.create).toHaveBeenCalledWith({
				data: {
					eventId: 'event_123',
					userId: 'user_123',
				},
				include: {
					user: {
						select: {
							id: true,
							username: true,
							name: true,
							profileImage: true,
							displayColor: true,
						},
					},
				},
			})
			expect(broadcast).toHaveBeenCalledWith({
				type: 'like:added',
				data: {
					eventId: 'event_123',
					like: mockLike,
				},
			})
			expect(updateEventPopularityScore).toHaveBeenCalledWith('event_123')
		})

		it('should deliver Like activity to event author', async () => {
			vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as any)
			vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
			vi.mocked(prisma.eventLike.findUnique).mockResolvedValue(null)
			vi.mocked(prisma.eventLike.create).mockResolvedValue(mockLike as any)
			vi.mocked(deliverToActors).mockResolvedValue()
			vi.mocked(deliverToFollowers).mockResolvedValue()

			await app.request('/api/likes/event_123/like', {
				method: 'POST',
			})

			expect(deliverToActors).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'Like',
				}),
				['http://localhost:3000/users/bob'],
				'user_123'
			)
		})

		it('should deliver Like activity to followers for public events', async () => {
			vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as any)
			vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
			vi.mocked(prisma.eventLike.findUnique).mockResolvedValue(null)
			vi.mocked(prisma.eventLike.create).mockResolvedValue(mockLike as any)
			vi.mocked(deliverToActors).mockResolvedValue()
			vi.mocked(deliverToFollowers).mockResolvedValue()

			await app.request('/api/likes/event_123/like', {
				method: 'POST',
			})

			expect(deliverToFollowers).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'Like',
				}),
				'user_456'
			)
		})

		it('should not deliver to followers for private events', async () => {
			const privateEvent = {
				...mockEvent,
				visibility: 'PRIVATE' as const,
			}
			vi.mocked(prisma.event.findUnique).mockResolvedValue(privateEvent as any)
			vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
			vi.mocked(prisma.eventLike.findUnique).mockResolvedValue(null)
			vi.mocked(prisma.eventLike.create).mockResolvedValue(mockLike as any)
			vi.mocked(isPublicVisibility).mockReturnValue(false)
			vi.mocked(deliverToActors).mockResolvedValue()
			vi.mocked(deliverToFollowers).mockResolvedValue()

			await app.request('/api/likes/event_123/like', {
				method: 'POST',
			})

			expect(deliverToActors).toHaveBeenCalled()
			expect(deliverToFollowers).not.toHaveBeenCalled()
		})

		it('should handle events with externalId', async () => {
			const eventWithExternalId = {
				...mockEvent,
				externalId: 'https://remote.example.com/events/123',
			}
			vi.mocked(prisma.event.findUnique).mockResolvedValue(eventWithExternalId as any)
			vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
			vi.mocked(prisma.eventLike.findUnique).mockResolvedValue(null)
			vi.mocked(prisma.eventLike.create).mockResolvedValue(mockLike as any)
			vi.mocked(deliverToActors).mockResolvedValue()
			vi.mocked(deliverToFollowers).mockResolvedValue()

			await app.request('/api/likes/event_123/like', {
				method: 'POST',
			})

			expect(buildLikeActivity).toHaveBeenCalledWith(
				expect.anything(),
				'https://remote.example.com/events/123',
				expect.anything(),
				expect.anything(),
				true
			)
		})

		it('should handle events without user relation (remote events)', async () => {
			const remoteEvent = {
				...mockEvent,
				user: null,
				attributedTo: 'https://remote.example.com/users/bob',
			}
			vi.mocked(prisma.event.findUnique).mockResolvedValue(remoteEvent as any)
			vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
			vi.mocked(prisma.eventLike.findUnique).mockResolvedValue(null)
			vi.mocked(prisma.eventLike.create).mockResolvedValue(mockLike as any)
			vi.mocked(deliverToActors).mockResolvedValue()
			vi.mocked(deliverToFollowers).mockResolvedValue()

			await app.request('/api/likes/event_123/like', {
				method: 'POST',
			})

			expect(deliverToActors).toHaveBeenCalled()
			expect(deliverToFollowers).not.toHaveBeenCalled()
		})

		it('should return 404 when event not found', async () => {
			vi.mocked(prisma.event.findUnique).mockResolvedValue(null)

			const res = await app.request('/api/likes/nonexistent/like', {
				method: 'POST',
			})

			expect(res.status).toBe(404)
			const body = (await res.json()) as { error: string }
			expect(body.error).toBe('Event not found')
			expect(prisma.eventLike.create).not.toHaveBeenCalled()
		})

		it('should return 403 when user cannot view event', async () => {
			vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as any)
			vi.mocked(canUserViewEvent).mockResolvedValue(false)

			const res = await app.request('/api/likes/event_123/like', {
				method: 'POST',
			})

			expect(res.status).toBe(403)
			const body = (await res.json()) as { error: string }
			expect(body.error).toBe('Forbidden')
			expect(prisma.eventLike.create).not.toHaveBeenCalled()
		})

		it('should return 404 when user not found', async () => {
			vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as any)
			vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

			const res = await app.request('/api/likes/event_123/like', {
				method: 'POST',
			})

			expect(res.status).toBe(404)
			const body = (await res.json()) as { error: string }
			expect(body.error).toBe('User not found')
		})

		it('should return 400 when event already liked', async () => {
			vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as any)
			vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
			vi.mocked(prisma.eventLike.findUnique).mockResolvedValue(mockLike as any)

			const res = await app.request('/api/likes/event_123/like', {
				method: 'POST',
			})

			expect(res.status).toBe(400)
			const body = (await res.json()) as { error: string }
			expect(body.error).toBe('Already liked')
			expect(prisma.eventLike.create).not.toHaveBeenCalled()
		})

		it('should handle errors gracefully', async () => {
			vi.mocked(prisma.event.findUnique).mockRejectedValue(new Error('Database error'))

			const res = await app.request('/api/likes/event_123/like', {
				method: 'POST',
			})

			expect(res.status).toBe(500)
			const body = (await res.json()) as { error: string }
			expect(body.error).toBe('Internal server error')
		})

		it('should handle popularity score update errors gracefully', async () => {
			vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as any)
			vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
			vi.mocked(prisma.eventLike.findUnique).mockResolvedValue(null)
			vi.mocked(prisma.eventLike.create).mockResolvedValue(mockLike as any)
			vi.mocked(deliverToActors).mockResolvedValue()
			vi.mocked(deliverToFollowers).mockResolvedValue()
			vi.mocked(updateEventPopularityScore).mockRejectedValue(new Error('Update failed'))

			// Should not throw, error should be caught and logged
			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

			const res = await app.request('/api/likes/event_123/like', {
				method: 'POST',
			})

			expect(res.status).toBe(201)
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('Failed to update popularity score'),
				expect.anything()
			)

			consoleErrorSpy.mockRestore()
		})
	})

	describe('DELETE /:id/like', () => {
		it('should unlike an event successfully', async () => {
			const likeWithEvent = {
				...mockLike,
				event: mockEvent,
				user: mockUser,
			}

			vi.mocked(prisma.eventLike.findUnique).mockResolvedValue(likeWithEvent as any)
			vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
			vi.mocked(prisma.eventLike.delete).mockResolvedValue(likeWithEvent as any)
			vi.mocked(deliverToActors).mockResolvedValue()
			vi.mocked(deliverToFollowers).mockResolvedValue()

			const res = await app.request('/api/likes/event_123/like', {
				method: 'DELETE',
			})

			expect(res.status).toBe(200)
			const body = (await res.json()) as { success: boolean }
			expect(body.success).toBe(true)
			expect(prisma.eventLike.delete).toHaveBeenCalledWith({
				where: {
					eventId_userId: {
						eventId: 'event_123',
						userId: 'user_123',
					},
				},
			})
			expect(broadcast).toHaveBeenCalledWith({
				type: 'like:removed',
				data: {
					eventId: 'event_123',
					userId: 'user_123',
				},
			})
			expect(updateEventPopularityScore).toHaveBeenCalledWith('event_123')
		})

		it('should deliver Undo activity when unliking', async () => {
			const likeWithEvent = {
				...mockLike,
				event: mockEvent,
				user: mockUser,
			}

			vi.mocked(prisma.eventLike.findUnique).mockResolvedValue(likeWithEvent as any)
			vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
			vi.mocked(prisma.eventLike.delete).mockResolvedValue(likeWithEvent as any)
			vi.mocked(deliverToActors).mockResolvedValue()
			vi.mocked(deliverToFollowers).mockResolvedValue()

			await app.request('/api/likes/event_123/like', {
				method: 'DELETE',
			})

			expect(buildUndoActivity).toHaveBeenCalled()
			expect(deliverToActors).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'Undo',
				}),
				['http://localhost:3000/users/bob'],
				'user_123'
			)
		})

		it('should return 404 when like not found', async () => {
			vi.mocked(prisma.eventLike.findUnique).mockResolvedValue(null)

			const res = await app.request('/api/likes/event_123/like', {
				method: 'DELETE',
			})

			expect(res.status).toBe(404)
			const body = (await res.json()) as { error: string }
			expect(body.error).toBe('Not liked')
			expect(prisma.eventLike.delete).not.toHaveBeenCalled()
		})

		it('should return 403 when user cannot view event', async () => {
			const likeWithEvent = {
				...mockLike,
				event: mockEvent,
				user: mockUser,
			}

			vi.mocked(prisma.eventLike.findUnique).mockResolvedValue(likeWithEvent as any)
			vi.mocked(canUserViewEvent).mockResolvedValue(false)

			const res = await app.request('/api/likes/event_123/like', {
				method: 'DELETE',
			})

			expect(res.status).toBe(403)
			const body = (await res.json()) as { error: string }
			expect(body.error).toBe('Forbidden')
			expect(prisma.eventLike.delete).not.toHaveBeenCalled()
		})

		it('should return 404 when user not found', async () => {
			const likeWithEvent = {
				...mockLike,
				event: mockEvent,
				user: mockUser,
			}

			vi.mocked(prisma.eventLike.findUnique).mockResolvedValue(likeWithEvent as any)
			vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

			const res = await app.request('/api/likes/event_123/like', {
				method: 'DELETE',
			})

			expect(res.status).toBe(404)
			const body = (await res.json()) as { error: string }
			expect(body.error).toBe('User not found')
		})

		it('should handle errors gracefully', async () => {
			vi.mocked(prisma.eventLike.findUnique).mockRejectedValue(new Error('Database error'))

			const res = await app.request('/api/likes/event_123/like', {
				method: 'DELETE',
			})

			expect(res.status).toBe(500)
			const body = (await res.json()) as { error: string }
			expect(body.error).toBe('Internal server error')
		})
	})

	describe('GET /:id/likes', () => {
		it('should return list of likes for an event', async () => {
			const likes = [
				{
					...mockLike,
					user: {
						id: 'user_123',
						username: 'alice',
						name: 'Alice',
						profileImage: null,
						displayColor: '#3b82f6',
					},
				},
				{
					...mockLike,
					id: 'like_456',
					userId: 'user_789',
					user: {
						id: 'user_789',
						username: 'charlie',
						name: 'Charlie',
						profileImage: null,
						displayColor: '#10b981',
					},
				},
			]

			vi.mocked(prisma.eventLike.findMany).mockResolvedValue(likes as any)

			const res = await app.request('/api/likes/event_123/likes')

			expect(res.status).toBe(200)
			const body = (await res.json()) as { likes: unknown[]; count: number }
			expect(body.likes).toHaveLength(2)
			expect(body.count).toBe(2)
			expect(prisma.eventLike.findMany).toHaveBeenCalledWith({
				where: { eventId: 'event_123' },
				include: {
					user: {
						select: {
							id: true,
							username: true,
							name: true,
							profileImage: true,
							displayColor: true,
						},
					},
				},
				orderBy: { createdAt: 'desc' },
			})
		})

		it('should return empty list when no likes', async () => {
			vi.mocked(prisma.eventLike.findMany).mockResolvedValue([])

			const res = await app.request('/api/likes/event_123/likes')

			expect(res.status).toBe(200)
			const body = (await res.json()) as { likes: unknown[]; count: number }
			expect(body.likes).toHaveLength(0)
			expect(body.count).toBe(0)
		})

		it('should handle errors gracefully', async () => {
			vi.mocked(prisma.eventLike.findMany).mockRejectedValue(new Error('Database error'))

			const res = await app.request('/api/likes/event_123/likes')

			expect(res.status).toBe(500)
			const body = (await res.json()) as { error: string }
			expect(body.error).toBe('Internal server error')
		})
	})
})

