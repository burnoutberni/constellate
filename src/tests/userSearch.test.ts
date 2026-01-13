import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import userSearchApp from '../userSearch.js'
import { prisma } from '../lib/prisma.js'
import {
	fetchActor,
	cacheRemoteUser,
	cacheRemoteUserByUrl,
	getBaseUrl,
	cacheEventFromOutboxActivity,
	fetchRemoteCollectionCount,
	fetchRemoteCollectionItems,
} from '../lib/activitypubHelpers.js'
import { resolveWebFinger } from '../lib/webfinger.js'
import * as eventVisibility from '../lib/eventVisibility.js'
import * as authModule from '../auth.js'
import { safeFetch } from '../lib/ssrfProtection.js'
import { ContentType } from '../constants/activitypub.js'

vi.mock('../lib/prisma.js', () => ({
	prisma: {
		user: {
			findMany: vi.fn(),
			findFirst: vi.fn(),
			findUnique: vi.fn(),
			update: vi.fn(() => Promise.resolve({})),
		},
		event: {
			findMany: vi.fn(),
			count: vi.fn(),
			upsert: vi.fn(),
		},
		follower: {
			count: vi.fn(),
			findMany: vi.fn(),
		},
		following: {
			count: vi.fn(),
			findFirst: vi.fn(),
			findMany: vi.fn(),
			findUnique: vi.fn(),
		},
	},
}))

vi.mock('../lib/activitypubHelpers.js', () => ({
	fetchActor: vi.fn(),
	cacheRemoteUser: vi.fn(),
	cacheRemoteUserByUrl: vi.fn(),
	getBaseUrl: vi.fn(() => 'http://localhost:3000'),
	cacheEventFromOutboxActivity: vi.fn(() => Promise.resolve()),
	fetchRemoteCollectionCount: vi.fn(() => Promise.resolve(null)),
	fetchRemoteCollectionItems: vi.fn(() => Promise.resolve([])),
}))

vi.mock('../lib/webfinger.js', () => ({
	resolveWebFinger: vi.fn(),
}))

vi.mock('../lib/ssrfProtection.js', () => ({
	safeFetch: vi.fn(),
}))

vi.mock('../lib/instanceHelpers.js', () => ({
	trackInstance: vi.fn(),
}))

vi.mock('../lib/eventVisibility.js', () => ({
	canUserViewEvent: vi.fn(),
}))

vi.mock('../auth.js', () => ({
	auth: {
		api: {
			getSession: vi.fn(),
		},
	},
}))

const app = new Hono()

app.use('*', async (c, next) => {
	const session = await authModule.auth.api.getSession({
		headers: c.req.raw.headers,
	})
	if (session) {
		c.set('userId', session.user.id)
	}
	await next()
})

app.route('/api/user-search', userSearchApp)

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
			const body = (await res.json()) as any as any
			expect(body.users).toEqual(mockUsers)
			expect(body.events).toHaveLength(1)
			expect(body.events[0].id).toBe('event_123')
			expect(body.events[0].title).toBe('Test Event')
			expect(body.events[0].startTime).toBe('2024-12-01T10:00:00.000Z')
			expect(body.events[0].user).toEqual(mockLocalUser)
			expect(body.events[0]._count).toEqual({ attendance: 5, likes: 10 })
			expect(prisma.user.findMany).toHaveBeenCalledWith({
				where: {
					OR: [{ username: { contains: 'alice' } }, { name: { contains: 'alice' } }],
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
			vi.mocked(prisma.user.findFirst).mockResolvedValue(null)

			const res = await app.request('/api/user-search?q=@bob@example.com')

			expect(res.status).toBe(200)
			const body = (await res.json()) as any as any
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
			const body = (await res.json()) as any as any
			expect(body.users).toContainEqual(mockRemoteUser)
			expect(body.remoteAccountSuggestion).toBeNull()
		})

		it('should return 400 for missing query parameter', async () => {
			const res = await app.request('/api/user-search')

			expect(res.status).toBe(400)
			const body = (await res.json()) as any as any
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

			await app.request('/api/user-search?q=@alice@example.com')
			expect(prisma.user.findFirst).toHaveBeenCalled()

			vi.clearAllMocks()
			vi.mocked(prisma.user.findMany).mockResolvedValue([])
			vi.mocked(prisma.event.findMany).mockResolvedValue([])
			vi.mocked(prisma.user.findFirst).mockResolvedValue(null)

			await app.request('/api/user-search?q=alice@example.com')
			expect(prisma.user.findFirst).toHaveBeenCalled()

			vi.clearAllMocks()
			vi.mocked(prisma.user.findMany).mockResolvedValue([])
			vi.mocked(prisma.event.findMany).mockResolvedValue([])
			vi.mocked(prisma.user.findFirst).mockResolvedValue(null)

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
			const body = (await res.json()) as any as any
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
			const body = (await res.json()) as any as any
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
			const body = (await res.json()) as any as any
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
			const body = (await res.json()) as any as any
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
			const body = (await res.json()) as any as any
			expect(body.error).toBe('Failed to fetch actor')
		})

		it('should return 400 for invalid handle format', async () => {
			const res = await app.request('/api/user-search/resolve', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ handle: 'invalid-format' }),
			})

			expect(res.status).toBe(400)
			const body = (await res.json()) as any as any
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

		it('should return local user not found error', async () => {
			vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

			const res = await app.request('/api/user-search/resolve', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ handle: '@nonexistent@localhost' }),
			})

			expect(res.status).toBe(404)
			const body = (await res.json()) as any
			expect(body.error).toBe('Local user not found')
		})

		it('should handle cacheRemoteUser errors', async () => {
			vi.mocked(prisma.user.findFirst).mockResolvedValue(null)
			vi.mocked(resolveWebFinger).mockResolvedValue('https://example.com/users/bob')
			vi.mocked(fetchActor).mockResolvedValue({
				id: 'https://example.com/users/bob',
				type: 'Person',
				preferredUsername: 'bob',
				name: 'Bob',
			})
			vi.mocked(cacheRemoteUser).mockRejectedValue(new Error('Cache error'))

			const res = await app.request('/api/user-search/resolve', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ handle: '@bob@example.com' }),
			})

			expect(res.status).toBe(500)
		})

		it('should handle invalid JSON body', async () => {
			const res = await app.request('/api/user-search/resolve', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: 'invalid json',
			})

			expect(res.status).toBe(500)
		})

		it('should handle null body', async () => {
			const res = await app.request('/api/user-search/resolve', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(null),
			})

			expect(res.status).toBe(400)
		})

		it('should handle non-string handle', async () => {
			const res = await app.request('/api/user-search/resolve', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ handle: 123 }),
			})

			expect(res.status).toBe(400)
		})

		it('should handle whitespace-only handle', async () => {
			const res = await app.request('/api/user-search/resolve', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ handle: '   ' }),
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
				.mockResolvedValueOnce(null)
				.mockResolvedValueOnce(cachedUser as any)
			vi.mocked(resolveWebFinger).mockResolvedValue('https://example.com/users/bob')
			vi.mocked(fetchActor).mockResolvedValue(mockActor)
			vi.mocked(cacheRemoteUser).mockResolvedValue(cachedUser as any)
			vi.mocked(prisma.event.findMany).mockResolvedValue([])
			vi.mocked(prisma.event.count).mockResolvedValue(0)

			const res = await app.request('/api/user-search/profile/bob@example.com')

			expect(res.status).toBe(200)
			const body = (await res.json()) as any as any
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
				isPublicProfile: true,
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
			vi.mocked(prisma.event.findMany).mockResolvedValue([])
			vi.mocked(prisma.event.count).mockResolvedValue(1)
			vi.mocked(prisma.event.upsert).mockResolvedValue({} as any)

			vi.mocked(fetchActor).mockResolvedValue({
				id: 'https://example.com/users/bob',
				outbox: 'https://example.com/users/bob/outbox',
				followers: 'https://example.com/users/bob/followers',
				following: 'https://example.com/users/bob/following',
			})

			vi.mocked(safeFetch).mockImplementation((url: string) => {
				if (url.includes('/outbox')) {
					return Promise.resolve({
						ok: true,
						headers: new Map([['content-type', 'application/activity+json']]),
						json: async () => mockOutbox,
					} as unknown as Response)
				}
				return Promise.reject(new Error('Unexpected URL'))
			})

			const res = await app.request('/api/user-search/profile/bob@example.com')

			expect(res.status).toBe(200)
			expect(safeFetch).toHaveBeenCalledWith(
				'https://example.com/users/bob/outbox',
				expect.objectContaining({
					headers: {
						Accept: 'application/activity+json',
					},
				})
			)
			expect(cacheEventFromOutboxActivity).toHaveBeenCalled()
		})

		it('should return 404 when user not found', async () => {
			vi.mocked(prisma.user.findFirst).mockResolvedValue(null)
			vi.mocked(resolveWebFinger).mockResolvedValue(null)

			const res = await app.request('/api/user-search/profile/nonexistent')

			expect(res.status).toBe(404)
			const body = (await res.json()) as any as any
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
			const body = (await res.json()) as any as any
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
			vi.mocked(prisma.event.findMany).mockResolvedValueOnce([])

			vi.mocked(safeFetch).mockImplementation((url: string) => {
				if (url.includes('/users/bob')) {
					return Promise.resolve({
						ok: true,
						headers: new Map([['content-type', 'application/activity+json']]),
						json: async () => ({
							id: 'https://example.com/users/bob',
							outbox: 'https://example.com/users/bob/outbox',
							followers: 'https://example.com/users/bob/followers',
							following: 'https://example.com/users/bob/following',
						}),
					} as unknown as Response)
				}
				return Promise.reject(new Error('Network error'))
			})

			const res = await app.request('/api/user-search/profile/bob@example.com')

			expect(res.status).toBe(200)
			const body = (await res.json()) as any as any
			expect(body.user.username).toBe('bob@example.com')
			expect(body.events).toEqual([])
		})

		it('should return minimal data for private profile when viewer is not follower', async () => {
			const privateUser = {
				...mockLocalUser,
				bio: 'Private bio',
				headerImage: 'https://example.com/header.jpg',
				isPublicProfile: false,
				externalActorUrl: null,
				createdAt: new Date('2024-01-01'),
				_count: {
					events: 5,
					followers: 10,
					following: 3,
				},
			}

			vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue(null as any)
			vi.mocked(prisma.user.findFirst).mockResolvedValue(privateUser as any)
			vi.mocked(prisma.follower.count).mockResolvedValue(10)
			vi.mocked(prisma.following.count).mockResolvedValue(3)
			vi.mocked(prisma.event.findMany).mockResolvedValue([])
			vi.mocked(prisma.event.count).mockResolvedValue(5)
			vi.mocked(prisma.following.findFirst).mockResolvedValue(null)

			const res = await app.request('/api/user-search/profile/alice')

			expect(res.status).toBe(200)
			const body = (await res.json()) as any as any
			expect(body.user.id).toBe(privateUser.id)
			expect(body.user.username).toBe(privateUser.username)
			expect(body.user.name).toBe(privateUser.name)
			expect(body.user.profileImage).toBeDefined()
			expect(body.user.createdAt).toBeDefined()
			expect(typeof body.user.createdAt).toBe('string')
			expect(body.user.displayColor).toBeDefined()
			expect(typeof body.user.displayColor).toBe('string')
			expect(body.user.timezone).toBeUndefined()
			expect(body.user.bio).toBeNull()
			expect(body.user.headerImage).toBeNull()
			expect(body.user._count).toEqual({
				events: 0,
				followers: 0,
				following: 0,
			})
			expect(body.events).toEqual([])
		})

		it('should return full data for private profile when viewer is the owner', async () => {
			const privateUser = {
				...mockLocalUser,
				bio: 'Private bio',
				headerImage: 'https://example.com/header.jpg',
				timezone: 'America/New_York',
				isPublicProfile: false,
				externalActorUrl: null,
				createdAt: new Date('2024-01-01'),
				_count: {
					events: 5,
					followers: 10,
					following: 3,
				},
			}

			vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue({
				user: {
					id: privateUser.id,
					username: privateUser.username,
				},
				session: {
					userId: privateUser.id,
				},
			} as any)

			vi.mocked(prisma.user.findFirst).mockResolvedValue(privateUser as any)
			vi.mocked(prisma.follower.count).mockResolvedValue(10)
			vi.mocked(prisma.following.count).mockResolvedValue(3)
			vi.mocked(prisma.event.findMany).mockResolvedValue([])
			vi.mocked(prisma.event.count).mockResolvedValue(5)
			vi.mocked(eventVisibility.canUserViewEvent).mockResolvedValue(true)

			const res = await app.request('/api/user-search/profile/alice')

			expect(res.status).toBe(200)
			const body = (await res.json()) as any as any
			expect(body.user.id).toBe(privateUser.id)
			expect(body.user.username).toBe(privateUser.username)
			expect(body.user.bio).toBe(privateUser.bio)
			expect(body.user.headerImage).toBe(privateUser.headerImage)
			expect(body.user.timezone).toBe(privateUser.timezone)
			expect(body.user._count).toBeDefined()
			expect(body.user._count.events).toBe(5)
			expect(body.user._count.followers).toBe(10)
			expect(body.user._count.following).toBe(3)
		})

		it('should return full data for private profile when viewer is an accepted follower', async () => {
			const privateUser = {
				...mockLocalUser,
				bio: 'Private bio',
				headerImage: 'https://example.com/header.jpg',
				timezone: 'America/New_York',
				isPublicProfile: false,
				externalActorUrl: null,
				createdAt: new Date('2024-01-01'),
				_count: {
					events: 5,
					followers: 10,
					following: 3,
				},
			}

			const followerUser = {
				id: 'follower_123',
				username: 'follower',
			}

			const baseUrl = 'http://localhost:3000'
			const profileActorUrl = `${baseUrl}/${privateUser.username}`

			vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue({
				user: {
					id: followerUser.id,
					username: followerUser.username,
				},
				session: {
					userId: followerUser.id,
				},
			} as any)

			vi.mocked(prisma.user.findFirst).mockResolvedValue(privateUser as any)
			vi.mocked(prisma.follower.count).mockResolvedValue(10)
			vi.mocked(prisma.following.count).mockResolvedValue(3)
			vi.mocked(prisma.event.findMany).mockResolvedValue([])
			vi.mocked(prisma.event.count).mockResolvedValue(5)
			vi.mocked(prisma.following.findFirst).mockResolvedValue({
				id: 'follow_123',
				userId: followerUser.id,
				actorUrl: profileActorUrl,
				accepted: true,
			} as any)
			vi.mocked(eventVisibility.canUserViewEvent).mockResolvedValue(true)

			const res = await app.request('/api/user-search/profile/alice')

			expect(res.status).toBe(200)
			const body = (await res.json()) as any as any
			expect(body.user.id).toBe(privateUser.id)
			expect(body.user.username).toBe(privateUser.username)
			expect(body.user.bio).toBe(privateUser.bio)
			expect(body.user.headerImage).toBe(privateUser.headerImage)
			expect(body.user.timezone).toBe(privateUser.timezone)
			expect(body.user._count).toBeDefined()
			expect(body.user._count.events).toBe(5)
			expect(body.user._count.followers).toBe(10)
			expect(body.user._count.following).toBe(3)
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

			const mockOutbox = {
				orderedItems: [],
			}

			vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUserWithCount as any)
			vi.mocked(prisma.event.findMany).mockResolvedValueOnce([])
			vi.mocked(safeFetch).mockImplementation((url: string) => {
				if (url.includes('/outbox')) {
					return Promise.resolve({
						ok: true,
						headers: new Map([['content-type', 'application/activity+json']]),
						json: async () => mockOutbox,
					} as unknown as Response)
				}
				if (url.includes('/users/bob')) {
					return Promise.resolve({
						ok: true,
						headers: new Map([['content-type', 'application/activity+json']]),
						json: async () => ({
							id: 'https://example.com/users/bob',
							outbox: 'https://example.com/users/bob/outbox',
							followers: 'https://example.com/users/bob/followers',
							following: 'https://example.com/users/bob/following',
						}),
					} as unknown as Response)
				}
				return Promise.reject(new Error('Unexpected URL'))
			})

			const res = await app.request('/api/user-search/profile/bob@example.com')

			expect(res.status).toBe(200)
			const body = (await res.json()) as any as any
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
						type: 'Like',
						object: {
							type: 'Event',
						},
					},
				],
			}

			vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUserWithCount as any)
			vi.mocked(prisma.event.findMany).mockResolvedValueOnce([])
			vi.mocked(safeFetch).mockImplementation((url: string) => {
				if (url.includes('/outbox')) {
					return Promise.resolve({
						ok: true,
						headers: new Map([['content-type', 'application/activity+json']]),
						json: async () => mockOutbox,
					} as unknown as Response)
				}
				return Promise.reject(new Error('Unexpected URL'))
			})

			const res = await app.request('/api/user-search/profile/bob@example.com')

			expect(res.status).toBe(200)
			expect(prisma.event.upsert).not.toHaveBeenCalled()
		})

		it('should handle error when getting profile fails', async () => {
			vi.mocked(prisma.user.findFirst).mockRejectedValueOnce(new Error('Database error'))

			const res = await app.request('/api/user-search/profile/alice')

			expect(res.status).toBe(500)
			const body = (await res.json()) as any as any
			expect(body.error).toBe('Internal server error')
		})

		it('should handle lookupUser errors', async () => {
			vi.mocked(prisma.user.findFirst).mockRejectedValue(new Error('Database error'))

			const res = await app.request('/api/user-search/profile/alice')

			expect(res.status).toBe(500)
			const body = (await res.json()) as any
			expect(body.error).toBe('Internal server error')
		})

		it('should track remote instance', async () => {
			const mockUser = {
				...mockRemoteUser,
				bio: null,
				headerImage: null,
				createdAt: new Date('2024-01-01'),
				_count: {
					followers: 0,
					following: 0,
				},
			}

			vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any)
			vi.mocked(prisma.event.findMany).mockResolvedValue([])
			vi.mocked(prisma.event.count).mockResolvedValue(0)
			vi.mocked(prisma.follower.count).mockResolvedValue(0)
			vi.mocked(prisma.following.count).mockResolvedValue(0)

			const res = await app.request('/api/user-search/profile/bob@example.com')

			expect(res.status).toBe(200)
		})

		it('should filter events by visibility', async () => {
			const mockUser = {
				...mockLocalUser,
				bio: null,
				headerImage: null,
				createdAt: new Date('2024-01-01'),
				isPublicProfile: true,
				_count: {
					followers: 0,
					following: 0,
				},
			}

			vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any)
			vi.mocked(prisma.event.findMany).mockResolvedValue([])
			vi.mocked(prisma.event.count).mockResolvedValue(0)
			vi.mocked(prisma.follower.count).mockResolvedValue(0)
			vi.mocked(prisma.following.count).mockResolvedValue(0)

			const res = await app.request('/api/user-search/profile/alice')

			expect(res.status).toBe(200)
		})

		it('should fetch remote events when no local events', async () => {
			const mockRemoteUserWithCount = {
				...mockRemoteUser,
				bio: null,
				headerImage: null,
				createdAt: new Date('2024-01-01'),
				_count: {
					followers: 0,
					following: 0,
				},
			}

			vi.mocked(prisma.user.findFirst).mockResolvedValue(mockRemoteUserWithCount as any)
			vi.mocked(prisma.event.findMany).mockResolvedValue([])
			vi.mocked(prisma.event.count).mockResolvedValue(0)
			vi.mocked(prisma.follower.count).mockResolvedValue(0)
			vi.mocked(prisma.following.count).mockResolvedValue(0)
			vi.mocked(fetchActor).mockResolvedValue({
				id: 'https://example.com/users/bob',
				outbox: 'https://example.com/users/bob/outbox',
			})
			vi.mocked(safeFetch).mockResolvedValue({
				ok: true,
				json: async () => ({ orderedItems: [] }),
			} as any)

			const res = await app.request('/api/user-search/profile/bob@example.com')

			expect(res.status).toBe(200)
		})
	})

	describe('GET /profile/:username/followers', () => {
		it('should return followers for local user', async () => {
			const mockUserWithCount = {
				...mockLocalUser,
				isRemote: false,
				externalActorUrl: null,
				isPublicProfile: true,
				followersListCached: null,
				followersListSync: null,
			}

			vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUserWithCount as any)
			vi.mocked(prisma.follower.findMany).mockResolvedValue([])
			vi.mocked(prisma.following.findMany).mockResolvedValue([])

			const res = await app.request('/api/user-search/profile/alice/followers')

			expect(res.status).toBe(200)
			const body = (await res.json()) as any
			expect(body.followers).toEqual([])
			expect(body.isRemote).toBe(false)
		})

		it('should return 404 when user not found', async () => {
			vi.mocked(prisma.user.findFirst).mockResolvedValue(null)

			const res = await app.request('/api/user-search/profile/nonexistent/followers')

			expect(res.status).toBe(404)
			const body = (await res.json()) as any
			expect(body.error).toBe('User not found')
		})

		it('should return empty followers for private profile when not follower', async () => {
			const privateUser = {
				...mockLocalUser,
				isRemote: false,
				externalActorUrl: null,
				isPublicProfile: false,
				followersListCached: null,
				followersListSync: null,
			}

			vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue(null as any)
			vi.mocked(prisma.user.findFirst).mockResolvedValue(privateUser as any)

			const res = await app.request('/api/user-search/profile/privateuser/followers')

			expect(res.status).toBe(200)
			const body = (await res.json()) as any
			expect(body.followers).toEqual([])
			expect(body.isRemote).toBe(true)
		})

		it('should use cached followers when available', async () => {
			const cachedFollowers = [
				{
					id: 'user_1',
					username: 'follower1',
					name: 'Follower 1',
					profileImage: null,
					displayColor: '#3b82f6',
					isRemote: false,
					isFollowing: true,
					isPending: false,
				},
			]

			const remoteUser = {
				...mockRemoteUser,
				isPublicProfile: true,
				followersListCached: cachedFollowers,
				followersListSync: new Date(),
			}

			vi.mocked(prisma.user.findFirst).mockResolvedValue(remoteUser as any)

			const res = await app.request('/api/user-search/profile/bob@example.com/followers')

			expect(res.status).toBe(200)
			const body = (await res.json()) as any
			expect(body.followers).toEqual(cachedFollowers)
			expect(body.isRemote).toBe(true)
			expect(body.remoteNote).toBe('(cached)')
		})

		it('should fetch remote followers when cache is stale', async () => {
			const staleUser = {
				...mockRemoteUser,
				isPublicProfile: true,
				followersListCached: [],
				followersListSync: new Date(Date.now() - 10 * 60 * 1000),
			}

			vi.mocked(prisma.user.findFirst).mockResolvedValue(staleUser as any)
			vi.mocked(fetchActor).mockResolvedValue({
				id: 'https://example.com/users/bob',
				followers: 'https://example.com/users/bob/followers',
			})
			vi.mocked(fetchRemoteCollectionItems).mockResolvedValue([])
			vi.mocked(fetchRemoteCollectionCount).mockResolvedValue(0)

			const res = await app.request('/api/user-search/profile/bob@example.com/followers')

			expect(res.status).toBe(200)
			expect(fetchActor).toHaveBeenCalled()
		})

		it('should handle user without externalActorUrl', async () => {
			const userWithoutActor = {
				...mockLocalUser,
				isRemote: true,
				externalActorUrl: null,
				isPublicProfile: true,
				followersListCached: null,
				followersListSync: null,
			}

			vi.mocked(prisma.user.findFirst).mockResolvedValue(userWithoutActor as any)

			const res = await app.request('/api/user-search/profile/user@example.com/followers')

			expect(res.status).toBe(200)
			const body = (await res.json()) as any
			expect(body.followers).toEqual([])
		})

		it('should handle fetchAndProcessRemoteFollowers returning null', async () => {
			const userWithStaleCache = {
				...mockRemoteUser,
				isPublicProfile: true,
				followersListCached: null,
				followersListSync: new Date(Date.now() - 10 * 60 * 1000),
			}

			vi.mocked(prisma.user.findFirst).mockResolvedValue(userWithStaleCache as any)
			vi.mocked(fetchActor).mockResolvedValue(null)

			const res = await app.request('/api/user-search/profile/bob@example.com/followers')

			expect(res.status).toBe(200)
			const body = (await res.json()) as any
			expect(body.followers).toEqual([])
			expect(body.remoteNote).toBe('Unable to fetch followers from remote instance')
		})

		it('should handle pending follow request in cached followers', async () => {
			const currentUser = {
				id: 'current_user',
				username: 'currentuser',
				name: 'Current User',
				profileImage: null,
				displayColor: '#3b82f6',
			}

			const cachedFollowers: any[] = []

			const userWithCache = {
				...mockRemoteUser,
				isPublicProfile: true,
				followersListCached: cachedFollowers,
				followersListSync: new Date(),
			}

			vi.mocked(prisma.user.findFirst).mockResolvedValue(userWithCache as any)
			vi.mocked(prisma.following.findUnique).mockResolvedValue({
				userId: currentUser.id,
				actorUrl: mockRemoteUser.externalActorUrl,
				accepted: false,
			} as any)
			vi.mocked(prisma.user.findUnique).mockResolvedValue(currentUser as any)

			const res = await app.request('/api/user-search/profile/bob@example.com/followers')

			expect(res.status).toBe(200)
		})
	})

	describe('GET /profile/:username/following', () => {
		it('should return following list for local user', async () => {
			const mockUser = {
				...mockLocalUser,
				isRemote: false,
				externalActorUrl: null,
				isPublicProfile: true,
			}

			vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any)
			vi.mocked(prisma.following.findMany).mockResolvedValue([
				{
					id: 'follow_1',
					userId: 'user_123',
					actorUrl: 'https://example.com/users/other',
					username: 'other',
					inboxUrl: 'https://example.com/users/other/inbox',
					sharedInboxUrl: null,
					iconUrl: null,
					accepted: true,
					createdAt: new Date(),
				},
			])
			vi.mocked(prisma.user.findFirst).mockResolvedValue({
				id: 'other_1',
				username: 'other',
				name: 'Other User',
				profileImage: null,
				displayColor: '#3b82f6',
				isRemote: true,
			} as any)

			const res = await app.request('/api/user-search/profile/alice/following')

			expect(res.status).toBe(200)
			const body = (await res.json()) as any
			expect(body.following).toBeDefined()
			expect(Array.isArray(body.following)).toBe(true)
		})

		it('should return 404 when user not found', async () => {
			vi.mocked(prisma.user.findFirst).mockResolvedValue(null)

			const res = await app.request('/api/user-search/profile/nonexistent/following')

			expect(res.status).toBe(404)
			const body = (await res.json()) as any
			expect(body.error).toBe('User not found')
		})

		it('should return empty following for private profile when not follower', async () => {
			const privateUser = {
				...mockLocalUser,
				isRemote: false,
				externalActorUrl: null,
				isPublicProfile: false,
			}

			vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue(null as any)
			vi.mocked(prisma.user.findFirst).mockResolvedValue(privateUser as any)

			const res = await app.request('/api/user-search/profile/privateuser/following')

			expect(res.status).toBe(200)
			const body = (await res.json()) as any
			expect(body.following).toEqual([])
		})

		it('should resolve local following users', async () => {
			const baseUrl = 'http://localhost:3000'
			const mockUser = {
				...mockLocalUser,
				isRemote: false,
				externalActorUrl: null,
				isPublicProfile: true,
			}

			vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any)
			vi.mocked(prisma.following.findMany).mockResolvedValue([
				{
					id: 'follow_2',
					userId: 'user_123',
					actorUrl: `${baseUrl}/users/localfriend`,
					username: 'localfriend',
					inboxUrl: `${baseUrl}/users/localfriend/inbox`,
					sharedInboxUrl: null,
					iconUrl: null,
					accepted: true,
					createdAt: new Date(),
				},
			])
			vi.mocked(prisma.user.findUnique).mockResolvedValue({
				id: 'friend_1',
				username: 'localfriend',
				name: 'Local Friend',
				profileImage: null,
				displayColor: '#3b82f6',
				isRemote: false,
			} as any)

			const res = await app.request('/api/user-search/profile/alice/following')

			expect(res.status).toBe(200)
			expect(prisma.user.findUnique).toHaveBeenCalled()
		})

		it('should handle remote user following list', async () => {
			const remoteUser = {
				...mockRemoteUser,
				isPublicProfile: true,
			}

			vi.mocked(prisma.user.findFirst).mockResolvedValue(remoteUser as any)
			vi.mocked(prisma.following.findMany).mockResolvedValue([
				{
					id: 'follow_3',
					userId: 'user_456',
					actorUrl: 'https://other-remote.com/users/following',
					username: 'following',
					inboxUrl: 'https://other-remote.com/users/following/inbox',
					sharedInboxUrl: null,
					iconUrl: null,
					accepted: true,
					createdAt: new Date(),
				},
			])
			vi.mocked(prisma.user.findFirst).mockResolvedValue({
				id: 'following_1',
				username: 'following',
				name: 'Following User',
				profileImage: null,
				displayColor: '#3b82f6',
				isRemote: true,
			} as any)

			const res = await app.request('/api/user-search/profile/bob@example.com/following')

			expect(res.status).toBe(200)
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
			const body = (await res.json()) as any as any
			expect(body.remoteAccountSuggestion).toBeNull()
		})

		it('should handle empty query gracefully', async () => {
			const res = await app.request('/api/user-search?q=')

			expect(res.status).toBe(400)
		})

		it('should handle empty handle gracefully', async () => {
			const res = await app.request('/api/user-search?q=')

			expect(res.status).toBe(400)
		})

		it('should handle handle with only domain', async () => {
			vi.mocked(prisma.user.findMany).mockResolvedValue([])
			vi.mocked(prisma.event.findMany).mockResolvedValue([])
			vi.mocked(prisma.user.findFirst).mockResolvedValue(null)

			const res = await app.request('/api/user-search?q=example.com')

			expect(res.status).toBe(200)
			const body = (await res.json()) as any
			expect(body.users).toEqual([])
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
						OR: [{ username: { contains: 'alice' } }, { name: { contains: 'alice' } }],
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
			const body = (await res.json()) as any as any
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
			const body = (await res.json()) as any as any
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
			const body = (await res.json()) as any as any
			expect(body.events.length).toBeGreaterThan(0)
		})

		it('should handle search with special characters', async () => {
			const mockUsers = [mockLocalUser]
			vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any)
			vi.mocked(prisma.event.findMany).mockResolvedValue([])

			const res = await app.request('/api/user-search?q=Alice%20Smith')

			expect(res.status).toBe(200)
		})

		it('should handle search with limit=0', async () => {
			vi.mocked(prisma.user.findMany).mockResolvedValue([])
			vi.mocked(prisma.event.findMany).mockResolvedValue([])

			const res = await app.request('/api/user-search?q=test&limit=0')

			expect(res.status).toBe(200)
		})

		it('should handle database errors during search', async () => {
			vi.mocked(prisma.user.findMany).mockRejectedValue(new Error('Connection failed'))

			const res = await app.request('/api/user-search?q=test')

			expect(res.status).toBe(500)
		})
	})

	describe('Error handling', () => {
		it('should handle error when search fails', async () => {
			vi.mocked(prisma.user.findMany).mockRejectedValueOnce(new Error('Database error'))

			const res = await app.request('/api/user-search?q=test')

			expect(res.status).toBe(500)
			const body = (await res.json()) as any as any
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
			const body = (await res.json()) as any as any
			expect(body.error).toBe('Internal server error')
		})

		it('should handle WebFinger resolution timeout', async () => {
			vi.mocked(prisma.user.findFirst).mockResolvedValue(null)
			vi.mocked(resolveWebFinger).mockImplementation(
				() => new Promise((resolve) => setTimeout(() => resolve(null), 100))
			)

			const res = await app.request('/api/user-search/resolve', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ handle: '@bob@example.com' }),
			})

			expect(res.status).toBe(404)
			const body = (await res.json()) as any as any
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
			const body = (await res.json()) as any as any
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
			const body = (await res.json()) as any as any
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
			const body = (await res.json()) as any as any
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
			const body = (await res.json()) as any as any
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
			const body = (await res.json()) as any as any
			expect(body.error).toBe('Failed to fetch actor')
		})

		it('should handle parseHandle errors', async () => {
			const res = await app.request('/api/user-search/resolve', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					handle: '',
				}),
			})

			expect(res.status).toBe(400)
		})
	})
})
