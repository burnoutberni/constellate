/**
 * Tests for Setup Routes
 * Tests for onboarding and initial admin user creation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { app } from '../server.js'
import { prisma } from '../lib/prisma.js'
import * as authModule from '../auth.js'

describe('Setup Routes', () => {
	beforeEach(async () => {
		await prisma.user.deleteMany()

		vi.spyOn(authModule.auth.api, 'signUpEmail').mockImplementation(async (params: any) => {
			const createdUser = await prisma.user.create({
				data: {
					username: params.body?.username || params.body.username,
					email: params.body?.email || params.body.email,
					name: params.body?.name || params.body.name,
					isRemote: false,
				},
			})

			return {
				user: createdUser,
			} as any
		})

		vi.spyOn(authModule, 'generateUserKeys').mockResolvedValue(undefined)
	})

	afterEach(async () => {
		vi.restoreAllMocks()
	})

	describe('POST /api/setup', () => {
		it('should reject setup with missing email', async () => {
			const setupData = {
				username: 'admin',
				name: 'Admin User',
				password: 'securepassword123',
			}

			const res = await app.request('/api/setup', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(setupData),
			})

			expect(res.status).toBe(400)

			const data = (await res.json()) as { error: string }
			expect(data.error).toBe('Missing required fields')
		})

		it('should reject setup with missing username', async () => {
			const setupData = {
				email: 'admin@example.com',
				name: 'Admin User',
				password: 'securepassword123',
			}

			const res = await app.request('/api/setup', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(setupData),
			})

			expect(res.status).toBe(400)

			const data = (await res.json()) as { error: string }
			expect(data.error).toBe('Missing required fields')
		})

		it('should reject setup with missing name', async () => {
			const setupData = {
				email: 'admin@example.com',
				username: 'admin',
				password: 'securepassword123',
			}

			const res = await app.request('/api/setup', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(setupData),
			})

			expect(res.status).toBe(400)

			const data = (await res.json()) as { error: string }
			expect(data.error).toBe('Missing required fields')
		})

		it('should allow setup without password (for magic link only)', async () => {
			const setupData = {
				email: 'admin@example.com',
				username: 'admin',
				name: 'Admin User',
			}

			const res = await app.request('/api/setup', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(setupData),
			})

			expect(res.status).toBe(200)

			const signUpCall = vi.mocked(authModule.auth.api.signUpEmail).mock.calls[0]?.[0]
			expect(typeof signUpCall?.body?.password).toBe('string')
			expect(signUpCall?.body?.password?.length || 0).toBeGreaterThan(0)
		})

		it('should generate password when password is whitespace only', async () => {
			const setupData = {
				email: 'admin@example.com',
				username: 'admin',
				name: 'Admin User',
				password: '   ', // Whitespace only
			}

			const res = await app.request('/api/setup', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(setupData),
			})

			expect(res.status).toBe(200)

			const signUpCall = vi.mocked(authModule.auth.api.signUpEmail).mock.calls[0]?.[0]
			expect(typeof signUpCall?.body?.password).toBe('string')
			// Should generate a password (48 hex chars = 24 bytes)
			expect(signUpCall?.body?.password?.length || 0).toBe(48)
		})

		it('should use provided password when password is not empty', async () => {
			const setupData = {
				email: 'admin@example.com',
				username: 'admin',
				name: 'Admin User',
				password: 'mySecurePassword123',
			}

			const res = await app.request('/api/setup', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(setupData),
			})

			expect(res.status).toBe(200)

			const signUpCall = vi.mocked(authModule.auth.api.signUpEmail).mock.calls[0]?.[0]
			expect(signUpCall?.body?.password).toBe('mySecurePassword123')
		})
	})

	describe('GET /api/setup/status', () => {
		it('should return setupRequired: true when no users exist', async () => {
			await prisma.user.deleteMany()

			// Verify the database is actually empty
			const userCount = await prisma.user.count()
			expect(userCount).toBe(0)

			const res = await app.request('/api/setup/status', {
				method: 'GET',
			})

			expect(res.status).toBe(200)
			const body = (await res.json()) as { setupRequired: boolean }
			expect(body.setupRequired).toBe(true)
		})

		it('should return setupRequired: false when users exist', async () => {
			await prisma.user.create({
				data: {
					username: 'existing_user',
					email: 'existing@example.com',
					name: 'Existing User',
					isRemote: false,
				},
			})

			const res = await app.request('/api/setup/status', {
				method: 'GET',
			})

			expect(res.status).toBe(200)
			const body = (await res.json()) as { setupRequired: boolean }
			expect(body.setupRequired).toBe(false)
		})
	})
})
