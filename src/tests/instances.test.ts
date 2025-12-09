/**
 * Tests for Instance Discovery
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { 
    extractDomain, 
    extractBaseUrl, 
    trackInstance,
    getKnownInstances,
    searchInstances
} from '../lib/instanceHelpers.js'
import { prisma } from '../lib/prisma.js'

// Mock dependencies
vi.mock('../lib/prisma.js', () => ({
    prisma: {
        instance: {
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            findMany: vi.fn(),
            count: vi.fn(),
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
    },
}))

vi.mock('../lib/ssrfProtection.js', () => ({
    safeFetch: vi.fn(),
}))

describe('Instance Discovery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('extractDomain', () => {
        it('should extract domain from actor URL', () => {
            const actorUrl = 'https://mastodon.social/users/alice'
            const domain = extractDomain(actorUrl)
            expect(domain).toBe('mastodon.social')
        })

        it('should handle different URL formats', () => {
            expect(extractDomain('https://app1.local/@bob')).toBe('app1.local')
            expect(extractDomain('http://localhost:3000/users/test')).toBe('localhost')
        })

        it('should return null for invalid URLs', () => {
            expect(extractDomain('not-a-url')).toBeNull()
            expect(extractDomain('')).toBeNull()
        })
    })

    describe('extractBaseUrl', () => {
        it('should extract base URL from actor URL', () => {
            const actorUrl = 'https://mastodon.social/users/alice'
            const baseUrl = extractBaseUrl(actorUrl)
            expect(baseUrl).toBe('https://mastodon.social')
        })

        it('should handle HTTP URLs', () => {
            const actorUrl = 'http://app1.local/@bob'
            const baseUrl = extractBaseUrl(actorUrl)
            expect(baseUrl).toBe('http://app1.local')
        })

        it('should return null for invalid URLs', () => {
            expect(extractBaseUrl('invalid')).toBeNull()
        })
    })

    describe('trackInstance', () => {
        it('should create new instance if not exists', async () => {
            const actorUrl = 'https://mastodon.social/users/alice'
            
            vi.mocked(prisma.instance.findUnique).mockResolvedValue(null)
            vi.mocked(prisma.instance.create).mockResolvedValue({
                id: 'instance-1',
                domain: 'mastodon.social',
                baseUrl: 'https://mastodon.social',
                software: null,
                version: null,
                title: null,
                description: null,
                iconUrl: null,
                contact: null,
                userCount: null,
                eventCount: null,
                lastActivityAt: new Date(),
                isBlocked: false,
                lastFetchedAt: null,
                lastErrorAt: null,
                lastError: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            })

            await trackInstance(actorUrl)

            expect(prisma.instance.findUnique).toHaveBeenCalledWith({
                where: { domain: 'mastodon.social' },
            })
            expect(prisma.instance.create).toHaveBeenCalled()
        })

        it('should update existing instance activity time', async () => {
            const actorUrl = 'https://mastodon.social/users/alice'
            const existingInstance = {
                id: 'instance-1',
                domain: 'mastodon.social',
                baseUrl: 'https://mastodon.social',
                lastActivityAt: new Date('2024-01-01'),
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            vi.mocked(prisma.instance.findUnique).mockResolvedValue(existingInstance as any)
            vi.mocked(prisma.instance.update).mockResolvedValue(existingInstance as any)

            await trackInstance(actorUrl)

            expect(prisma.instance.update).toHaveBeenCalledWith({
                where: { domain: 'mastodon.social' },
                data: expect.objectContaining({
                    lastActivityAt: expect.any(Date),
                }),
            })
        })

        it('should handle invalid actor URLs gracefully', async () => {
            await trackInstance('invalid-url')
            expect(prisma.instance.findUnique).not.toHaveBeenCalled()
        })
    })

    describe('getKnownInstances', () => {
        it('should return list of instances with stats', async () => {
            const mockInstances = [
                {
                    id: 'instance-1',
                    domain: 'mastodon.social',
                    baseUrl: 'https://mastodon.social',
                    software: 'Mastodon',
                    version: '4.0.0',
                    title: 'Mastodon Social',
                    description: 'A public instance',
                    iconUrl: 'https://mastodon.social/icon.png',
                    contact: 'admin@mastodon.social',
                    userCount: 1000,
                    eventCount: 5000,
                    lastActivityAt: new Date(),
                    isBlocked: false,
                    lastFetchedAt: new Date(),
                    lastErrorAt: null,
                    lastError: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ]

            vi.mocked(prisma.instance.findMany).mockResolvedValue(mockInstances)
            vi.mocked(prisma.instance.count).mockResolvedValue(1)
            vi.mocked(prisma.user.count).mockResolvedValue(10)
            vi.mocked(prisma.event.count).mockResolvedValue(5)
            vi.mocked(prisma.following.count).mockResolvedValue(3)

            const result = await getKnownInstances({ limit: 10, offset: 0 })

            expect(result.instances).toHaveLength(1)
            expect(result.instances[0].domain).toBe('mastodon.social')
            expect(result.instances[0].stats).toEqual({
                remoteUsers: 10,
                remoteEvents: 5,
                localFollowing: 3,
            })
            expect(result.total).toBe(1)
        })

        it('should filter blocked instances by default', async () => {
            vi.mocked(prisma.instance.findMany).mockResolvedValue([])
            vi.mocked(prisma.instance.count).mockResolvedValue(0)

            await getKnownInstances({ filterBlocked: true })

            expect(prisma.instance.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { isBlocked: false },
                })
            )
        })

        it('should support different sort options', async () => {
            vi.mocked(prisma.instance.findMany).mockResolvedValue([])
            vi.mocked(prisma.instance.count).mockResolvedValue(0)

            await getKnownInstances({ sortBy: 'users' })

            expect(prisma.instance.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    orderBy: { userCount: 'desc' },
                })
            )
        })
    })

    describe('searchInstances', () => {
        it('should search instances by query', async () => {
            const mockInstances = [
                {
                    id: 'instance-1',
                    domain: 'mastodon.social',
                    baseUrl: 'https://mastodon.social',
                    title: 'Mastodon Social',
                    description: 'A public Mastodon instance',
                    isBlocked: false,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ]

            vi.mocked(prisma.instance.findMany).mockResolvedValue(mockInstances as any)

            const results = await searchInstances('mastodon')

            expect(prisma.instance.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        AND: expect.arrayContaining([
                            { isBlocked: false },
                        ]),
                    }),
                })
            )
            expect(results).toHaveLength(1)
            expect(results[0].domain).toBe('mastodon.social')
        })

        it('should respect limit parameter', async () => {
            vi.mocked(prisma.instance.findMany).mockResolvedValue([])

            await searchInstances('test', 5)

            expect(prisma.instance.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    take: 5,
                })
            )
        })
    })

    describe('refreshInstanceMetadata', () => {
        it('should update instance metadata when fetch succeeds', async () => {
            const { refreshInstanceMetadata } = await import('../lib/instanceHelpers.js')
            const { safeFetch } = await import('../lib/ssrfProtection.js')
            
            const mockInstance = {
                id: 'instance-1',
                domain: 'mastodon.social',
                baseUrl: 'https://mastodon.social',
            }

            vi.mocked(prisma.instance.findUnique).mockResolvedValue(mockInstance as any)
            vi.mocked(safeFetch).mockResolvedValueOnce({
                ok: false,
            } as any)
            vi.mocked(prisma.instance.update).mockResolvedValue(mockInstance as any)

            await refreshInstanceMetadata('mastodon.social')

            expect(prisma.instance.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { domain: 'mastodon.social' },
                    data: expect.objectContaining({
                        lastError: expect.any(String),
                        lastErrorAt: expect.any(Date),
                    }),
                })
            )
        })

        it('should record error when metadata fetch fails', async () => {
            const { refreshInstanceMetadata } = await import('../lib/instanceHelpers.js')
            const { safeFetch } = await import('../lib/ssrfProtection.js')
            
            vi.mocked(prisma.instance.findUnique).mockResolvedValue({
                id: 'instance-1',
                domain: 'mastodon.social',
                baseUrl: 'https://mastodon.social',
            } as any)
            vi.mocked(safeFetch).mockRejectedValue(new Error('Network error'))
            vi.mocked(prisma.instance.update).mockResolvedValue({} as any)

            await refreshInstanceMetadata('mastodon.social')

            expect(prisma.instance.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { domain: 'mastodon.social' },
                    data: expect.objectContaining({
                        lastError: expect.any(String),
                        lastErrorAt: expect.any(Date),
                    }),
                })
            )
        })
    })

    describe('extractBaseUrl with ports', () => {
        it('should include non-standard ports in baseUrl', () => {
            expect(extractBaseUrl('http://localhost:3000/users/alice')).toBe('http://localhost:3000')
            expect(extractBaseUrl('https://app1.local:8443/@bob')).toBe('https://app1.local:8443')
        })

        it('should not include standard ports', () => {
            expect(extractBaseUrl('http://example.com:80/users/alice')).toBe('http://example.com')
            expect(extractBaseUrl('https://example.com:443/users/alice')).toBe('https://example.com')
        })
    })

    describe('fetchInstanceMetadata', () => {
        it('should fetch and parse NodeInfo metadata', async () => {
            const { fetchInstanceMetadata } = await import('../lib/instanceHelpers.js')
            const { safeFetch } = await import('../lib/ssrfProtection.js')

            const wellKnownResponse = {
                ok: true,
                json: async () => ({
                    links: [
                        {
                            rel: 'http://nodeinfo.diaspora.software/ns/schema/2.0',
                            href: 'https://mastodon.social/nodeinfo/2.0',
                        },
                    ],
                }),
            }

            const nodeInfoResponse = {
                ok: true,
                json: async () => ({
                    software: { name: 'mastodon', version: '4.0.0' },
                    usage: {
                        users: { total: 10000 },
                        localPosts: 50000,
                        localComments: 5000,
                    },
                    metadata: {
                        nodeName: 'Mastodon Social',
                        nodeDescription: 'A public instance',
                        nodeIcon: 'https://mastodon.social/icon.png',
                        contact: 'admin@mastodon.social',
                    },
                }),
            }

            vi.mocked(safeFetch)
                .mockResolvedValueOnce(wellKnownResponse as any)
                .mockResolvedValueOnce(nodeInfoResponse as any)

            const metadata = await fetchInstanceMetadata('https://mastodon.social')

            expect(metadata).toEqual({
                software: 'mastodon',
                version: '4.0.0',
                userCount: 10000,
                eventCount: 55000,
                title: 'Mastodon Social',
                description: 'A public instance',
                iconUrl: 'https://mastodon.social/icon.png',
                contact: 'admin@mastodon.social',
            })
        })

        it('should handle NodeInfo 2.1 schema', async () => {
            const { fetchInstanceMetadata } = await import('../lib/instanceHelpers.js')
            const { safeFetch } = await import('../lib/ssrfProtection.js')

            const wellKnownResponse = {
                ok: true,
                json: async () => ({
                    links: [
                        {
                            rel: 'http://nodeinfo.diaspora.software/ns/schema/2.1',
                            href: 'https://example.com/nodeinfo/2.1',
                        },
                    ],
                }),
            }

            const nodeInfoResponse = {
                ok: true,
                json: async () => ({
                    software: { name: 'example', version: '1.0.0' },
                }),
            }

            vi.mocked(safeFetch)
                .mockResolvedValueOnce(wellKnownResponse as any)
                .mockResolvedValueOnce(nodeInfoResponse as any)

            const metadata = await fetchInstanceMetadata('https://example.com')

            expect(metadata?.software).toBe('example')
        })

        it('should return null if NodeInfo not available', async () => {
            const { fetchInstanceMetadata } = await import('../lib/instanceHelpers.js')
            const { safeFetch } = await import('../lib/ssrfProtection.js')

            vi.mocked(safeFetch).mockResolvedValue({
                ok: false,
            } as any)

            const metadata = await fetchInstanceMetadata('https://example.com')

            expect(metadata).toBeNull()
        })

        it('should return null if no NodeInfo link found', async () => {
            const { fetchInstanceMetadata } = await import('../lib/instanceHelpers.js')
            const { safeFetch } = await import('../lib/ssrfProtection.js')

            vi.mocked(safeFetch).mockResolvedValue({
                ok: true,
                json: async () => ({ links: [] }),
            } as any)

            const metadata = await fetchInstanceMetadata('https://example.com')

            expect(metadata).toBeNull()
        })

        it('should handle fetch errors', async () => {
            const { fetchInstanceMetadata } = await import('../lib/instanceHelpers.js')
            const { safeFetch } = await import('../lib/ssrfProtection.js')

            vi.mocked(safeFetch).mockRejectedValue(new Error('Network error'))

            const metadata = await fetchInstanceMetadata('https://example.com')

            expect(metadata).toBeNull()
        })
    })
})
