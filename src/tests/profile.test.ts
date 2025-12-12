/**
 * Tests for User Profile and Follow/Unfollow functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { config } from 'dotenv'
config()
import { app } from '../server.js'
import { prisma } from '../lib/prisma.js'
import * as activityBuilder from '../services/ActivityBuilder.js'
import * as activityDelivery from '../services/ActivityDelivery.js'
import * as realtime from '../realtime.js'
import * as authModule from '../auth.js'

vi.mock('../services/ActivityBuilder.js')
vi.mock('../services/ActivityDelivery.js')
vi.mock('../realtime.js')

describe('Profile API', () => {
	let testUser: any
	let otherUser: any
	let remoteUser: any
	const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000'

	const mockAuth = (user: any) => {
		vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue({
			user: {
				id: user.id,
				username: user.username,
				email: user.email,
			},
			session: {
				id: 'test-session',
				userId: user.id,
				expiresAt: new Date(Date.now() + 86400000),
			},
		} as any)
	}

	const mockNoAuth = () => {
		vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue(null as any)
	}

	beforeEach(async () => {
		await prisma.following.deleteMany({})
		await prisma.follower.deleteMany({})
		await prisma.event.deleteMany({})
		await prisma.user.deleteMany({})

		const timestamp = Date.now()
		const randomSuffix = Math.random().toString(36).substring(7)
		const suffix = `${timestamp}_${randomSuffix}`

		testUser = await prisma.user.create({
			data: {
				username: `alice_${suffix}`,
				email: `alice_${suffix}@test.com`,
				name: 'Alice Test',
				isRemote: false,
				autoAcceptFollowers: true,
			},
		})

		otherUser = await prisma.user.create({
			data: {
				username: `bob_${suffix}`,
				email: `bob_${suffix}@test.com`,
				name: 'Bob Test',
				isRemote: false,
				autoAcceptFollowers: true,
			},
		})

		remoteUser = await prisma.user.create({
			data: {
				username: `charlie_${suffix}@remote.com`,
				name: 'Charlie Remote',
				isRemote: true,
				externalActorUrl: 'https://remote.com/users/charlie',
				inboxUrl: 'https://remote.com/users/charlie/inbox',
			},
		})

		vi.clearAllMocks()
		mockNoAuth() // Set default unauthenticated state
	})

	describe('GET /users/me/profile', () => {
		it('returns the current user profile with counts', async () => {
			mockAuth(testUser)

			const response = await app.request('/api/users/me/profile', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' },
			})
			expect(response.status).toBe(200)

			const data = (await response.json()) as any
			expect(data.id).toBe(testUser.id)
			expect(data.username).toBe(testUser.username)
			expect(data.timezone).toBe('UTC')
			expect(data.isAdmin).toBeDefined()
			expect(data._count).toBeDefined()
			expect(data._count.followers).toBe(0)
			expect(data._count.following).toBe(0)
		})

		it('returns 401 when not authenticated', async () => {
			mockNoAuth()

			const response = await app.request('/api/users/me/profile', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' },
			})
			expect(response.status).toBe(401)
		})
	})

	describe('Timezone preferences', () => {
		it('updates timezone preference via profile API', async () => {
			mockAuth(testUser)

			const response = await app.request('/api/profile', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ timezone: 'America/Los_Angeles' }),
			})

			expect(response.status).toBe(200)
			const body = (await response.json()) as any
			expect(body.timezone).toBe('America/Los_Angeles')

			const dbUser = await prisma.user.findUnique({ where: { id: testUser.id } })
			expect(dbUser?.timezone).toBe('America/Los_Angeles')
		})

		it('rejects invalid timezone identifiers', async () => {
			mockAuth(testUser)

			const response = await app.request('/api/profile', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ timezone: 'Not/AZone' }),
			})

			expect(response.status).toBe(400)
			const body = (await response.json()) as any
			expect(body.error).toBe('Validation failed')
		})
	})

	describe('GET /users/:username/profile', () => {
		it('returns user profile without sensitive fields for other users', async () => {
			mockAuth(testUser)

			const response = await app.request(`/api/users/${otherUser.username}/profile`, {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' },
			})
			expect(response.status).toBe(200)

			const data = (await response.json()) as any
			expect(data.id).toBe(otherUser.id)
			expect(data.username).toBe(otherUser.username)
			expect(data.isAdmin).toBeUndefined()
			expect(data.autoAcceptFollowers).toBeUndefined()
		})

		it('returns 404 for non-existent user', async () => {
			mockAuth(testUser)

			const response = await app.request('/api/users/nonexistent/profile', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' },
			})
			expect(response.status).toBe(404)
		})
	})

	describe('GET /users/:username/follow-status', () => {
		it('returns not following when user is not authenticated', async () => {
			mockNoAuth()

			const response = await app.request(`/api/users/${otherUser.username}/follow-status`, {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' },
			})
			expect(response.status).toBe(200)

			const data = (await response.json()) as any
			expect(data.isFollowing).toBe(false)
			expect(data.isAccepted).toBe(false)
		})

		it('returns following status for authenticated user', async () => {
			mockAuth(testUser)

			const targetActorUrl = `${baseUrl}/users/${otherUser.username}`

			await prisma.following.create({
				data: {
					userId: testUser.id,
					actorUrl: targetActorUrl,
					username: otherUser.username,
					inboxUrl: `${baseUrl}/users/${otherUser.username}/inbox`,
					accepted: true,
				},
			})

			const response = await app.request(`/api/users/${otherUser.username}/follow-status`, {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' },
			})
			expect(response.status).toBe(200)

			const data = (await response.json()) as any
			expect(data.isFollowing).toBe(true)
			expect(data.isAccepted).toBe(true)
		})

		it('returns pending status when follow is not accepted', async () => {
			mockAuth(testUser)

			const targetActorUrl = `${baseUrl}/users/${otherUser.username}`

			await prisma.following.create({
				data: {
					userId: testUser.id,
					actorUrl: targetActorUrl,
					username: otherUser.username,
					inboxUrl: `${baseUrl}/users/${otherUser.username}/inbox`,
					accepted: false,
				},
			})

			const response = await app.request(`/api/users/${otherUser.username}/follow-status`, {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' },
			})
			expect(response.status).toBe(200)

			const data = (await response.json()) as any
			expect(data.isFollowing).toBe(true)
			expect(data.isAccepted).toBe(false)
		})
	})

	describe('POST /users/:username/follow', () => {
		it('follows a local user with auto-accept enabled', async () => {
			mockAuth(testUser)
			vi.mocked(activityBuilder.buildFollowActivity).mockReturnValue({
				type: 'Follow',
				actor: `${baseUrl}/users/${testUser.username}`,
			} as any)

			const response = await app.request(`/api/users/${otherUser.username}/follow`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
			})
			expect(response.status).toBe(200)

			const data = (await response.json()) as any
			expect(data.success).toBe(true)

			const following = await prisma.following.findFirst({
				where: {
					userId: testUser.id,
					actorUrl: `${baseUrl}/users/${otherUser.username}`,
				},
			})
			expect(following).toBeTruthy()
			expect(following?.accepted).toBe(true)

			const follower = await prisma.follower.findFirst({
				where: {
					userId: otherUser.id,
					actorUrl: `${baseUrl}/users/${testUser.username}`,
				},
			})
			expect(follower).toBeTruthy()
			expect(follower?.accepted).toBe(true)
		})

		it('follows a local user with auto-accept disabled', async () => {
			mockAuth(testUser)
			vi.mocked(activityBuilder.buildFollowActivity).mockReturnValue({
				type: 'Follow',
				actor: `${baseUrl}/users/${testUser.username}`,
			} as any)

			await prisma.user.update({
				where: { id: otherUser.id },
				data: { autoAcceptFollowers: false },
			})

			const response = await app.request(`/api/users/${otherUser.username}/follow`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
			})
			expect(response.status).toBe(200)

			const following = await prisma.following.findFirst({
				where: {
					userId: testUser.id,
					actorUrl: `${baseUrl}/users/${otherUser.username}`,
				},
			})
			expect(following).toBeTruthy()
			expect(following?.accepted).toBe(false)

			const follower = await prisma.follower.findFirst({
				where: {
					userId: otherUser.id,
					actorUrl: `${baseUrl}/users/${testUser.username}`,
				},
			})
			expect(follower).toBeTruthy()
			expect(follower?.accepted).toBe(false)
		})

		it('follows a remote user and sends ActivityPub follow activity', async () => {
			mockAuth(testUser)

			const mockFollowActivity = {
				type: 'Follow',
				actor: `${baseUrl}/users/${testUser.username}`,
				object: remoteUser.externalActorUrl,
			}

			vi.mocked(activityBuilder.buildFollowActivity).mockReturnValue(
				mockFollowActivity as any
			)
			const mockDeliverToInbox = vi
				.mocked(activityDelivery.deliverToInbox)
				.mockResolvedValue(true)
			const mockBroadcastToUser = vi
				.mocked(realtime.broadcastToUser)
				.mockResolvedValue(undefined as any)

			const response = await app.request(`/api/users/${remoteUser.username}/follow`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
			})
			expect(response.status).toBe(200)

			const following = await prisma.following.findFirst({
				where: {
					userId: testUser.id,
					actorUrl: remoteUser.externalActorUrl!,
				},
			})
			expect(following).toBeTruthy()
			expect(following?.accepted).toBe(false)

			expect(mockDeliverToInbox).toHaveBeenCalledWith(
				mockFollowActivity,
				remoteUser.inboxUrl,
				expect.objectContaining({ id: testUser.id })
			)

			expect(mockBroadcastToUser).toHaveBeenCalledWith(
				testUser.id,
				expect.objectContaining({
					type: 'follow:pending',
				})
			)
		})

		it('returns 400 when trying to follow yourself', async () => {
			mockAuth(testUser)

			const response = await app.request(`/api/users/${testUser.username}/follow`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
			})
			expect(response.status).toBe(400)

			const data = (await response.json()) as any
			expect(data.error).toContain('Cannot follow yourself')
		})

		it('returns 400 when already following', async () => {
			mockAuth(testUser)

			const targetActorUrl = `${baseUrl}/users/${otherUser.username}`

			await prisma.following.create({
				data: {
					userId: testUser.id,
					actorUrl: targetActorUrl,
					username: otherUser.username,
					inboxUrl: `${baseUrl}/users/${otherUser.username}/inbox`,
					accepted: true,
				},
			})

			const response = await app.request(`/api/users/${otherUser.username}/follow`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
			})
			expect(response.status).toBe(400)

			const data = (await response.json()) as any
			expect(data.error).toContain('Already following')
		})

		it('requires authentication', async () => {
			mockNoAuth()

			const response = await app.request(`/api/users/${otherUser.username}/follow`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
			})
			expect(response.status).toBe(401)
		})
	})

	describe('DELETE /users/:username/follow', () => {
		beforeEach(async () => {
			const targetActorUrl = `${baseUrl}/users/${otherUser.username}`

			await prisma.following.create({
				data: {
					userId: testUser.id,
					actorUrl: targetActorUrl,
					username: otherUser.username,
					inboxUrl: `${baseUrl}/users/${otherUser.username}/inbox`,
					accepted: true,
				},
			})

			await prisma.follower.create({
				data: {
					userId: otherUser.id,
					actorUrl: `${baseUrl}/users/${testUser.username}`,
					username: testUser.username,
					inboxUrl: `${baseUrl}/users/${testUser.username}/inbox`,
					accepted: true,
				},
			})
		})

		it('unfollows a local user', async () => {
			mockAuth(testUser)

			const response = await app.request(`/api/users/${otherUser.username}/follow`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
			})
			expect(response.status).toBe(200)

			const following = await prisma.following.findFirst({
				where: {
					userId: testUser.id,
					actorUrl: `${baseUrl}/users/${otherUser.username}`,
				},
			})
			expect(following).toBeNull()

			const follower = await prisma.follower.findFirst({
				where: {
					userId: otherUser.id,
					actorUrl: `${baseUrl}/users/${testUser.username}`,
				},
			})
			expect(follower).toBeNull()
		})

		it('unfollows a remote user and sends Undo activity', async () => {
			mockAuth(testUser)

			const mockFollowActivity = {
				type: 'Follow',
				actor: `${baseUrl}/users/${testUser.username}`,
				object: remoteUser.externalActorUrl,
			}

			const mockUndoActivity = {
				type: 'Undo',
				actor: `${baseUrl}/users/${testUser.username}`,
				object: mockFollowActivity,
			}

			vi.mocked(activityBuilder.buildFollowActivity).mockReturnValue(
				mockFollowActivity as any
			)
			vi.mocked(activityBuilder.buildUndoActivity).mockReturnValue(mockUndoActivity as any)
			const mockDeliverToInbox = vi
				.mocked(activityDelivery.deliverToInbox)
				.mockResolvedValue(true)

			await prisma.following.create({
				data: {
					userId: testUser.id,
					actorUrl: remoteUser.externalActorUrl!,
					username: remoteUser.username,
					inboxUrl: remoteUser.inboxUrl!,
					accepted: true,
				},
			})

			const response = await app.request(`/api/users/${remoteUser.username}/follow`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
			})
			expect(response.status).toBe(200)

			const following = await prisma.following.findFirst({
				where: {
					userId: testUser.id,
					actorUrl: remoteUser.externalActorUrl!,
				},
			})
			expect(following).toBeNull()

			expect(mockDeliverToInbox).toHaveBeenCalledWith(
				mockUndoActivity,
				remoteUser.inboxUrl,
				expect.objectContaining({ id: testUser.id })
			)
		})

		it('returns 400 when not following', async () => {
			mockAuth(testUser)

			await prisma.following.deleteMany({
				where: {
					userId: testUser.id,
				},
			})

			const response = await app.request(`/api/users/${otherUser.username}/follow`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
			})
			expect(response.status).toBe(400)

			const data = (await response.json()) as any
			expect(data.error).toContain('Not following')
		})

		it('requires authentication', async () => {
			mockNoAuth()

			const response = await app.request(`/api/users/${otherUser.username}/follow`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
			})
			expect(response.status).toBe(401)
		})
	})

	describe('Follow counts', () => {
		it('updates follower and following counts correctly', async () => {
			mockAuth(testUser)

			const targetActorUrl = `${baseUrl}/users/${otherUser.username}`

			await prisma.following.create({
				data: {
					userId: testUser.id,
					actorUrl: targetActorUrl,
					username: otherUser.username,
					inboxUrl: `${baseUrl}/users/${otherUser.username}/inbox`,
					accepted: true,
				},
			})

			await prisma.follower.create({
				data: {
					userId: otherUser.id,
					actorUrl: `${baseUrl}/users/${testUser.username}`,
					username: testUser.username,
					inboxUrl: `${baseUrl}/users/${testUser.username}/inbox`,
					accepted: true,
				},
			})

			const response = await app.request(`/api/users/${otherUser.username}/profile`, {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' },
			})
			expect(response.status).toBe(200)

			const data = (await response.json()) as any
			expect(data._count.followers).toBe(1)
			expect(data._count.following).toBe(0)
		})
	})
})
