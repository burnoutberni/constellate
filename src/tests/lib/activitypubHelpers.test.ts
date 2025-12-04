import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
    getBaseUrl,
    resolveWebFinger,
    fetchActor,
    cacheRemoteUser,
    createOrderedCollection,
    createOrderedCollectionPage,
    parseActivityId,
    isActivityProcessed,
    markActivityProcessed,
    cleanupProcessedActivities,
    isUserBlocked,
    isDomainBlocked,
} from '../../lib/activitypubHelpers.js'
import { prisma } from '../../lib/prisma.js'
import { safeFetch } from '../../lib/ssrfProtection.js'
import { ContentType } from '../../constants/activitypub.js'
import type { Person } from '../../lib/activitypubSchemas.js'

// Mock dependencies
vi.mock('../../lib/prisma.js', () => ({
    prisma: {
        user: {
            upsert: vi.fn(),
        },
        processedActivity: {
            findUnique: vi.fn(),
            create: vi.fn(),
            deleteMany: vi.fn(),
        },
        blockedUser: {
            findUnique: vi.fn(),
        },
        blockedDomain: {
            findUnique: vi.fn(),
        },
    },
}))

vi.mock('../../lib/ssrfProtection.js', () => ({
    safeFetch: vi.fn(),
}))

vi.mock('../../config.js', () => ({
    config: {
        baseUrl: 'http://localhost:3000',
    },
}))

describe('activitypubHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('getBaseUrl', () => {
        it('should return the base URL from config', () => {
            const baseUrl = getBaseUrl()
            expect(baseUrl).toBe('http://localhost:3000')
        })
    })

    describe('resolveWebFinger', () => {
        it('should resolve a valid WebFinger resource', async () => {
            const mockResponse = {
                ok: true,
                json: async () => ({
                    links: [
                        {
                            rel: 'self',
                            type: ContentType.ACTIVITY_JSON,
                            href: 'https://example.com/users/alice',
                        },
                    ],
                }),
            }
            vi.mocked(safeFetch).mockResolvedValue(mockResponse as Response)

            const result = await resolveWebFinger('acct:alice@example.com')
            expect(result).toBe('https://example.com/users/alice')
            expect(safeFetch).toHaveBeenCalledWith(
                'https://example.com/.well-known/webfinger?resource=acct%3Aalice%40example.com',
                {
                    headers: {
                        Accept: ContentType.JSON,
                    },
                }
            )
        })

        it('should return null for invalid resource format', async () => {
            const result = await resolveWebFinger('invalid-format')
            expect(result).toBeNull()
            expect(safeFetch).not.toHaveBeenCalled()
        })

        it('should return null when WebFinger request fails', async () => {
            const mockResponse = {
                ok: false,
            }
            vi.mocked(safeFetch).mockResolvedValue(mockResponse as Response)

            const result = await resolveWebFinger('acct:alice@example.com')
            expect(result).toBeNull()
        })

        it('should return null when no ActivityPub link found', async () => {
            const mockResponse = {
                ok: true,
                json: async () => ({
                    links: [
                        {
                            rel: 'alternate',
                            type: 'text/html',
                            href: 'https://example.com/users/alice',
                        },
                    ],
                }),
            }
            vi.mocked(safeFetch).mockResolvedValue(mockResponse as Response)

            const result = await resolveWebFinger('acct:alice@example.com')
            expect(result).toBeNull()
        })

        it('should use http for .local domains in development', async () => {
            const originalEnv = process.env.NODE_ENV
            process.env.NODE_ENV = 'development'

            const mockResponse = {
                ok: true,
                json: async () => ({
                    links: [
                        {
                            rel: 'self',
                            type: ContentType.ACTIVITY_JSON,
                            href: 'http://app2.local/users/bob',
                        },
                    ],
                }),
            }
            vi.mocked(safeFetch).mockResolvedValue(mockResponse as Response)

            await resolveWebFinger('acct:bob@app2.local')
            expect(safeFetch).toHaveBeenCalledWith(
                expect.stringContaining('http://app2.local'),
                expect.any(Object)
            )

            process.env.NODE_ENV = originalEnv
        })

        it('should handle errors gracefully', async () => {
            vi.mocked(safeFetch).mockRejectedValue(new Error('Network error'))

            const result = await resolveWebFinger('acct:alice@example.com')
            expect(result).toBeNull()
        })
    })

    describe('fetchActor', () => {
        it('should fetch an actor successfully', async () => {
            const mockActor = {
                id: 'https://example.com/users/alice',
                type: 'Person',
                preferredUsername: 'alice',
                name: 'Alice',
            }
            const mockResponse = {
                ok: true,
                json: async () => mockActor,
            }
            vi.mocked(safeFetch).mockResolvedValue(mockResponse as Response)

            const result = await fetchActor('https://example.com/users/alice')
            expect(result).toEqual(mockActor)
            expect(safeFetch).toHaveBeenCalledWith(
                'https://example.com/users/alice',
                {
                    headers: {
                        Accept: ContentType.ACTIVITY_JSON,
                    },
                }
            )
        })

        it('should return null when request fails', async () => {
            const mockResponse = {
                ok: false,
            }
            vi.mocked(safeFetch).mockResolvedValue(mockResponse as Response)

            const result = await fetchActor('https://example.com/users/alice')
            expect(result).toBeNull()
        })

        it('should handle errors gracefully', async () => {
            vi.mocked(safeFetch).mockRejectedValue(new Error('Network error'))

            const result = await fetchActor('https://example.com/users/alice')
            expect(result).toBeNull()
        })
    })

    describe('cacheRemoteUser', () => {
        it('should create a new remote user', async () => {
            const mockActor = {
                type: 'Person',
                id: 'https://example.com/users/alice',
                preferredUsername: 'alice',
                name: 'Alice Smith',
                inbox: 'https://example.com/users/alice/inbox',
                outbox: 'https://example.com/users/alice/outbox',
                endpoints: {
                    sharedInbox: 'https://example.com/inbox',
                },
                publicKey: {
                    publicKeyPem: '-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----',
                },
                icon: {
                    url: 'https://example.com/avatar.jpg',
                },
                image: {
                    url: 'https://example.com/header.jpg',
                },
                summary: 'Test user',
            }

            const mockUser = {
                id: 'user_123',
                username: 'alice@example.com',
                name: 'Alice Smith',
                isRemote: true,
                externalActorUrl: 'https://example.com/users/alice',
            }

            vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as any)

            const result = await cacheRemoteUser(mockActor as unknown as Person)
            expect(result).toEqual(mockUser)
            expect(prisma.user.upsert).toHaveBeenCalledWith({
                where: { externalActorUrl: 'https://example.com/users/alice' },
                update: {
                    name: 'Alice Smith',
                    publicKey: '-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----',
                    inboxUrl: 'https://example.com/users/alice/inbox',
                    sharedInboxUrl: 'https://example.com/inbox',
                    profileImage: 'https://example.com/avatar.jpg',
                    headerImage: 'https://example.com/header.jpg',
                    bio: 'Test user',
                    displayColor: '#3b82f6',
                },
                create: {
                    username: 'alice@example.com',
                    name: 'Alice Smith',
                    externalActorUrl: 'https://example.com/users/alice',
                    isRemote: true,
                    publicKey: '-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----',
                    inboxUrl: 'https://example.com/users/alice/inbox',
                    sharedInboxUrl: 'https://example.com/inbox',
                    profileImage: 'https://example.com/avatar.jpg',
                    headerImage: 'https://example.com/header.jpg',
                    bio: 'Test user',
                    displayColor: '#3b82f6',
                },
            })
        })

        it('should handle actor without optional fields', async () => {
            const mockActor = {
                type: 'Person',
                id: 'https://example.com/users/bob',
                preferredUsername: 'bob',
                inbox: 'https://example.com/users/bob/inbox',
                outbox: 'https://example.com/users/bob/outbox',
            }

            const mockUser = {
                id: 'user_456',
                username: 'bob@example.com',
                name: 'bob',
                isRemote: true,
            }

            vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as any)

            const result = await cacheRemoteUser(mockActor as unknown as Person)
            expect(result).toEqual(mockUser)
            expect(prisma.user.upsert).toHaveBeenCalledWith({
                where: { externalActorUrl: 'https://example.com/users/bob' },
                update: {
                    name: 'bob',
                    publicKey: null,
                    inboxUrl: undefined,
                    sharedInboxUrl: null,
                    profileImage: null,
                    headerImage: null,
                    bio: null,
                    displayColor: '#3b82f6',
                },
                create: {
                    username: 'bob@example.com',
                    name: 'bob',
                    externalActorUrl: 'https://example.com/users/bob',
                    isRemote: true,
                    publicKey: null,
                    inboxUrl: undefined,
                    sharedInboxUrl: null,
                    profileImage: null,
                    headerImage: null,
                    bio: null,
                    displayColor: '#3b82f6',
                },
            })
        })

        it('should extract username from URL when preferredUsername is missing', async () => {
            const mockActor = {
                type: 'Person',
                id: 'https://example.com/users/charlie',
                preferredUsername: 'charlie',
                inbox: 'https://example.com/users/charlie/inbox',
                outbox: 'https://example.com/users/charlie/outbox',
            }

            const mockUser = {
                id: 'user_789',
                username: 'charlie@example.com',
            }

            vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as any)

            await cacheRemoteUser(mockActor as unknown as Person)
            expect(prisma.user.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    create: expect.objectContaining({
                        username: 'charlie@example.com',
                    }),
                })
            )
        })
    })

    describe('createOrderedCollection', () => {
        it('should create an ordered collection with items', () => {
            const items = [{ id: '1' }, { id: '2' }]
            const result = createOrderedCollection('https://example.com/collection', items)

            expect(result).toEqual({
                '@context': expect.any(Array),
                id: 'https://example.com/collection',
                type: 'OrderedCollection',
                totalItems: 2,
                orderedItems: items,
            })
        })

        it('should use provided totalItems when given', () => {
            const items = [{ id: '1' }]
            const result = createOrderedCollection('https://example.com/collection', items, 100)

            expect(result.totalItems).toBe(100)
        })
    })

    describe('createOrderedCollectionPage', () => {
        it('should create an ordered collection page', () => {
            const items = [{ id: '1' }, { id: '2' }]
            const result = createOrderedCollectionPage(
                'https://example.com/collection/page1',
                items,
                'https://example.com/collection'
            )

            expect(result).toEqual({
                '@context': expect.any(Array),
                id: 'https://example.com/collection/page1',
                type: 'OrderedCollectionPage',
                partOf: 'https://example.com/collection',
                orderedItems: items,
            })
        })

        it('should include next link when provided', () => {
            const items = [{ id: '1' }]
            const result = createOrderedCollectionPage(
                'https://example.com/collection/page1',
                items,
                'https://example.com/collection',
                'https://example.com/collection/page2'
            )

            expect(result.next).toBe('https://example.com/collection/page2')
        })

        it('should include prev link when provided', () => {
            const items = [{ id: '1' }]
            const result = createOrderedCollectionPage(
                'https://example.com/collection/page2',
                items,
                'https://example.com/collection',
                undefined,
                'https://example.com/collection/page1'
            )

            expect(result.prev).toBe('https://example.com/collection/page1')
        })
    })

    describe('parseActivityId', () => {
        it('should parse a valid ActivityPub ID', () => {
            const result = parseActivityId('https://example.com/activities/123')
            expect(result).toEqual({
                domain: 'example.com',
                path: '/activities/123',
                protocol: 'https:',
            })
        })

        it('should return null for invalid URL', () => {
            const result = parseActivityId('not-a-url')
            expect(result).toBeNull()
        })

        it('should handle http URLs', () => {
            const result = parseActivityId('http://localhost:3000/activities/123')
            expect(result).toEqual({
                domain: 'localhost',
                path: '/activities/123',
                protocol: 'http:',
            })
        })
    })

    describe('isActivityProcessed', () => {
        it('should return true when activity is processed', async () => {
            vi.mocked(prisma.processedActivity.findUnique).mockResolvedValue({
                id: '1',
                activityId: 'https://example.com/activities/123',
                expiresAt: new Date(),
            } as any)

            const result = await isActivityProcessed('https://example.com/activities/123')
            expect(result).toBe(true)
            expect(prisma.processedActivity.findUnique).toHaveBeenCalledWith({
                where: { activityId: 'https://example.com/activities/123' },
            })
        })

        it('should return false when activity is not processed', async () => {
            vi.mocked(prisma.processedActivity.findUnique).mockResolvedValue(null)

            const result = await isActivityProcessed('https://example.com/activities/123')
            expect(result).toBe(false)
        })
    })

    describe('markActivityProcessed', () => {
        it('should mark an activity as processed', async () => {
            vi.mocked(prisma.processedActivity.create).mockResolvedValue({
                id: '1',
                activityId: 'https://example.com/activities/123',
                expiresAt: new Date(),
            } as any)

            await markActivityProcessed('https://example.com/activities/123')
            expect(prisma.processedActivity.create).toHaveBeenCalledWith({
                data: {
                    activityId: 'https://example.com/activities/123',
                    expiresAt: expect.any(Date),
                },
            })
        })

        it('should set expiration to 30 days in the future', async () => {
            const now = new Date()
            vi.mocked(prisma.processedActivity.create).mockResolvedValue({} as any)

            await markActivityProcessed('https://example.com/activities/123')
            const call = vi.mocked(prisma.processedActivity.create).mock.calls[0][0]
            const expiresAt = call.data.expiresAt as Date
            const daysDiff = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            expect(daysDiff).toBeCloseTo(30, 0)
        })
    })

    describe('cleanupProcessedActivities', () => {
        it('should delete expired processed activities', async () => {
            vi.mocked(prisma.processedActivity.deleteMany).mockResolvedValue({ count: 5 } as any)

            await cleanupProcessedActivities()
            expect(prisma.processedActivity.deleteMany).toHaveBeenCalledWith({
                where: {
                    expiresAt: {
                        lt: expect.any(Date),
                    },
                },
            })
        })
    })

    describe('isUserBlocked', () => {
        it('should return true when user is blocked', async () => {
            vi.mocked(prisma.blockedUser.findUnique).mockResolvedValue({
                blockingUserId: 'user1',
                blockedUserId: 'user2',
            } as any)

            const result = await isUserBlocked('user1', 'user2')
            expect(result).toBe(true)
            expect(prisma.blockedUser.findUnique).toHaveBeenCalledWith({
                where: {
                    blockingUserId_blockedUserId: {
                        blockingUserId: 'user1',
                        blockedUserId: 'user2',
                    },
                },
            })
        })

        it('should return false when user is not blocked', async () => {
            vi.mocked(prisma.blockedUser.findUnique).mockResolvedValue(null)

            const result = await isUserBlocked('user1', 'user2')
            expect(result).toBe(false)
        })
    })

    describe('isDomainBlocked', () => {
        it('should return true when domain is blocked', async () => {
            vi.mocked(prisma.blockedDomain.findUnique).mockResolvedValue({
                domain: 'spam.com',
            } as any)

            const result = await isDomainBlocked('spam.com')
            expect(result).toBe(true)
            expect(prisma.blockedDomain.findUnique).toHaveBeenCalledWith({
                where: { domain: 'spam.com' },
            })
        })

        it('should return false when domain is not blocked', async () => {
            vi.mocked(prisma.blockedDomain.findUnique).mockResolvedValue(null)

            const result = await isDomainBlocked('example.com')
            expect(result).toBe(false)
        })
    })
})

