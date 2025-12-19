/**
 * Tests for User Profile and Follow/Unfollow functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
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
		await prisma.dataExport.deleteMany({})
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
				isPublicProfile: true,
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
		// Don't set default unauthenticated state - let each test set its own auth state
	})

	afterEach(async () => {
		vi.restoreAllMocks()
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
			expect(data.user).toBeDefined()
			expect(data.events).toBeDefined()
			expect(Array.isArray(data.events)).toBe(true)
			expect(data.user.id).toBe(otherUser.id)
			expect(data.user.username).toBe(otherUser.username)
			expect(data.user.isAdmin).toBeUndefined()
			expect(data.user.autoAcceptFollowers).toBeUndefined()
		})

		it('returns 404 for non-existent user', async () => {
			mockAuth(testUser)

			const response = await app.request('/api/users/nonexistent/profile', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' },
			})
			expect(response.status).toBe(404)
		})

		it('returns minimal data for private profile when viewer is not follower', async () => {
			// Create a private profile user
			const privateUser = await prisma.user.create({
				data: {
					username: `private_${Date.now()}`,
					email: `private_${Date.now()}@test.com`,
					name: 'Private User',
					bio: 'Private bio',
					isRemote: false,
					isPublicProfile: false,
				},
			})

			mockAuth(testUser)

			const response = await app.request(`/api/users/${privateUser.username}/profile`, {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' },
			})
			expect(response.status).toBe(200)

			const data = (await response.json()) as any
			expect(data.user).toBeDefined()
			expect(data.events).toBeDefined()
			expect(Array.isArray(data.events)).toBe(true)
			expect(data.events.length).toBe(0)
			expect(data.user.id).toBe(privateUser.id)
			expect(data.user.username).toBe(privateUser.username)
			expect(data.user.name).toBe(privateUser.name)
			expect(data.user.profileImage).toBeDefined()
			expect(data.user.createdAt).toBeDefined()
			expect(typeof data.user.createdAt).toBe('string')
			expect(data.user.displayColor).toBeDefined()
			expect(typeof data.user.displayColor).toBe('string')
			expect(data.user.timezone).toBeUndefined()
			expect(data.user.bio).toBeNull()
			expect(data.user.headerImage).toBeNull()
			expect(data.user._count).toBeDefined()
			expect(data.user._count.events).toBe(0)
			expect(data.user._count.followers).toBe(0)
			expect(data.user._count.following).toBe(0)
		})

		it('returns full data for private profile when viewer is owner', async () => {
			const privateUser = await prisma.user.create({
				data: {
					username: `private_owner_${Date.now()}`,
					email: `private_owner_${Date.now()}@test.com`,
					name: 'Private Owner',
					bio: 'Private bio',
					isRemote: false,
					isPublicProfile: false,
				},
			})

			mockAuth(privateUser)

			const response = await app.request(`/api/users/${privateUser.username}/profile`, {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' },
			})
			expect(response.status).toBe(200)

			const data = (await response.json()) as any
			expect(data.user).toBeDefined()
			expect(data.events).toBeDefined()
			expect(Array.isArray(data.events)).toBe(true)
			expect(data.user.id).toBe(privateUser.id)
			expect(data.user.bio).toBe(privateUser.bio)
			expect(data.user._count).toBeDefined()
		})

		it('returns full data for private profile when viewer is accepted follower', async () => {
			const privateUser = await prisma.user.create({
				data: {
					username: `private_follower_${Date.now()}`,
					email: `private_follower_${Date.now()}@test.com`,
					name: 'Private Follower',
					bio: 'Private bio',
					isRemote: false,
					isPublicProfile: false,
				},
			})

			mockAuth(testUser)

			// Make testUser follow privateUser
			const targetActorUrl = `${baseUrl}/users/${privateUser.username}`
			await prisma.following.create({
				data: {
					userId: testUser.id,
					actorUrl: targetActorUrl,
					username: privateUser.username,
					inboxUrl: `${baseUrl}/users/${privateUser.username}/inbox`,
					accepted: true,
				},
			})
			await prisma.follower.create({
				data: {
					userId: privateUser.id,
					actorUrl: `${baseUrl}/users/${testUser.username}`,
					username: testUser.username,
					inboxUrl: `${baseUrl}/users/${testUser.username}/inbox`,
					accepted: true,
				},
			})

			const response = await app.request(`/api/users/${privateUser.username}/profile`, {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' },
			})
			expect(response.status).toBe(200)

			const data = (await response.json()) as any
			expect(data.user).toBeDefined()
			expect(data.events).toBeDefined()
			expect(Array.isArray(data.events)).toBe(true)
			expect(data.user.id).toBe(privateUser.id)
			expect(data.user.bio).toBe(privateUser.bio)
			expect(data.user._count).toBeDefined()
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
			expect(data.user).toBeDefined()
			expect(data.events).toBeDefined()
			expect(data.user._count.followers).toBe(1)
			expect(data.user._count.following).toBe(0)
		})
	})

	describe('POST /users/me/export', () => {
		it('creates an export job', async () => {
			mockAuth(testUser)

			const response = await app.request('/api/users/me/export', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
			})
			expect(response.status).toBe(202)

			const data = (await response.json()) as any
			expect(data.exportId).toBeDefined()
			expect(data.status).toBe('PENDING')
			expect(data.message).toBeDefined()

			// Verify job was created in database
			const exportJob = await prisma.dataExport.findUnique({
				where: { id: data.exportId },
			})
			expect(exportJob).toBeDefined()
			expect(exportJob?.userId).toBe(testUser.id)
			expect(exportJob?.status).toBe('PENDING')
		})

		it('returns existing job if one is already pending', async () => {
			mockAuth(testUser)

			// Create an existing export job
			const existingExport = await prisma.dataExport.create({
				data: {
					userId: testUser.id,
					status: 'PENDING',
				},
			})

			const response = await app.request('/api/users/me/export', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
			})
			expect(response.status).toBe(200)

			const data = (await response.json()) as any
			expect(data.exportId).toBe(existingExport.id)
			expect(data.status).toBe('PENDING')
		})

		it('returns 401 when not authenticated', async () => {
			mockNoAuth()

			const response = await app.request('/api/users/me/export', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
			})
			expect(response.status).toBe(401)
		})
	})

	describe('GET /users/me/export/:exportId', () => {
		it('returns export status when pending', async () => {
			mockAuth(testUser)

			const exportJob = await prisma.dataExport.create({
				data: {
					userId: testUser.id,
					status: 'PENDING',
				},
			})

			const response = await app.request(`/api/users/me/export/${exportJob.id}`, {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' },
			})

			const data = (await response.json()) as any

			expect(response.status).toBe(200)
			expect(data.exportId).toBe(exportJob.id)
			expect(data.status).toBe('PENDING')
			expect(data.createdAt).toBeDefined()
		})

		it('returns export data when completed', async () => {
			mockAuth(testUser)

			// Create some data to export
			const testEvent = await prisma.event.create({
				data: {
					title: 'Test Event',
					startTime: new Date(),
					userId: testUser.id,
				},
			})

			const exportData = {
				_meta: {
					exportedAt: new Date().toISOString(),
					version: '1.0',
				},
				profile: testUser,
				events: [testEvent],
				comments: [],
				social: { following: [], followers: [] },
				activity: { attendance: [], likes: [] },
				moderation: { reportsFiled: [], appeals: [] },
			}

			const exportJob = await prisma.dataExport.create({
				data: {
					userId: testUser.id,
					status: 'COMPLETED',
					data: exportData as any,
					completedAt: new Date(),
					expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
				},
			})

			const response = await app.request(`/api/users/me/export/${exportJob.id}`, {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' },
			})
			expect(response.status).toBe(200)

			const data = (await response.json()) as any
			expect(data.profile.id).toBe(testUser.id)
			expect(data.events).toHaveLength(1)
			expect(data.events[0].title).toBe('Test Event')
			expect(data._meta).toBeDefined()
		})

		it('returns 404 for non-existent export', async () => {
			mockAuth(testUser)

			const response = await app.request('/api/users/me/export/non-existent-id', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' },
			})
			expect(response.status).toBe(404)
		})

		it("returns 403 when accessing another user's export", async () => {
			mockAuth(testUser)

			const exportJob = await prisma.dataExport.create({
				data: {
					userId: otherUser.id,
					status: 'COMPLETED',
				},
			})

			const response = await app.request(`/api/users/me/export/${exportJob.id}`, {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' },
			})
			expect(response.status).toBe(403)
		})

		it('returns 410 for expired export', async () => {
			mockAuth(testUser)

			const exportJob = await prisma.dataExport.create({
				data: {
					userId: testUser.id,
					status: 'COMPLETED',
					data: { test: 'data' } as any,
					completedAt: new Date(),
					expiresAt: new Date(Date.now() - 1000), // Expired
				},
			})

			const response = await app.request(`/api/users/me/export/${exportJob.id}`, {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' },
			})
			expect(response.status).toBe(410)
		})

		it('returns 401 when not authenticated', async () => {
			mockNoAuth()

			const exportJob = await prisma.dataExport.create({
				data: {
					userId: testUser.id,
					status: 'PENDING',
				},
			})

			const response = await app.request(`/api/users/me/export/${exportJob.id}`, {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' },
			})
			expect(response.status).toBe(401)
		})
	})

	describe('GET /tos/status', () => {
		it('returns ToS status for user who has not accepted', async () => {
			mockAuth(testUser)

			// Ensure user has no ToS acceptance
			await prisma.user.update({
				where: { id: testUser.id },
				data: { tosAcceptedAt: null, tosVersion: null },
			})

			const response = await app.request('/api/tos/status', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' },
			})
			expect(response.status).toBe(200)

			const data = (await response.json()) as any
			expect(data.accepted).toBe(false)
			expect(data.acceptedAt).toBeNull()
			expect(data.needsAcceptance).toBe(true)
			expect(data.currentVersion).toBeDefined()
		})

		it('returns ToS status for user who has accepted current version', async () => {
			mockAuth(testUser)
			const { config } = await import('../config.js')

			await prisma.user.update({
				where: { id: testUser.id },
				data: {
					tosAcceptedAt: new Date(),
					tosVersion: config.tosVersion,
				},
			})

			const response = await app.request('/api/tos/status', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' },
			})
			expect(response.status).toBe(200)

			const data = (await response.json()) as any
			expect(data.accepted).toBe(true)
			expect(data.acceptedAt).toBeDefined()
			expect(data.acceptedVersion).toBe(config.tosVersion)
			expect(data.currentVersion).toBe(config.tosVersion)
			expect(data.needsAcceptance).toBe(false)
		})

		it('returns needsAcceptance true when user has accepted old version', async () => {
			mockAuth(testUser)
			const { config } = await import('../config.js')

			await prisma.user.update({
				where: { id: testUser.id },
				data: {
					tosAcceptedAt: new Date(),
					tosVersion: config.tosVersion - 1, // Old version
				},
			})

			const response = await app.request('/api/tos/status', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' },
			})
			expect(response.status).toBe(200)

			const data = (await response.json()) as any
			expect(data.accepted).toBe(true)
			expect(data.acceptedVersion).toBe(config.tosVersion - 1)
			expect(data.currentVersion).toBe(config.tosVersion)
			expect(data.needsAcceptance).toBe(true)
		})

		it('returns 401 when not authenticated', async () => {
			mockNoAuth()

			const response = await app.request('/api/tos/status', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' },
			})
			expect(response.status).toBe(401)
		})
	})

	describe('POST /tos/accept', () => {
		it('accepts ToS and updates user record', async () => {
			mockAuth(testUser)
			const { config } = await import('../config.js')

			// Ensure user has not accepted
			await prisma.user.update({
				where: { id: testUser.id },
				data: { tosAcceptedAt: null, tosVersion: null },
			})

			const response = await app.request('/api/tos/accept', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
			})
			expect(response.status).toBe(200)

			const data = (await response.json()) as any
			expect(data.success).toBe(true)
			expect(data.version).toBe(config.tosVersion)

			// Verify user was updated
			const updatedUser = await prisma.user.findUnique({
				where: { id: testUser.id },
				select: { tosAcceptedAt: true, tosVersion: true },
			})
			expect(updatedUser?.tosAcceptedAt).toBeDefined()
			expect(updatedUser?.tosVersion).toBe(config.tosVersion)
		})

		it('updates ToS acceptance when user has old version', async () => {
			mockAuth(testUser)
			const { config } = await import('../config.js')

			const oldDate = new Date(Date.now() - 86400000) // Yesterday
			await prisma.user.update({
				where: { id: testUser.id },
				data: {
					tosAcceptedAt: oldDate,
					tosVersion: config.tosVersion - 1,
				},
			})

			const response = await app.request('/api/tos/accept', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
			})
			expect(response.status).toBe(200)

			// Verify user was updated with new version and timestamp
			const updatedUser = await prisma.user.findUnique({
				where: { id: testUser.id },
				select: { tosAcceptedAt: true, tosVersion: true },
			})
			expect(updatedUser?.tosVersion).toBe(config.tosVersion)
			expect(updatedUser?.tosAcceptedAt).toBeDefined()
			expect(updatedUser?.tosAcceptedAt?.getTime()).toBeGreaterThan(oldDate.getTime())
		})

		it('returns 401 when not authenticated', async () => {
			mockNoAuth()

			const response = await app.request('/api/tos/accept', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
			})
			expect(response.status).toBe(401)
		})
	})
})
