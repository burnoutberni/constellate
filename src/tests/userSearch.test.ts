import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import userSearchApp from '../userSearch.js'
import { prisma } from '../lib/prisma.js'
import { resolveWebFinger, fetchActor, cacheRemoteUser, getBaseUrl } from '../lib/activitypubHelpers.js'

// Mock dependencies
vi.mock('../lib/prisma.js', () => ({
    prisma: {
        user: {
            findMany: vi.fn(),
            findFirst: vi.fn(),
            findUnique: vi.fn(),
        },
        event: {
            findMany: vi.fn(),
            count: vi.fn(),
            upsert: vi.fn(),
        },
    },
}))

vi.mock('../lib/activitypubHelpers.js', () => ({
    resolveWebFinger: vi.fn(),
    fetchActor: vi.fn(),
    cacheRemoteUser: vi.fn(),
    getBaseUrl: vi.fn(() => 'http://localhost:3000'),
}))

vi.mock('../lib/ssrfProtection.js', () => ({
    safeFetch: vi.fn(),
}))

// Create test app
const app = new Hono()
app.route('/api/user-search', userSearchApp)

// Mock global fetch for remote outbox fetching
global.fetch = vi.fn()

describe('UserSearch API', () => {
    const mockLocalUser = {
        id: 'user_123',
        username: 'alice',
        name: 'Alice Smith',
        profileImage: null,
        displayColor: '#3b82f6',
        isRemote: false,
        externalActorUrl: null,
    }

    const mockRemoteUser = {
        id: 'user_456',
        username: 'bob@example.com',
        name: 'Bob',
        profileImage: null,
        displayColor: '#ef4444',
        isRemote: true,
        externalActorUrl: 'https://example.com/users/bob',
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('GET /', () => {
        it('should search for local users and events', async () => {
            const mockUsers = [mockLocalUser]
            const mockEvents = [
                {
                    id: 'event_123',
                    title: 'Test Event',
                    summary: 'Test summary',
                    startTime: new Date('2024-12-01T10:00:00Z'),
                    user: mockLocalUser,
                    _count: {
                        attendance: 5,
                        likes: 10,
                    },
                },
            ]

            vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any)
            vi.mocked(prisma.event.findMany).mockResolvedValue(mockEvents as any)

            const res = await app.request('/api/user-search?q=alice')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.users).toEqual(mockUsers)
            // Date fields are serialized to ISO strings in JSON responses
            expect(body.events).toHaveLength(1)
            expect(body.events[0].id).toBe('event_123')
            expect(body.events[0].title).toBe('Test Event')
            expect(body.events[0].startTime).toBe('2024-12-01T10:00:00.000Z')
            expect(body.events[0].user).toEqual(mockLocalUser)
            expect(body.events[0]._count).toEqual({ attendance: 5, likes: 10 })
            expect(prisma.user.findMany).toHaveBeenCalledWith({
                where: {
                    OR: [
                        { username: { contains: 'alice' } },
                        { name: { contains: 'alice' } },
                    ],
                },
                select: expect.any(Object),
                take: 10,
            })
        })


        it('should cap limit at 50', async () => {
            vi.mocked(prisma.user.findMany).mockResolvedValue([])
            vi.mocked(prisma.event.findMany).mockResolvedValue([])

            await app.request('/api/user-search?q=test&limit=100')

            expect(prisma.user.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    take: 50,
                })
            )
        })

        it('should suggest remote account when handle format detected', async () => {
            vi.mocked(prisma.user.findMany).mockResolvedValue([])
            vi.mocked(prisma.event.findMany).mockResolvedValue([])
            vi.mocked(prisma.user.findFirst).mockResolvedValue(null) // Not cached

            const res = await app.request('/api/user-search?q=@bob@example.com')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.remoteAccountSuggestion).toEqual({
                handle: '@bob@example.com',
                username: 'bob',
                domain: 'example.com',
            })
        })

        it('should include cached remote user in results', async () => {
            vi.mocked(prisma.user.findMany).mockResolvedValue([])
            vi.mocked(prisma.event.findMany).mockResolvedValue([])
            vi.mocked(prisma.user.findFirst).mockResolvedValue(mockRemoteUser as any)

            const res = await app.request('/api/user-search?q=@bob@example.com')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.users).toContainEqual(mockRemoteUser)
            expect(body.remoteAccountSuggestion).toBeNull()
        })

        it('should return 400 for missing query parameter', async () => {
            const res = await app.request('/api/user-search')

            expect(res.status).toBe(400)
            const body = await res.json() as any as any
            expect(body.error).toBe('Invalid search parameters')
        })

        it('should return 400 for empty query', async () => {
            const res = await app.request('/api/user-search?q=')

            expect(res.status).toBe(400)
        })

        it('should handle parseHandle with various formats', async () => {
            vi.mocked(prisma.user.findMany).mockResolvedValue([])
            vi.mocked(prisma.event.findMany).mockResolvedValue([])
            vi.mocked(prisma.user.findFirst).mockResolvedValue(null)

            // Test @username@domain format
            await app.request('/api/user-search?q=@alice@example.com')
            expect(prisma.user.findFirst).toHaveBeenCalled()

            vi.clearAllMocks()
            vi.mocked(prisma.user.findMany).mockResolvedValue([])
            vi.mocked(prisma.event.findMany).mockResolvedValue([])
            vi.mocked(prisma.user.findFirst).mockResolvedValue(null)

            // Test username@domain format
            await app.request('/api/user-search?q=alice@example.com')
            expect(prisma.user.findFirst).toHaveBeenCalled()

            vi.clearAllMocks()
            vi.mocked(prisma.user.findMany).mockResolvedValue([])
            vi.mocked(prisma.event.findMany).mockResolvedValue([])
            vi.mocked(prisma.user.findFirst).mockResolvedValue(null)

            // Test URL format
            await app.request('/api/user-search?q=https://example.com/users/alice')
            expect(prisma.user.findFirst).toHaveBeenCalled()
        })
    })

    describe('POST /resolve', () => {
        it('should resolve and cache a remote account', async () => {
            const mockActor = {
                id: 'https://example.com/users/bob',
                type: 'Person',
                preferredUsername: 'bob',
                name: 'Bob',
            }

            const cachedUser = {
                id: 'user_456',
                username: 'bob@example.com',
                name: 'Bob',
                profileImage: null,
                displayColor: '#3b82f6',
                isRemote: true,
                externalActorUrl: 'https://example.com/users/bob',
            }

            vi.mocked(resolveWebFinger).mockResolvedValue('https://example.com/users/bob')
            vi.mocked(fetchActor).mockResolvedValue(mockActor)
            vi.mocked(cacheRemoteUser).mockResolvedValue(cachedUser as any)

            const res = await app.request('/api/user-search/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ handle: '@bob@example.com' }),
            })

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.user).toEqual(cachedUser)
            expect(resolveWebFinger).toHaveBeenCalledWith('acct:bob@example.com')
            expect(fetchActor).toHaveBeenCalledWith('https://example.com/users/bob')
            expect(cacheRemoteUser).toHaveBeenCalledWith(mockActor)
        })

        it('should return local user when handle is local', async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValue(mockLocalUser as any)

            const res = await app.request('/api/user-search/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ handle: '@alice@localhost' }),
            })

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.user).toEqual(mockLocalUser)
            expect(resolveWebFinger).not.toHaveBeenCalled()
        })

        it('should return cached remote user if already cached', async () => {
            vi.mocked(prisma.user.findFirst).mockResolvedValue(mockRemoteUser as any)

            const res = await app.request('/api/user-search/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ handle: '@bob@example.com' }),
            })

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.user).toEqual(mockRemoteUser)
            expect(resolveWebFinger).not.toHaveBeenCalled()
        })

        it('should return 404 when WebFinger resolution fails', async () => {
            vi.mocked(prisma.user.findFirst).mockResolvedValue(null)
            vi.mocked(resolveWebFinger).mockResolvedValue(null)

            const res = await app.request('/api/user-search/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ handle: '@nonexistent@example.com' }),
            })

            expect(res.status).toBe(404)
            const body = await res.json() as any as any
            expect(body.error).toBe('Failed to resolve account via WebFinger')
        })

        it('should return 404 when actor fetch fails', async () => {
            vi.mocked(prisma.user.findFirst).mockResolvedValue(null)
            vi.mocked(resolveWebFinger).mockResolvedValue('https://example.com/users/bob')
            vi.mocked(fetchActor).mockResolvedValue(null)

            const res = await app.request('/api/user-search/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ handle: '@bob@example.com' }),
            })

            expect(res.status).toBe(404)
            const body = await res.json() as any as any
            expect(body.error).toBe('Failed to fetch actor')
        })

        it('should return 400 for invalid handle format', async () => {
            const res = await app.request('/api/user-search/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ handle: 'invalid-format' }),
            })

            expect(res.status).toBe(400)
            const body = await res.json() as any as any
            expect(body.error).toBe('Invalid handle format')
        })

        it('should return 400 for missing handle', async () => {
            const res = await app.request('/api/user-search/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            })

            expect(res.status).toBe(400)
        })
    })

    describe('GET /profile/:username', () => {

        it('should resolve and cache remote user if not found', async () => {
            const mockActor = {
                id: 'https://example.com/users/bob',
                type: 'Person',
                preferredUsername: 'bob',
                name: 'Bob',
            }

            const cachedUser = {
                id: 'user_456',
                username: 'bob@example.com',
                name: 'Bob',
                bio: null,
                profileImage: null,
                headerImage: null,
                displayColor: '#3b82f6',
                isRemote: true,
                externalActorUrl: 'https://example.com/users/bob',
                createdAt: new Date('2024-01-01'),
                _count: {
                    followers: 0,
                    following: 0,
                },
            }

            vi.mocked(prisma.user.findFirst)
                .mockResolvedValueOnce(null) // First call - not found
                .mockResolvedValueOnce(cachedUser as any) // After caching
            vi.mocked(resolveWebFinger).mockResolvedValue('https://example.com/users/bob')
            vi.mocked(fetchActor).mockResolvedValue(mockActor)
            vi.mocked(cacheRemoteUser).mockResolvedValue(cachedUser as any)
            vi.mocked(prisma.event.findMany).mockResolvedValue([])
            vi.mocked(prisma.event.count).mockResolvedValue(0)

            const res = await app.request('/api/user-search/profile/bob@example.com')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.user.username).toBe('bob@example.com')
            expect(resolveWebFinger).toHaveBeenCalled()
            expect(fetchActor).toHaveBeenCalled()
            expect(cacheRemoteUser).toHaveBeenCalled()
        })

        it('should fetch and cache events from remote outbox', async () => {
            const mockUserWithCount = {
                ...mockRemoteUser,
                bio: null,
                headerImage: null,
                createdAt: new Date('2024-01-01'),
                _count: {
                    followers: 0,
                    following: 0,
                },
            }

            const mockOutbox = {
                orderedItems: [
                    {
                        type: 'Create',
                        object: {
                            type: 'Event',
                            id: 'https://example.com/events/1',
                            name: 'Remote Event',
                            startTime: '2024-12-01T10:00:00Z',
                        },
                    },
                ],
            }

            vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUserWithCount as any)
            vi.mocked(prisma.event.findMany)
                .mockResolvedValueOnce([]) // First call - no events
                .mockResolvedValueOnce([
                    {
                        id: 'event_remote_1',
                        title: 'Remote Event',
                        user: null,
                        _count: {
                            attendance: 0,
                            likes: 0,
                            comments: 0,
                        },
                    },
                ] as any) // After caching
            vi.mocked(prisma.event.count).mockResolvedValue(1)
            vi.mocked(prisma.event.upsert).mockResolvedValue({} as any)
            vi.mocked(global.fetch).mockResolvedValue({
                ok: true,
                json: async () => mockOutbox,
            } as Response)

            const res = await app.request('/api/user-search/profile/bob@example.com')

            expect(res.status).toBe(200)
            expect(global.fetch).toHaveBeenCalledWith(
                'https://example.com/users/bob/outbox?page=1',
                expect.objectContaining({
                    headers: {
                        Accept: 'application/activity+json',
                    },
                })
            )
            expect(prisma.event.upsert).toHaveBeenCalled()
        })

        it('should return 404 when user not found', async () => {
            vi.mocked(prisma.user.findFirst).mockResolvedValue(null)
            vi.mocked(resolveWebFinger).mockResolvedValue(null)

            const res = await app.request('/api/user-search/profile/nonexistent')

            expect(res.status).toBe(404)
            const body = await res.json() as any as any
            expect(body.error).toBe('User not found')
        })

        it('should handle URL-encoded usernames', async () => {
            const mockUserWithCount = {
                ...mockRemoteUser,
                bio: null,
                headerImage: null,
                createdAt: new Date('2024-01-01'),
                _count: {
                    followers: 0,
                    following: 0,
                },
            }

            vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUserWithCount as any)
            vi.mocked(prisma.event.findMany).mockResolvedValue([])
            vi.mocked(prisma.event.count).mockResolvedValue(0)

            const res = await app.request('/api/user-search/profile/bob%40example.com')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.user.username).toBe('bob@example.com')
        })

        it('should handle error when fetching remote outbox fails', async () => {
            const mockUserWithCount = {
                ...mockRemoteUser,
                bio: null,
                headerImage: null,
                createdAt: new Date('2024-01-01'),
                _count: {
                    followers: 0,
                    following: 0,
                },
            }

            vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUserWithCount as any)
            vi.mocked(prisma.event.findMany).mockResolvedValueOnce([]) // No cached events
            vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'))

            const res = await app.request('/api/user-search/profile/bob@example.com')

            // Should still return user profile even if outbox fetch fails
            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.user.username).toBe('bob@example.com')
            expect(body.events).toEqual([])
        })

        it('should handle invalid outbox response', async () => {
            const mockUserWithCount = {
                ...mockRemoteUser,
                bio: null,
                headerImage: null,
                createdAt: new Date('2024-01-01'),
                _count: {
                    followers: 0,
                    following: 0,
                },
            }

            vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUserWithCount as any)
            vi.mocked(prisma.event.findMany).mockResolvedValueOnce([])
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ invalid: 'data' }), // Invalid outbox format
            } as Response)

            const res = await app.request('/api/user-search/profile/bob@example.com')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.user.username).toBe('bob@example.com')
        })

        it('should handle outbox with non-Create activities', async () => {
            const mockUserWithCount = {
                ...mockRemoteUser,
                bio: null,
                headerImage: null,
                createdAt: new Date('2024-01-01'),
                _count: {
                    followers: 0,
                    following: 0,
                },
            }

            const mockOutbox = {
                orderedItems: [
                    {
                        type: 'Like', // Not a Create activity
                        object: {
                            type: 'Event',
                        },
                    },
                ],
            }

            vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUserWithCount as any)
            vi.mocked(prisma.event.findMany).mockResolvedValueOnce([])
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => mockOutbox,
            } as Response)

            const res = await app.request('/api/user-search/profile/bob@example.com')

            expect(res.status).toBe(200)
            // Should not create events from non-Create activities
            expect(prisma.event.upsert).not.toHaveBeenCalled()
        })

        it('should handle error when getting profile fails', async () => {
            vi.mocked(prisma.user.findFirst).mockRejectedValueOnce(new Error('Database error'))

            const res = await app.request('/api/user-search/profile/alice')

            expect(res.status).toBe(500)
            const body = await res.json() as any as any
            expect(body.error).toBe('Internal server error')
        })
    })

    describe('Handle parsing edge cases', () => {
        beforeEach(() => {
            vi.mocked(prisma.user.findMany).mockResolvedValue([])
            vi.mocked(prisma.event.findMany).mockResolvedValue([])
            vi.mocked(prisma.user.findFirst).mockResolvedValue(null)
        })

        it('should parse handle with domain/@username format', async () => {
            await app.request('/api/user-search?q=example.com/@bob')

            expect(prisma.user.findFirst).toHaveBeenCalled()
        })

        it('should parse handle from URL with /users/username pattern', async () => {
            await app.request('/api/user-search?q=https://example.com/users/bob')

            expect(prisma.user.findFirst).toHaveBeenCalled()
        })

        it('should parse handle from URL with /@username pattern', async () => {
            await app.request('/api/user-search?q=https://example.com/@bob')

            expect(prisma.user.findFirst).toHaveBeenCalled()
        })

        it('should parse handle from URL using last path segment', async () => {
            await app.request('/api/user-search?q=https://example.com/some/path/bob')

            expect(prisma.user.findFirst).toHaveBeenCalled()
        })

        it('should handle invalid URL format gracefully', async () => {
            const res = await app.request('/api/user-search?q=not-a-valid-url-format')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.remoteAccountSuggestion).toBeNull()
        })

        it('should handle empty query gracefully', async () => {
            const res = await app.request('/api/user-search?q=')

            expect(res.status).toBe(400)
        })
    })

    describe('Search with various query formats', () => {
        it('should search by username', async () => {
            const mockUsers = [mockLocalUser]
            vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any)
            vi.mocked(prisma.event.findMany).mockResolvedValue([])

            const res = await app.request('/api/user-search?q=alice')

            expect(res.status).toBe(200)
            expect(prisma.user.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        OR: [
                            { username: { contains: 'alice' } },
                            { name: { contains: 'alice' } },
                        ],
                    },
                })
            )
        })

        it('should search by name', async () => {
            const mockUsers = [{ ...mockLocalUser, name: 'Alice Smith' }]
            vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any)
            vi.mocked(prisma.event.findMany).mockResolvedValue([])

            const res = await app.request('/api/user-search?q=Smith')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.users.length).toBeGreaterThan(0)
        })

        it('should search events by title', async () => {
            const mockEvents = [
                {
                    id: 'event_123',
                    title: 'Test Event',
                    summary: 'Test summary',
                    startTime: new Date('2024-12-01T10:00:00Z'),
                    user: mockLocalUser,
                    _count: {
                        attendance: 5,
                        likes: 10,
                    },
                },
            ]
            vi.mocked(prisma.user.findMany).mockResolvedValue([])
            vi.mocked(prisma.event.findMany).mockResolvedValue(mockEvents as any)

            const res = await app.request('/api/user-search?q=Test')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.events.length).toBeGreaterThan(0)
            expect(body.events[0].title).toBe('Test Event')
        })

        it('should search events by summary', async () => {
            const mockEvents = [
                {
                    id: 'event_123',
                    title: 'Event',
                    summary: 'Detailed description',
                    startTime: new Date('2024-12-01T10:00:00Z'),
                    user: mockLocalUser,
                    _count: {
                        attendance: 5,
                        likes: 10,
                    },
                },
            ]
            vi.mocked(prisma.user.findMany).mockResolvedValue([])
            vi.mocked(prisma.event.findMany).mockResolvedValue(mockEvents as any)

            const res = await app.request('/api/user-search?q=Detailed')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.events.length).toBeGreaterThan(0)
        })
    })

    describe('Error handling', () => {
        it('should handle error when search fails', async () => {
            vi.mocked(prisma.user.findMany).mockRejectedValueOnce(new Error('Database error'))

            const res = await app.request('/api/user-search?q=test')

            expect(res.status).toBe(500)
            const body = await res.json() as any as any
            expect(body.error).toBe('Internal server error')
        })

        it('should handle error when resolve fails', async () => {
            vi.mocked(prisma.user.findFirst).mockRejectedValueOnce(new Error('Database error'))

            const res = await app.request('/api/user-search/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ handle: '@bob@example.com' }),
            })

            expect(res.status).toBe(500)
            const body = await res.json() as any as any
            expect(body.error).toBe('Internal server error')
        })

        it('should handle WebFinger resolution timeout', async () => {
            vi.mocked(prisma.user.findFirst).mockResolvedValue(null)
            vi.mocked(resolveWebFinger).mockImplementation(() => 
                new Promise((resolve) => setTimeout(() => resolve(null), 100))
            )

            // This test verifies the code handles null resolution gracefully
            // In a real scenario, this would timeout, but we're testing the null case
            const res = await app.request('/api/user-search/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ handle: '@bob@example.com' }),
            })

            expect(res.status).toBe(404)
            const body = await res.json() as any as any
            expect(body.error).toBe('Failed to resolve account via WebFinger')
        })

        it('should handle actor fetch failure', async () => {
            vi.mocked(prisma.user.findFirst).mockResolvedValue(null)
            vi.mocked(resolveWebFinger).mockResolvedValue('https://example.com/users/bob')
            vi.mocked(fetchActor).mockResolvedValue(null)

            const res = await app.request('/api/user-search/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ handle: '@bob@example.com' }),
            })

            expect(res.status).toBe(404)
            const body = await res.json() as any as any
            expect(body.error).toBe('Failed to fetch actor')
        })
    })

    describe('POST /resolve', () => {


        it('should resolve remote user from cache', async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
            vi.mocked(prisma.user.findFirst).mockResolvedValue(mockRemoteUser as any)

            const res = await app.request('/api/user-search/resolve', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    handle: 'bob@example.com',
                }),
            })

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.user).toEqual(mockRemoteUser)
        })

        it('should resolve remote user via WebFinger', async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
            vi.mocked(prisma.user.findFirst).mockResolvedValue(null)
            vi.mocked(resolveWebFinger).mockResolvedValue('https://example.com/users/bob')
            vi.mocked(fetchActor).mockResolvedValue({
                id: 'https://example.com/users/bob',
                type: 'Person',
                preferredUsername: 'bob',
                name: 'Bob',
            } as any)
            vi.mocked(cacheRemoteUser).mockResolvedValue(mockRemoteUser as any)

            const res = await app.request('/api/user-search/resolve', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    handle: 'bob@example.com',
                }),
            })

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.user).toBeDefined()
        })

        it('should return 404 when WebFinger resolution fails', async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
            vi.mocked(prisma.user.findFirst).mockResolvedValue(null)
            vi.mocked(resolveWebFinger).mockResolvedValue(null)

            const res = await app.request('/api/user-search/resolve', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    handle: 'nonexistent@example.com',
                }),
            })

            expect(res.status).toBe(404)
            const body = await res.json() as any as any
            expect(body.error).toBe('Failed to resolve account via WebFinger')
        })

        it('should return 404 when actor fetch fails', async () => {
            vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
            vi.mocked(prisma.user.findFirst).mockResolvedValue(null)
            vi.mocked(resolveWebFinger).mockResolvedValue('https://example.com/users/bob')
            vi.mocked(fetchActor).mockResolvedValue(null)

            const res = await app.request('/api/user-search/resolve', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    handle: 'bob@example.com',
                }),
            })

            expect(res.status).toBe(404)
            const body = await res.json() as any as any
            expect(body.error).toBe('Failed to fetch actor')
        })

        it('should handle parseHandle errors', async () => {
            const res = await app.request('/api/user-search/resolve', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    handle: '', // Invalid handle
                }),
            })

            expect(res.status).toBe(400)
        })
    })

    describe('GET /profile/:username/followers', () => {



        it('should return 404 when user not found', async () => {
            vi.mocked(prisma.user.findFirst).mockResolvedValue(null)

            const res = await app.request('/api/user-search/profile/nonexistent/followers')

            expect(res.status).toBe(404)
            const body = await res.json() as any as any
            expect(body.error).toBe('User not found')
        })

    })
})

