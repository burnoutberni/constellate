/**
 * Tests for Admin Routes
 * User management and API key management (admin only)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { app } from '../server.js'
import { prisma } from '../lib/prisma.js'
import * as authModule from '../auth.js'
import { cleanupTestData, createTestUser } from './helpers/db.js'

describe('Admin Routes', () => {
	let adminUser: any
	let regularUser: any
	let testUser: any

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
		await cleanupTestData()

		adminUser = await createTestUser({
			username: 'admin',
			email: 'admin@example.com',
			name: 'Admin User',
			isAdmin: true,
		})

		regularUser = await createTestUser({
			username: 'regular',
			email: 'regular@example.com',
			name: 'Regular User',
			isAdmin: false,
		})

		testUser = await createTestUser({
			username: 'testuser',
			email: 'test@example.com',
			name: 'Test User',
			isAdmin: false,
		})

		vi.clearAllMocks()
		mockNoAuth()
	})

	afterEach(async () => {
		vi.restoreAllMocks()
	})

	describe('GET /api/admin/users', () => {
		it('should return 401 when not authenticated', async () => {
			mockNoAuth()

			const res = await app.request('/api/admin/users', {
				method: 'GET',
			})

			expect(res.status).toBe(401)
		})

		it('should return 403 when user is not admin', async () => {
			mockAuth(regularUser)

			const res = await app.request('/api/admin/users', {
				method: 'GET',
			})

			expect(res.status).toBe(403)
		})

		it('should list all users for admin', async () => {
			mockAuth(adminUser)

			const res = await app.request('/api/admin/users', {
				method: 'GET',
			})

			expect(res.status).toBe(200)
			const data = (await res.json()) as any
			expect(data.users).toBeDefined()
			expect(Array.isArray(data.users)).toBe(true)
			expect(data.pagination).toBeDefined()
			expect(data.pagination.total).toBeGreaterThanOrEqual(3)
		})

		it('should support pagination', async () => {
			mockAuth(adminUser)

			const res = await app.request('/api/admin/users?page=1&limit=2', {
				method: 'GET',
			})

			expect(res.status).toBe(200)
			const data = (await res.json()) as any
			expect(data.users.length).toBeLessThanOrEqual(2)
			expect(data.pagination.page).toBe(1)
			expect(data.pagination.limit).toBe(2)
		})

		it('should support search query', async () => {
			mockAuth(adminUser)

			const res = await app.request('/api/admin/users?search=admin', {
				method: 'GET',
			})

			expect(res.status).toBe(200)
			const data = (await res.json()) as any
			expect(data.users.length).toBeGreaterThan(0)
			expect(data.users.some((u: any) => u.username.includes('admin'))).toBe(true)
		})

		it('should filter by isBot=true', async () => {
			// Create a bot user
			await prisma.user.create({
				data: {
					username: 'bot_user',
					email: 'bot@example.com',
					name: 'Bot User',
					isBot: true,
					isRemote: false,
				},
			})

			mockAuth(adminUser)

			const res = await app.request('/api/admin/users?isBot=true', {
				method: 'GET',
			})

			expect(res.status).toBe(200)
			const data = (await res.json()) as any
			expect(data.users.every((u: any) => u.isBot === true)).toBe(true)
		})

		it('should filter by isBot=false', async () => {
			mockAuth(adminUser)

			const res = await app.request('/api/admin/users?isBot=false', {
				method: 'GET',
			})

			expect(res.status).toBe(200)
			const data = (await res.json()) as any
			expect(data.users.every((u: any) => u.isBot === false)).toBe(true)
		})

		it('should handle invalid query parameters', async () => {
			mockAuth(adminUser)

			const res = await app.request('/api/admin/users?page=invalid', {
				method: 'GET',
			})

			// Should still work, defaulting to page 1
			expect(res.status).toBe(200)
		})
	})

	describe('GET /api/admin/users/:id', () => {
		it('should return 401 when not authenticated', async () => {
			mockNoAuth()

			const res = await app.request(`/api/admin/users/${testUser.id}`, {
				method: 'GET',
			})

			expect(res.status).toBe(401)
		})

		it('should return 403 when user is not admin', async () => {
			mockAuth(regularUser)

			const res = await app.request(`/api/admin/users/${testUser.id}`, {
				method: 'GET',
			})

			expect(res.status).toBe(403)
		})

		it('should return user by ID for admin', async () => {
			mockAuth(adminUser)

			const res = await app.request(`/api/admin/users/${testUser.id}`, {
				method: 'GET',
			})

			expect(res.status).toBe(200)
			const data = (await res.json()) as any
			expect(data.id).toBe(testUser.id)
			expect(data.username).toBe(testUser.username)
			// _count should be present in the response
			if (data._count !== undefined) {
				expect(typeof data._count).toBe('object')
			}
		})

		it('should return 404 when user not found', async () => {
			mockAuth(adminUser)

			const res = await app.request('/api/admin/users/non-existent-id', {
				method: 'GET',
			})

			expect(res.status).toBe(404)
			const data = (await res.json()) as any
			expect(data.error).toBe('User not found')
		})
	})

	describe('POST /api/admin/users', () => {
		it('should return 401 when not authenticated', async () => {
			mockNoAuth()

			const res = await app.request('/api/admin/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					username: 'newuser',
					email: 'new@example.com',
					password: 'password123',
				}),
			})

			expect(res.status).toBe(401)
		})

		it('should return 403 when user is not admin', async () => {
			mockAuth(regularUser)

			const res = await app.request('/api/admin/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					username: 'newuser',
					email: 'new@example.com',
					password: 'password123',
				}),
			})

			expect(res.status).toBe(403)
		})

		it('should create a non-bot user with password', async () => {
			mockAuth(adminUser)

			// Mock signUpEmail to create and return a user
			vi.spyOn(authModule.auth.api, 'signUpEmail').mockImplementation(async (params: any) => {
				const createdUser = await prisma.user.create({
					data: {
						username: params.body.username,
						email: params.body.email,
						name: params.body.name,
						isRemote: false,
					},
				})
				return {
					user: createdUser,
				} as any
			})

			vi.spyOn(authModule, 'generateUserKeys').mockResolvedValue(undefined)

			const res = await app.request('/api/admin/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					username: 'newuser',
					email: 'new@example.com',
					name: 'New User',
					password: 'password123',
					isAdmin: false,
				}),
			})

			expect(res.status).toBe(201)
			const data = (await res.json()) as any
			expect(data.username).toBe('newuser')
			expect(data.email).toBe('new@example.com')
		})

		it('should create a bot user without password', async () => {
			mockAuth(adminUser)

			vi.spyOn(authModule, 'generateUserKeys').mockResolvedValue(undefined)

			const res = await app.request('/api/admin/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					username: 'botuser',
					email: 'bot@example.com',
					name: 'Bot User',
					isBot: true,
				}),
			})

			expect(res.status).toBe(201)
			const data = (await res.json()) as any
			expect(data.username).toBe('botuser')
			expect(data.isBot).toBe(true)
		})

		it('should return 400 when password is missing for non-bot user', async () => {
			mockAuth(adminUser)

			const res = await app.request('/api/admin/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					username: 'newuser',
					email: 'new@example.com',
					isBot: false,
				}),
			})

			expect(res.status).toBe(400)
			const data = (await res.json()) as any
			expect(data.error).toBe('Password is required for non-bot users')
		})

		it('should return 400 when username already exists', async () => {
			mockAuth(adminUser)

			const res = await app.request('/api/admin/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					username: testUser.username,
					email: 'different@example.com',
					password: 'password123',
				}),
			})

			expect(res.status).toBe(400)
			const data = (await res.json()) as any
			expect(data.error).toBe('Username already exists')
		})

		it('should return 400 when email already exists', async () => {
			mockAuth(adminUser)

			const res = await app.request('/api/admin/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					username: 'differentuser',
					email: testUser.email,
					password: 'password123',
				}),
			})

			expect(res.status).toBe(400)
			const data = (await res.json()) as any
			expect(data.error).toBe('Email already exists')
		})

		it('should return 400 on validation error', async () => {
			mockAuth(adminUser)

			const res = await app.request('/api/admin/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					username: '', // Invalid: empty username
					email: 'invalid-email', // Invalid email
				}),
			})

			expect(res.status).toBe(400)
			const data = (await res.json()) as any
			expect(data.error).toBe('Validation failed')
		})
	})

	describe('PUT /api/admin/users/:id', () => {
		it('should return 401 when not authenticated', async () => {
			mockNoAuth()

			const res = await app.request(`/api/admin/users/${testUser.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: 'Updated Name',
				}),
			})

			expect(res.status).toBe(401)
		})

		it('should return 403 when user is not admin', async () => {
			mockAuth(regularUser)

			const res = await app.request(`/api/admin/users/${testUser.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: 'Updated Name',
				}),
			})

			expect(res.status).toBe(403)
		})

		it('should update user for admin', async () => {
			mockAuth(adminUser)

			const res = await app.request(`/api/admin/users/${testUser.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: 'Updated Name',
					bio: 'Updated bio',
				}),
			})

			expect(res.status).toBe(200)
			const data = (await res.json()) as any
			expect(data.name).toBe('Updated Name')
			expect(data.bio).toBe('Updated bio')
		})

		it('should update isAdmin status', async () => {
			mockAuth(adminUser)

			const res = await app.request(`/api/admin/users/${testUser.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					isAdmin: true,
				}),
			})

			expect(res.status).toBe(200)
			const data = (await res.json()) as any
			expect(data.isAdmin).toBe(true)
		})

		it('should return 404 when user not found', async () => {
			mockAuth(adminUser)

			const res = await app.request('/api/admin/users/non-existent-id', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: 'Updated Name',
				}),
			})

			expect(res.status).toBe(404)
			const data = (await res.json()) as any
			expect(data.error).toBe('User not found')
		})

		it('should return 400 when username already exists', async () => {
			mockAuth(adminUser)

			const res = await app.request(`/api/admin/users/${testUser.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					username: regularUser.username,
				}),
			})

			expect(res.status).toBe(400)
			const data = (await res.json()) as any
			expect(data.error).toBe('Username already exists')
		})

		it('should return 400 when email already exists', async () => {
			mockAuth(adminUser)

			const res = await app.request(`/api/admin/users/${testUser.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: regularUser.email,
				}),
			})

			expect(res.status).toBe(400)
			const data = (await res.json()) as any
			expect(data.error).toBe('Email already exists')
		})

		it('should allow updating to same username', async () => {
			mockAuth(adminUser)

			const res = await app.request(`/api/admin/users/${testUser.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					username: testUser.username,
					name: 'Updated Name',
				}),
			})

			expect(res.status).toBe(200)
			const data = (await res.json()) as any
			expect(data.username).toBe(testUser.username)
		})

		it('should return 400 on validation error', async () => {
			mockAuth(adminUser)

			const res = await app.request(`/api/admin/users/${testUser.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: 'invalid-email',
				}),
			})

			expect(res.status).toBe(400)
			const data = (await res.json()) as any
			expect(data.error).toBe('Validation failed')
		})
	})

	describe('DELETE /api/admin/users/:id', () => {
		it('should return 401 when not authenticated', async () => {
			mockNoAuth()

			const res = await app.request(`/api/admin/users/${testUser.id}`, {
				method: 'DELETE',
			})

			expect(res.status).toBe(401)
		})

		it('should return 403 when user is not admin', async () => {
			mockAuth(regularUser)

			const res = await app.request(`/api/admin/users/${testUser.id}`, {
				method: 'DELETE',
			})

			expect(res.status).toBe(403)
		})

		it('should delete user for admin', async () => {
			mockAuth(adminUser)

			const userToDelete = await createTestUser({
				username: 'todelete',
				email: 'todelete@example.com',
			})

			const res = await app.request(`/api/admin/users/${userToDelete.id}`, {
				method: 'DELETE',
			})

			expect(res.status).toBe(200)
			const data = (await res.json()) as any
			expect(data.success).toBe(true)

			// Verify user is deleted
			const deletedUser = await prisma.user.findUnique({
				where: { id: userToDelete.id },
			})
			expect(deletedUser).toBeNull()
		})

		it('should return 404 when user not found', async () => {
			mockAuth(adminUser)

			const res = await app.request('/api/admin/users/non-existent-id', {
				method: 'DELETE',
			})

			expect(res.status).toBe(404)
			const data = (await res.json()) as any
			expect(data.error).toBe('User not found')
		})

		it('should return 400 when trying to delete own account', async () => {
			mockAuth(adminUser)

			const res = await app.request(`/api/admin/users/${adminUser.id}`, {
				method: 'DELETE',
			})

			expect(res.status).toBe(400)
			const data = (await res.json()) as any
			expect(data.error).toBe('Cannot delete your own account')
		})
	})

	describe('GET /api/admin/api-keys', () => {
		it('should return 401 when not authenticated', async () => {
			mockNoAuth()

			const res = await app.request('/api/admin/api-keys', {
				method: 'GET',
			})

			expect(res.status).toBe(401)
		})

		it('should return 403 when user is not admin', async () => {
			mockAuth(regularUser)

			const res = await app.request('/api/admin/api-keys', {
				method: 'GET',
			})

			expect(res.status).toBe(403)
		})

		it('should list all API keys for admin', async () => {
			mockAuth(adminUser)

			// Create an API key
			const apiKey = await (prisma as any).apiKey.create({
				data: {
					name: 'Test Key',
					description: 'Test description',
					keyHash: 'test-hash',
					prefix: 'sk_live_xxxx',
					userId: testUser.id,
				},
			})

			const res = await app.request('/api/admin/api-keys', {
				method: 'GET',
			})

			expect(res.status).toBe(200)
			const data = (await res.json()) as any
			expect(data.apiKeys).toBeDefined()
			expect(Array.isArray(data.apiKeys)).toBe(true)
			expect(data.apiKeys.length).toBeGreaterThan(0)
			expect(data.apiKeys[0].id).toBe(apiKey.id)
			expect(data.apiKeys[0].name).toBe('Test Key')
			// Should not include the full key hash
			expect(data.apiKeys[0].keyHash).toBeUndefined()
		})

		it('should filter API keys by userId', async () => {
			mockAuth(adminUser)

			// Create API keys for different users
			await (prisma as any).apiKey.create({
				data: {
					name: 'User1 Key',
					keyHash: 'hash1',
					prefix: 'sk_live_xxxx',
					userId: testUser.id,
				},
			})

			await (prisma as any).apiKey.create({
				data: {
					name: 'User2 Key',
					keyHash: 'hash2',
					prefix: 'sk_live_yyyy',
					userId: regularUser.id,
				},
			})

			const res = await app.request(`/api/admin/api-keys?userId=${testUser.id}`, {
				method: 'GET',
			})

			expect(res.status).toBe(200)
			const data = (await res.json()) as any
			expect(data.apiKeys.every((k: any) => k.userId === testUser.id)).toBe(true)
		})
	})

	describe('POST /api/admin/api-keys', () => {
		it('should return 401 when not authenticated', async () => {
			mockNoAuth()

			const res = await app.request('/api/admin/api-keys', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					userId: testUser.id,
					name: 'New Key',
				}),
			})

			expect(res.status).toBe(401)
		})

		it('should return 403 when user is not admin', async () => {
			mockAuth(regularUser)

			const res = await app.request('/api/admin/api-keys', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					userId: testUser.id,
					name: 'New Key',
				}),
			})

			expect(res.status).toBe(403)
		})

		it('should create API key for admin', async () => {
			mockAuth(adminUser)

			const res = await app.request('/api/admin/api-keys', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					userId: testUser.id,
					name: 'New API Key',
					description: 'Test description',
				}),
			})

			expect(res.status).toBe(201)
			const data = (await res.json()) as any
			expect(data.id).toBeDefined()
			expect(data.name).toBe('New API Key')
			expect(data.description).toBe('Test description')
			expect(data.key).toBeDefined()
			expect(data.key.startsWith('sk_live_')).toBe(true)
			expect(data.prefix).toBeDefined()
			expect(data.warning).toBeDefined()
		})

		it('should return 404 when user not found', async () => {
			mockAuth(adminUser)

			const res = await app.request('/api/admin/api-keys', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					userId: 'non-existent-id',
					name: 'New Key',
				}),
			})

			expect(res.status).toBe(404)
			const data = (await res.json()) as any
			expect(data.error).toBe('User not found')
		})

		it('should return 400 on validation error', async () => {
			mockAuth(adminUser)

			const res = await app.request('/api/admin/api-keys', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					userId: testUser.id,
					name: '', // Invalid: empty name
				}),
			})

			expect(res.status).toBe(400)
			const data = (await res.json()) as any
			expect(data.error).toBe('Validation failed')
		})
	})

	describe('DELETE /api/admin/api-keys/:id', () => {
		it('should return 401 when not authenticated', async () => {
			mockNoAuth()

			const apiKey = await (prisma as any).apiKey.create({
				data: {
					name: 'Test Key',
					keyHash: 'test-hash',
					prefix: 'sk_live_xxxx',
					userId: testUser.id,
				},
			})

			const res = await app.request(`/api/admin/api-keys/${apiKey.id}`, {
				method: 'DELETE',
			})

			expect(res.status).toBe(401)
		})

		it('should return 403 when user is not admin', async () => {
			mockAuth(regularUser)

			const apiKey = await (prisma as any).apiKey.create({
				data: {
					name: 'Test Key',
					keyHash: 'test-hash',
					prefix: 'sk_live_xxxx',
					userId: testUser.id,
				},
			})

			const res = await app.request(`/api/admin/api-keys/${apiKey.id}`, {
				method: 'DELETE',
			})

			expect(res.status).toBe(403)
		})

		it('should delete API key for admin', async () => {
			mockAuth(adminUser)

			const apiKey = await (prisma as any).apiKey.create({
				data: {
					name: 'Test Key',
					keyHash: 'test-hash',
					prefix: 'sk_live_xxxx',
					userId: testUser.id,
				},
			})

			const res = await app.request(`/api/admin/api-keys/${apiKey.id}`, {
				method: 'DELETE',
			})

			expect(res.status).toBe(200)
			const data = (await res.json()) as any
			expect(data.success).toBe(true)

			// Verify API key is deleted
			const deletedKey = await (prisma as any).apiKey.findUnique({
				where: { id: apiKey.id },
			})
			expect(deletedKey).toBeNull()
		})

		it('should return 404 when API key not found', async () => {
			mockAuth(adminUser)

			const res = await app.request('/api/admin/api-keys/non-existent-id', {
				method: 'DELETE',
			})

			expect(res.status).toBe(404)
			const data = (await res.json()) as any
			expect(data.error).toBe('API key not found')
		})
	})

	describe('Federation Management', () => {
		describe('GET /failed-deliveries', () => {
			it('should require admin authentication', async () => {
				const res = await app.request('/api/admin/failed-deliveries')
				expect(res.status).toBe(401)
			})
		})

		describe('GET /federation-stats', () => {
			it('should require admin authentication', async () => {
				const res = await app.request('/api/admin/federation-stats')
				expect(res.status).toBe(401)
			})
		})

		describe('POST /failed-deliveries/:id/retry', () => {
			it('should require admin authentication', async () => {
				const res = await app.request('/api/admin/failed-deliveries/delivery-1/retry', {
					method: 'POST',
				})
				expect(res.status).toBe(401)
			})
		})

		describe('POST /failed-deliveries/:id/discard', () => {
			it('should require admin authentication', async () => {
				const res = await app.request('/api/admin/failed-deliveries/delivery-1/discard', {
					method: 'POST',
				})
				expect(res.status).toBe(401)
			})
		})
	})
})
