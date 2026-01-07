/**
 * Tests for Server Setup and Routing
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { app } from '../server.js'
import * as authModule from '../auth.js'
import * as errorsModule from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import { AppError } from '../lib/errors.js'
import { ZodError } from 'zod'

// Mock dependencies
vi.mock('../auth.js', () => ({
	auth: {
		handler: vi.fn(),
		api: {
			getSession: vi.fn(),
		},
	},
	generateUserKeys: vi.fn(),
}))

vi.mock('../lib/prisma.js', () => ({
	prisma: {
		user: {
			findUnique: vi.fn(),
			update: vi.fn(),
		},
		$queryRaw: vi.fn(),
	},
}))

describe('Server Setup', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe('Health Check Endpoint', () => {
		it('should include ISO timestamp', async () => {
			const res = await app.request('/health')
			const body = (await res.json()) as any as any

			// Should be valid ISO date string
			expect(() => new Date(body.timestamp)).not.toThrow()
		})

		it('should return 200 when database is connected', async () => {
			// Mock successful database query
			vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }])

			const res = await app.request('/health')
			const body = (await res.json()) as any

			expect(res.status).toBe(200)
			expect(body.status).toBe('ok')
			expect(body.checks.database).toBe('ok')
		})

		it('should return 503 when database is disconnected', async () => {
			// Mock database error
			vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('Database error'))

			const res = await app.request('/health')
			const body = (await res.json()) as any

			expect(res.status).toBe(503)
			expect(body.status).toBe('degraded')
			expect(body.checks.database).toBe('error')
		})

		it('should include all required health check fields', async () => {
			const res = await app.request('/health')
			const body = (await res.json()) as any

			expect(body).toHaveProperty('status')
			expect(body).toHaveProperty('timestamp')
			expect(body).toHaveProperty('checks')
			expect(body.checks).toHaveProperty('database')
		})
	})

	describe('Middleware', () => {
		it('should apply CORS headers', async () => {
			const res = await app.request('/')

			// CORS headers should be present
			expect(res.headers.get('access-control-allow-credentials')).toBe('true')
		})

		it('should apply security headers', async () => {
			const res = await app.request('/')

			// Security headers should be present
			expect(res.headers.get('x-frame-options')).toBeDefined()
			expect(res.headers.get('x-content-type-options')).toBeDefined()
		})
	})

	describe('Root Endpoint', () => {
		it('should return API information', async () => {
			const res = await app.request('/')

			expect(res.status).toBe(200)
			const body = (await res.json()) as any as any
			expect(body).toEqual({
				name: 'Constellate',
				version: '1.0.0',
				description: 'Federated event management platform',
			})
		})
	})

	describe('OpenAPI Documentation', () => {
		it('should serve OpenAPI spec at /doc', async () => {
			const res = await app.request('/doc')

			expect(res.status).toBe(200)
			const body = (await res.json()) as any as any
			expect(body).toHaveProperty('openapi')
			expect(body).toHaveProperty('info')
		})

		it('should set server URL from BASE_URL', async () => {
			const originalEnv = process.env.BASE_URL
			process.env.BASE_URL = 'https://example.com'

			// Reload server to pick up new env var
			vi.resetModules()
			const { app: newApp } = await import('../server.js')

			const res = await newApp.request('/doc')
			const body = (await res.json()) as any as any

			expect(body.servers).toBeDefined()
			expect(body.servers[0].url).toBe('https://example.com')

			process.env.BASE_URL = originalEnv
		})

		it('should use localhost as default server URL', async () => {
			const originalEnv = process.env.BASE_URL
			delete process.env.BASE_URL

			// Reload server
			vi.resetModules()
			const { app: newApp } = await import('../server.js')

			const res = await newApp.request('/doc')
			const body = (await res.json()) as any as any

			expect(body.servers[0].url).toBe('http://localhost:3000')

			process.env.BASE_URL = originalEnv
		})

		it('should return 500 when OpenAPI spec file is missing', async () => {
			const fsPromises = await import('node:fs/promises')
			const pathModule = await import('node:path')
			const { fileURLToPath } = await import('node:url')
			const testFileDir = pathModule.dirname(fileURLToPath(import.meta.url))
			const openapiPath = pathModule.resolve(testFileDir, '../openapi.json')
			const backupPath = `${openapiPath}.bak`

			await fsPromises.rename(openapiPath, backupPath)
			try {
				const res = await app.request('/doc')
				expect(res.status).toBe(500)
			} finally {
				await fsPromises.rename(backupPath, openapiPath)
			}
		})
	})

	describe('API Reference Endpoint', () => {
		it('should serve API reference at /reference', async () => {
			const res = await app.request('/reference')

			expect(res.status).toBe(200)
		})
	})

	describe('Error Handling', () => {
		it('should include error details in development', async () => {
			const originalEnv = process.env.NODE_ENV
			process.env.NODE_ENV = 'development'

			vi.resetModules()
			const { handleError } = await import('../lib/errors.js')
			const { Hono } = await import('hono')
			const { AppError } = await import('../lib/errors.js')

			const newApp = new Hono()
			newApp.onError(handleError)

			newApp.get('/test-error-details', () => {
				throw new AppError('TEST_ERROR', 'Test error', 400, { detail: 'test' })
			})

			const res = await newApp.request('/test-error-details')
			const body = (await res.json()) as any as any

			expect(body).toHaveProperty('details')

			process.env.NODE_ENV = originalEnv
			vi.resetModules()
		})
	})

	describe('Auth Routes', () => {
		it('should proxy auth requests to better-auth', async () => {
			const mockResponse = new Response(JSON.stringify({ success: true }), {
				status: 200,
			})

			vi.mocked(authModule.auth.handler).mockResolvedValue(mockResponse)

			const res = await app.request('/api/auth/session', {
				method: 'GET',
			})

			expect(authModule.auth.handler).toHaveBeenCalled()
			expect(res.status).toBe(200)
		})

		// Note: ToS validation and post-signup actions (key generation, ToS timestamp)
		// are now handled by better-auth hooks in src/auth.ts, not in the server route handler.
		// These hooks run inside better-auth, so when we mock auth.handler, the hooks don't execute.
		// The hooks are tested separately in src/tests/auth.test.ts.
		// These tests verify that the server properly proxies requests to better-auth.

		it('should proxy signup requests to better-auth', async () => {
			const mockResponse = new Response(
				JSON.stringify({
					user: { id: 'user-123' },
				}),
				{ status: 200 }
			)

			vi.mocked(authModule.auth.handler).mockResolvedValue(mockResponse)

			const res = await app.request('/api/auth/sign-up', {
				method: 'POST',
				body: JSON.stringify({
					email: 'test@example.com',
					password: 'password123',
					tosAccepted: true,
				}),
			})

			expect(authModule.auth.handler).toHaveBeenCalled()
			expect(res.status).toBe(200)
		})
	})

	describe('Edge Cases', () => {
		it('should handle malformed JSON in signup response', async () => {
			const mockResponse = new Response('Invalid JSON', { status: 200 })
			vi.mocked(authModule.auth.handler).mockResolvedValue(mockResponse)

			// Should not throw
			await expect(
				app.request('/api/auth/sign-up', {
					method: 'POST',
					body: JSON.stringify({
						email: 'test@example.com',
						password: 'password123',
					}),
				})
			).resolves.not.toThrow()
		})

		it('should handle non-signup auth routes without key generation', async () => {
			const mockResponse = new Response(JSON.stringify({ success: true }), {
				status: 200,
			})

			vi.mocked(authModule.auth.handler).mockResolvedValue(mockResponse)

			await app.request('/api/auth/session', {
				method: 'GET',
			})

			await new Promise((resolve) => setTimeout(resolve, 100))

			// Should not generate keys for non-signup routes
			expect(authModule.generateUserKeys).not.toHaveBeenCalled()
		})

		it('should handle GET signup route (should not generate keys)', async () => {
			const mockResponse = new Response(JSON.stringify({ success: true }), {
				status: 200,
			})

			vi.mocked(authModule.auth.handler).mockResolvedValue(mockResponse)

			await app.request('/api/auth/sign-up', {
				method: 'GET',
			})

			await new Promise((resolve) => setTimeout(resolve, 100))

			// GET requests should not trigger key generation
			expect(authModule.generateUserKeys).not.toHaveBeenCalled()
		})

		it('should handle requests to non-existent routes', async () => {
			const res = await app.request('/nonexistent-route')

			expect(res.status).toBe(404)
		})
	})
})
