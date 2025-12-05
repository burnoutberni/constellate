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
        },
    },
}))

describe('Server Setup', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('Health Check Endpoint', () => {

        it('should include ISO timestamp', async () => {
            const res = await app.request('/health')
            const body = await res.json() as any as any

            // Should be valid ISO date string
            expect(() => new Date(body.timestamp)).not.toThrow()
        })
    })

    describe('Root Endpoint', () => {
        it('should return API information', async () => {
            const res = await app.request('/')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
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
            const body = await res.json() as any as any
            expect(body).toHaveProperty('openapi')
            expect(body).toHaveProperty('info')
        })

        it('should set server URL from BETTER_AUTH_URL', async () => {
            const originalEnv = process.env.BETTER_AUTH_URL
            process.env.BETTER_AUTH_URL = 'https://example.com'

            // Reload server to pick up new env var
            vi.resetModules()
            const { app: newApp } = await import('../server.js')

            const res = await newApp.request('/doc')
            const body = await res.json() as any as any

            expect(body.servers).toBeDefined()
            expect(body.servers[0].url).toBe('https://example.com')

            process.env.BETTER_AUTH_URL = originalEnv
        })

        it('should use localhost as default server URL', async () => {
            const originalEnv = process.env.BETTER_AUTH_URL
            delete process.env.BETTER_AUTH_URL

            // Reload server
            vi.resetModules()
            const { app: newApp } = await import('../server.js')

            const res = await newApp.request('/doc')
            const body = await res.json() as any as any

            expect(body.servers[0].url).toBe('http://localhost:3000')

            process.env.BETTER_AUTH_URL = originalEnv
        })

        it('should return 500 when OpenAPI spec file is missing', async () => {
            const fsPromises = await import('node:fs/promises')
            const readFileSpy = vi.spyOn(fsPromises, 'readFile').mockRejectedValueOnce(new Error('missing file'))

            const res = await app.request('/doc')

            expect(res.status).toBe(500)
            readFileSpy.mockRestore()
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
            const body = await res.json() as any as any

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

        it('should generate keys after successful signup', async () => {
            const mockUser = {
                id: 'user-123',
                username: 'testuser',
                isRemote: false,
                publicKey: null,
                privateKey: null,
            }

            const mockResponse = new Response(
                JSON.stringify({
                    user: { id: 'user-123' },
                }),
                { status: 200 }
            )

            vi.mocked(authModule.auth.handler).mockResolvedValue(mockResponse)
            vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
            vi.mocked(authModule.generateUserKeys).mockResolvedValue(undefined)

            const res = await app.request('/api/auth/sign-up', {
                method: 'POST',
                body: JSON.stringify({
                    email: 'test@example.com',
                    password: 'password123',
                }),
            })

            // Wait for async key generation
            await new Promise(resolve => setTimeout(resolve, 100))

            expect(authModule.generateUserKeys).toHaveBeenCalledWith('user-123', 'testuser')
        })

        it('should not generate keys for remote users', async () => {
            const mockUser = {
                id: 'user-123',
                username: 'testuser',
                isRemote: true,
                publicKey: null,
                privateKey: null,
            }

            const mockResponse = new Response(
                JSON.stringify({
                    user: { id: 'user-123' },
                }),
                { status: 200 }
            )

            vi.mocked(authModule.auth.handler).mockResolvedValue(mockResponse)
            vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)

            await app.request('/api/auth/sign-up', {
                method: 'POST',
                body: JSON.stringify({
                    email: 'test@example.com',
                    password: 'password123',
                }),
            })

            await new Promise(resolve => setTimeout(resolve, 100))

            expect(authModule.generateUserKeys).not.toHaveBeenCalled()
        })

        it('should not generate keys if user already has keys', async () => {
            const mockUser = {
                id: 'user-123',
                username: 'testuser',
                isRemote: false,
                publicKey: 'public-key',
                privateKey: 'private-key',
            }

            const mockResponse = new Response(
                JSON.stringify({
                    user: { id: 'user-123' },
                }),
                { status: 200 }
            )

            vi.mocked(authModule.auth.handler).mockResolvedValue(mockResponse)
            vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)

            await app.request('/api/auth/sign-up', {
                method: 'POST',
                body: JSON.stringify({
                    email: 'test@example.com',
                    password: 'password123',
                }),
            })

            await new Promise(resolve => setTimeout(resolve, 100))

            expect(authModule.generateUserKeys).not.toHaveBeenCalled()
        })

        it('should not generate keys if signup fails', async () => {
            const mockResponse = new Response(
                JSON.stringify({ error: 'Signup failed' }),
                { status: 400 }
            )

            vi.mocked(authModule.auth.handler).mockResolvedValue(mockResponse)

            await app.request('/api/auth/sign-up', {
                method: 'POST',
                body: JSON.stringify({
                    email: 'test@example.com',
                    password: 'password123',
                }),
            })

            await new Promise(resolve => setTimeout(resolve, 100))

            expect(authModule.generateUserKeys).not.toHaveBeenCalled()
        })

        it('should handle signup response parsing errors gracefully', async () => {
            // Response that can't be parsed as JSON
            const mockResponse = new Response('Not JSON', { status: 200 })

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

        it('should handle signup response with different user ID structure', async () => {
            const mockResponse = new Response(
                JSON.stringify({
                    data: {
                        user: {
                            id: 'user-123',
                        },
                    },
                }),
                { status: 200 }
            )

            const mockUser = {
                id: 'user-123',
                username: 'testuser',
                isRemote: false,
                publicKey: null,
                privateKey: null,
            }

            vi.mocked(authModule.auth.handler).mockResolvedValue(mockResponse)
            vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
            vi.mocked(authModule.generateUserKeys).mockResolvedValue(undefined)

            await app.request('/api/auth/sign-up', {
                method: 'POST',
                body: JSON.stringify({
                    email: 'test@example.com',
                    password: 'password123',
                }),
            })

            await new Promise(resolve => setTimeout(resolve, 100))

            expect(authModule.generateUserKeys).toHaveBeenCalled()
        })

        it('should handle signup response without user ID', async () => {
            const mockResponse = new Response(
                JSON.stringify({
                    success: true,
                    // No user field
                }),
                { status: 200 }
            )

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

            await new Promise(resolve => setTimeout(resolve, 100))

            // Should not generate keys if no user ID
            expect(authModule.generateUserKeys).not.toHaveBeenCalled()
        })

        it('should handle non-signup auth routes without key generation', async () => {
            const mockResponse = new Response(JSON.stringify({ success: true }), {
                status: 200,
            })

            vi.mocked(authModule.auth.handler).mockResolvedValue(mockResponse)

            await app.request('/api/auth/session', {
                method: 'GET',
            })

            await new Promise(resolve => setTimeout(resolve, 100))

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

            await new Promise(resolve => setTimeout(resolve, 100))

            // GET requests should not trigger key generation
            expect(authModule.generateUserKeys).not.toHaveBeenCalled()
        })

        it('should handle key generation errors without crashing', async () => {
            const mockUser = {
                id: 'user-123',
                username: 'testuser',
                isRemote: false,
                publicKey: null,
                privateKey: null,
            }

            const mockResponse = new Response(
                JSON.stringify({
                    user: { id: 'user-123' },
                }),
                { status: 200 }
            )

            vi.mocked(authModule.auth.handler).mockResolvedValue(mockResponse)
            vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
            vi.mocked(authModule.generateUserKeys).mockRejectedValue(new Error('Key generation failed'))

            // Should not throw even if key generation fails
            await expect(
                app.request('/api/auth/sign-up', {
                    method: 'POST',
                    body: JSON.stringify({
                        email: 'test@example.com',
                        password: 'password123',
                    }),
                })
            ).resolves.not.toThrow()

            await new Promise(resolve => setTimeout(resolve, 100))
        })

        it('should handle database errors when checking user for key generation', async () => {
            const mockResponse = new Response(
                JSON.stringify({
                    user: { id: 'user-123' },
                }),
                { status: 200 }
            )

            vi.mocked(authModule.auth.handler).mockResolvedValue(mockResponse)
            vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error('Database error'))

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

            await new Promise(resolve => setTimeout(resolve, 100))
        })

        it('should handle requests to non-existent routes', async () => {
            const res = await app.request('/nonexistent-route')

            expect(res.status).toBe(404)
        })

    })
})

