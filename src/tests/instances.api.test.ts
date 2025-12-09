/**
 * Tests for Instance Discovery API Routes
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import instancesRoutes from '../instances.js'
import { prisma } from '../lib/prisma.js'

// Mock dependencies
vi.mock('../lib/prisma.js', () => ({
    prisma: {
        instance: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
            count: vi.fn(),
            update: vi.fn(),
        },
        user: {
            count: vi.fn(),
        },
        event: {
            count: vi.fn(),
        },
        following: {
            count: vi.fn(),
        },
        follower: {
            count: vi.fn(),
        },
    },
}))

vi.mock('../middleware/auth.js', () => ({
    requireAuth: vi.fn(async () => {}),
    requireAdmin: vi.fn(async () => {}),
}))

vi.mock('../lib/instanceHelpers.js', () => ({
    getKnownInstances: vi.fn(),
    searchInstances: vi.fn(),
    refreshInstanceMetadata: vi.fn(),
    getInstanceStats: vi.fn(),
}))

vi.mock('../lib/errors.js', () => ({
    handleError: vi.fn((error, c) => c.json({ error: 'Internal error' }, 500)),
}))

describe('Instance Discovery API', () => {
    let app: Hono

    beforeEach(() => {
        vi.clearAllMocks()
        app = new Hono()
        app.route('/api/instances', instancesRoutes)
    })

    describe('GET /api/instances', () => {
        it('should list known instances', async () => {
            const { getKnownInstances } = await import('../lib/instanceHelpers.js')
            vi.mocked(getKnownInstances).mockResolvedValue({
                instances: [
                    {
                        id: 'instance-1',
                        domain: 'mastodon.social',
                        baseUrl: 'https://mastodon.social',
                        software: 'Mastodon',
                        version: '4.0.0',
                        title: 'Mastodon Social',
                        description: 'A public instance',
                        iconUrl: null,
                        contact: null,
                        userCount: 1000,
                        eventCount: 5000,
                        lastActivityAt: new Date(),
                        isBlocked: false,
                        lastFetchedAt: new Date(),
                        lastErrorAt: null,
                        lastError: null,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        stats: {
                            remoteUsers: 10,
                            remoteEvents: 5,
                            localFollowing: 3,
                        },
                    },
                ],
                total: 1,
                limit: 50,
                offset: 0,
            })

            const res = await app.request('/api/instances')
            
            expect(res.status).toBe(200)
            const data = await res.json() as { instances: unknown[]; total: number }
            expect(data.instances).toHaveLength(1)
            expect(data.total).toBe(1)
        })

        it('should handle pagination parameters', async () => {
            const { getKnownInstances } = await import('../lib/instanceHelpers.js')
            vi.mocked(getKnownInstances).mockResolvedValue({
                instances: [],
                total: 0,
                limit: 10,
                offset: 20,
            })

            const res = await app.request('/api/instances?limit=10&offset=20')
            
            expect(res.status).toBe(200)
            expect(getKnownInstances).toHaveBeenCalledWith({
                limit: 10,
                offset: 20,
                sortBy: 'activity',
                filterBlocked: true,
            })
        })

        it('should handle sort parameter', async () => {
            const { getKnownInstances } = await import('../lib/instanceHelpers.js')
            vi.mocked(getKnownInstances).mockResolvedValue({
                instances: [],
                total: 0,
                limit: 50,
                offset: 0,
            })

            const res = await app.request('/api/instances?sortBy=users')
            
            expect(res.status).toBe(200)
            expect(getKnownInstances).toHaveBeenCalledWith({
                limit: 50,
                offset: 0,
                sortBy: 'users',
                filterBlocked: true,
            })
        })
    })

    describe('GET /api/instances/search', () => {
        it('should search instances', async () => {
            const { searchInstances } = await import('../lib/instanceHelpers.js')
            vi.mocked(searchInstances).mockResolvedValue([
                {
                    id: 'instance-1',
                    domain: 'mastodon.social',
                    baseUrl: 'https://mastodon.social',
                    title: 'Mastodon Social',
                    description: 'A public Mastodon instance',
                    isBlocked: false,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                } as any,
            ])

            const res = await app.request('/api/instances/search?q=mastodon')
            
            expect(res.status).toBe(200)
            const data = await res.json() as { instances: unknown[] }
            expect(data.instances).toHaveLength(1)
        })

        it('should require search query', async () => {
            const res = await app.request('/api/instances/search')
            
            expect(res.status).toBe(400)
        })
    })

    describe('GET /api/instances/:domain', () => {
        it('should return instance details', async () => {
            const mockInstance = {
                id: 'instance-1',
                domain: 'mastodon.social',
                baseUrl: 'https://mastodon.social',
                software: 'Mastodon',
                version: '4.0.0',
                title: 'Mastodon Social',
                description: 'A public instance',
                iconUrl: null,
                contact: null,
                userCount: 1000,
                eventCount: 5000,
                lastActivityAt: new Date(),
                isBlocked: false,
                lastFetchedAt: new Date(),
                lastErrorAt: null,
                lastError: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            const { getInstanceStats } = await import('../lib/instanceHelpers.js')
            
            vi.mocked(prisma.instance.findUnique).mockResolvedValue(mockInstance)
            vi.mocked(getInstanceStats).mockResolvedValue({
                remoteUsers: 10,
                remoteEvents: 5,
                localFollowing: 3,
                localFollowers: 2,
            })

            const res = await app.request('/api/instances/mastodon.social')
            
            expect(res.status).toBe(200)
            const data = await res.json() as { domain: string; stats: { remoteUsers: number; remoteEvents: number; localFollowing: number; localFollowers: number } }
            expect(data.domain).toBe('mastodon.social')
            expect(data.stats).toEqual({
                remoteUsers: 10,
                remoteEvents: 5,
                localFollowing: 3,
                localFollowers: 2,
            })
        })

        it('should return 404 for unknown instance', async () => {
            vi.mocked(prisma.instance.findUnique).mockResolvedValue(null)

            const res = await app.request('/api/instances/unknown.social')
            
            expect(res.status).toBe(404)
        })
    })

    describe('POST /api/instances/:domain/refresh', () => {
        it('should refresh instance metadata', async () => {
            const { refreshInstanceMetadata } = await import('../lib/instanceHelpers.js')
            const mockInstance = {
                id: 'instance-1',
                domain: 'mastodon.social',
                baseUrl: 'https://mastodon.social',
            }

            vi.mocked(prisma.instance.findUnique).mockResolvedValue(mockInstance as any)
            vi.mocked(refreshInstanceMetadata).mockResolvedValue(undefined)

            const res = await app.request('/api/instances/mastodon.social/refresh', {
                method: 'POST',
            })
            
            expect(res.status).toBe(200)
            expect(refreshInstanceMetadata).toHaveBeenCalledWith('mastodon.social')
        })

        it('should return 404 for unknown instance', async () => {
            vi.mocked(prisma.instance.findUnique).mockResolvedValue(null)

            const res = await app.request('/api/instances/unknown.social/refresh', {
                method: 'POST',
            })
            
            expect(res.status).toBe(404)
        })
    })

    describe('POST /api/instances/:domain/block', () => {
        it('should block an instance', async () => {
            const mockInstance = {
                id: 'instance-1',
                domain: 'mastodon.social',
                isBlocked: true,
            }

            vi.mocked(prisma.instance.update).mockResolvedValue(mockInstance as any)

            const res = await app.request('/api/instances/mastodon.social/block', {
                method: 'POST',
            })
            
            expect(res.status).toBe(200)
            expect(prisma.instance.update).toHaveBeenCalledWith({
                where: { domain: 'mastodon.social' },
                data: { isBlocked: true },
            })
        })

        it('should handle errors when blocking non-existent instance', async () => {
            vi.mocked(prisma.instance.update).mockRejectedValue(new Error('Record not found'))

            const res = await app.request('/api/instances/unknown.social/block', {
                method: 'POST',
            })
            
            expect(res.status).toBe(500)
        })
    })

    describe('POST /api/instances/:domain/unblock', () => {
        it('should unblock an instance', async () => {
            const mockInstance = {
                id: 'instance-1',
                domain: 'mastodon.social',
                isBlocked: false,
            }

            vi.mocked(prisma.instance.update).mockResolvedValue(mockInstance as any)

            const res = await app.request('/api/instances/mastodon.social/unblock', {
                method: 'POST',
            })
            
            expect(res.status).toBe(200)
            expect(prisma.instance.update).toHaveBeenCalledWith({
                where: { domain: 'mastodon.social' },
                data: { isBlocked: false },
            })
        })

        it('should handle errors when unblocking non-existent instance', async () => {
            vi.mocked(prisma.instance.update).mockRejectedValue(new Error('Record not found'))

            const res = await app.request('/api/instances/unknown.social/unblock', {
                method: 'POST',
            })
            
            expect(res.status).toBe(500)
        })
    })

    describe('Validation tests', () => {
        it('should handle invalid limit parameter gracefully', async () => {
            const { getKnownInstances } = await import('../lib/instanceHelpers.js')
            vi.mocked(getKnownInstances).mockResolvedValue({
                instances: [],
                total: 0,
                limit: 50,
                offset: 0,
            })

            const res = await app.request('/api/instances?limit=invalid')
            
            // Zod coercion should handle this and use default or fail validation
            expect(res.status).toBe(400)
        })

        it('should handle negative offset gracefully', async () => {
            const { getKnownInstances } = await import('../lib/instanceHelpers.js')
            vi.mocked(getKnownInstances).mockResolvedValue({
                instances: [],
                total: 0,
                limit: 50,
                offset: 0,
            })

            const res = await app.request('/api/instances?offset=-5')
            
            // Zod validation should reject negative values
            expect(res.status).toBe(400)
        })

        it('should enforce maximum limit', async () => {
            const res = await app.request('/api/instances?limit=200')
            
            // Should reject values above maximum with 400
            expect(res.status).toBe(400)
        })

        it('should accept valid limit within range', async () => {
            const { getKnownInstances } = await import('../lib/instanceHelpers.js')
            vi.mocked(getKnownInstances).mockResolvedValue({
                instances: [],
                total: 0,
                limit: 50,
                offset: 0,
            })

            const res = await app.request('/api/instances?limit=50')
            
            expect(res.status).toBe(200)
            expect(getKnownInstances).toHaveBeenCalledWith(
                expect.objectContaining({
                    limit: 50,
                })
            )
        })
    })
})
