/**
 * Tests for ActivityPub API
 * WebFinger, Actor, Inbox, Outbox, and Collections
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import activitypubApp from '../activitypub.js'
import { prisma } from '../lib/prisma.js'
import { verifySignature } from '../lib/httpSignature.js'
import { handleActivity } from '../federation.js'
import {
	getBaseUrl,
	createOrderedCollection,
	createOrderedCollectionPage,
} from '../lib/activitypubHelpers.js'
import { config } from '../config.js'

// Mock dependencies
vi.mock('../lib/prisma.js', () => ({
	prisma: {
		user: {
			findUnique: vi.fn(),
			update: vi.fn(),
			count: vi.fn(),
		},
		follower: {
			count: vi.fn(),
			findMany: vi.fn(),
		},
		following: {
			count: vi.fn(),
			findMany: vi.fn(),
		},
		event: {
			count: vi.fn(),
			findUnique: vi.fn(),
			findMany: vi.fn(),
		},
	},
}))

vi.mock('../lib/httpSignature.js', () => ({
	verifySignature: vi.fn(),
}))

vi.mock('../federation.js', () => ({
	handleActivity: vi.fn(),
}))

vi.mock('../lib/activitypubHelpers.js', () => ({
	getBaseUrl: vi.fn(() => 'http://localhost:3000'),
	createOrderedCollection: vi.fn((url, items, total) => ({
		'@context': 'https://www.w3.org/ns/activitystreams',
		type: 'OrderedCollection',
		id: url,
		totalItems: total,
		orderedItems: items,
	})),
	createOrderedCollectionPage: vi.fn((id, items, partOf, next, prev) => ({
		'@context': 'https://www.w3.org/ns/activitystreams',
		type: 'OrderedCollectionPage',
		id,
		partOf,
		orderedItems: items,
		next,
		prev,
	})),
}))

vi.mock('../lib/encryption.js', () => ({
	encryptPrivateKey: vi.fn((key) => `encrypted_${key}`),
}))

vi.mock('../auth.js', () => ({
	generateAndEncryptRSAKeys: vi.fn(async () => ({
		publicKey: 'generated_public_key',
		encryptedPrivateKey: 'encrypted_generated_private_key',
	})),
}))

vi.mock('../config.js', () => ({
	config: {
		isDevelopment: false,
	},
}))

// Create test app
const app = new Hono()
app.route('/', activitypubApp)

describe('ActivityPub API', () => {
	const mockUser = {
		id: 'user_123',
		username: 'alice',
		name: 'Alice Smith',
		bio: 'Test bio',
		profileImage: 'https://example.com/avatar.jpg',
		headerImage: 'https://example.com/header.jpg',
		displayColor: '#3b82f6',
		publicKey: '-----BEGIN PUBLIC KEY-----\nMOCK_KEY\n-----END PUBLIC KEY-----',
		privateKey: 'encrypted_private_key',
		isRemote: false,
		externalActorUrl: null,
		isPublicProfile: true,
	}

	const mockEvent = {
		id: 'event_123',
		title: 'Test Event',
		summary: 'Test event description',
		startTime: new Date('2025-01-01T12:00:00Z'),
		endTime: new Date('2025-01-01T13:00:00Z'),
		location: 'Test Location',
		url: 'https://example.com/event',
		createdAt: new Date('2024-12-01T10:00:00Z'),
		updatedAt: new Date('2024-12-01T10:00:00Z'),
		userId: 'user_123',
		attributedTo: 'http://localhost:3000/users/alice',
		eventStatus: null,
		eventAttendanceMode: null,
		maximumAttendeeCapacity: null,
		headerImage: null,
		duration: null,
		user: mockUser,
	}

	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(handleActivity).mockResolvedValue(undefined)
		vi.mocked(verifySignature).mockResolvedValue(true)
	})

	describe('GET /.well-known/webfinger', () => {
		it('should return WebFinger data for valid user', async () => {
			vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)

			const res = await app.request('/.well-known/webfinger?resource=acct:alice@localhost')

			expect(res.status).toBe(200)
			const body = (await res.json()) as {
				subject: string
				aliases: string[]
				links: Array<{ rel: string; type: string; href: string }>
			}
			expect(body.subject).toBe('acct:alice@localhost')
			expect(body.aliases).toContain('http://localhost:3000/users/alice')
			expect(body.links).toHaveLength(2)
			expect(body.links[0].rel).toBe('self')
			expect(body.links[0].type).toBe('application/activity+json')
		})

		it('should return 400 when resource parameter is missing', async () => {
			const res = await app.request('/.well-known/webfinger')

			expect(res.status).toBe(400)
			const body = (await res.json()) as { error: string }
			expect(body.error).toBe('Missing resource parameter')
		})

		it('should return 400 for invalid resource format', async () => {
			const res = await app.request('/.well-known/webfinger?resource=invalid')

			expect(res.status).toBe(400)
			const body = (await res.json()) as { error: string }
			expect(body.error).toBe('Invalid resource format')
		})

		it('should return 404 for domain mismatch', async () => {
			const res = await app.request(
				'/.well-known/webfinger?resource=acct:alice@wrongdomain.com'
			)

			expect(res.status).toBe(404)
			const body = (await res.json()) as { error: string }
			expect(body.error).toBe('Domain mismatch')
		})

		it('should return 404 when user not found', async () => {
			vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

			const res = await app.request(
				'/.well-known/webfinger?resource=acct:nonexistent@localhost'
			)

			expect(res.status).toBe(404)
			const body = (await res.json()) as { error: string }
			expect(body.error).toBe('User not found')
		})

		it('should handle errors gracefully', async () => {
			vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error('Database error'))

			const res = await app.request('/.well-known/webfinger?resource=acct:alice@localhost')

			expect(res.status).toBe(500)
		})
	})

	describe('GET /.well-known/nodeinfo', () => {
		it('should return NodeInfo discovery document', async () => {
			const res = await app.request('/.well-known/nodeinfo')

			expect(res.status).toBe(200)
			const body = (await res.json()) as {
				links: Array<{ rel: string; href: string }>
			}
			expect(body.links).toHaveLength(1)
			expect(body.links[0].rel).toBe('https://nodeinfo.diaspora.software/ns/schema/2.0')
			expect(body.links[0].href).toBe('http://localhost:3000/nodeinfo/2.0')
		})
	})

	describe('GET /nodeinfo/2.0', () => {
		it('should return NodeInfo 2.0 data', async () => {
			vi.mocked(prisma.user.count).mockResolvedValue(10)
			vi.mocked(prisma.event.count).mockResolvedValue(50)

			const res = await app.request('/nodeinfo/2.0')

			expect(res.status).toBe(200)
			const body = (await res.json()) as {
				version: string
				software: { name: string; version: string }
				protocols: string[]
				usage: { users: { total: number }; localPosts: number }
			}
			expect(body.version).toBe('2.0')
			expect(body.software.name).toBe('constellate')
			expect(body.protocols).toContain('activitypub')
			expect(body.usage.users.total).toBe(10)
			expect(body.usage.localPosts).toBe(50)
		})
	})

	describe('GET /users/:username', () => {
		it('should return Actor object for valid user', async () => {
			vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)

			const res = await app.request('/users/alice')

			expect(res.status).toBe(200)
			const body = (await res.json()) as {
				type: string
				id: string
				preferredUsername: string
				name: string
				inbox: string
				outbox: string
				publicKey: { id: string; owner: string; publicKeyPem: string }
			}
			expect(body.type).toBe('Person')
			expect(body.id).toBe('http://localhost:3000/users/alice')
			expect(body.preferredUsername).toBe('alice')
			expect(body.name).toBe('Alice Smith')
			expect(body.inbox).toBe('http://localhost:3000/users/alice/inbox')
			expect(body.outbox).toBe('http://localhost:3000/users/alice/outbox')
			expect(body.publicKey).toBeDefined()
			expect(res.headers.get('Content-Type')).toBe('application/activity+json')
		})

		it('should generate keys if user does not have them', async () => {
			const userWithoutKeys = {
				...mockUser,
				publicKey: null,
				privateKey: null,
			}

			vi.mocked(prisma.user.findUnique).mockResolvedValue(userWithoutKeys as any)
			vi.mocked(prisma.user.update).mockResolvedValue({
				...userWithoutKeys,
				publicKey: 'generated_public_key',
				privateKey: 'encrypted_generated_private_key',
			} as any)

			const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

			const res = await app.request('/users/alice')

			expect(res.status).toBe(200)
			expect(prisma.user.update).toHaveBeenCalled()
			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining('Generated and encrypted keys for user: alice')
			)

			consoleLogSpy.mockRestore()
		})

		it('should return 404 when user not found', async () => {
			vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

			const res = await app.request('/users/nonexistent')

			expect(res.status).toBe(404)
			const body = (await res.json()) as { error: string }
			expect(body.error).toBe('User not found')
		})

		it('should include icon and image when available', async () => {
			vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)

			const res = await app.request('/users/alice')

			expect(res.status).toBe(200)
			const body = (await res.json()) as {
				icon?: { type: string; url: string }
				image?: { type: string; url: string }
			}
			expect(body.icon).toBeDefined()
			expect(body.icon?.url).toBe('https://example.com/avatar.jpg')
			expect(body.image).toBeDefined()
			expect(body.image?.url).toBe('https://example.com/header.jpg')
		})

		it('should handle errors gracefully', async () => {
			vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error('Database error'))

			const res = await app.request('/users/alice')

			expect(res.status).toBe(500)
		})
	})

	describe('GET /users/:username/followers', () => {
		it('should return followers collection', async () => {
			vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
			vi.mocked(prisma.follower.count).mockResolvedValue(5)

			const res = await app.request('/users/alice/followers')

			expect(res.status).toBe(200)
			const body = (await res.json()) as { type: string; totalItems: number }
			expect(body.type).toBe('OrderedCollection')
			expect(body.totalItems).toBe(5)
			expect(createOrderedCollection).toHaveBeenCalled()
		})

		it('should return followers page when page parameter is provided', async () => {
			const mockFollowers = [
				{
					id: 'follower_1',
					actorUrl: 'https://remote.com/users/bob',
					userId: 'user_123',
					accepted: true,
					createdAt: new Date(),
				},
				{
					id: 'follower_2',
					actorUrl: 'https://remote.com/users/charlie',
					userId: 'user_123',
					accepted: true,
					createdAt: new Date(),
				},
			]

			vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
			vi.mocked(prisma.follower.findMany).mockResolvedValue(mockFollowers as any)

			const res = await app.request('/users/alice/followers?page=1')

			expect(res.status).toBe(200)
			const body = (await res.json()) as { type: string; orderedItems: string[] }
			expect(body.type).toBe('OrderedCollectionPage')
			expect(body.orderedItems).toHaveLength(2)
			expect(prisma.follower.findMany).toHaveBeenCalledWith({
				where: { userId: 'user_123', accepted: true },
				skip: 0,
				take: 20,
				orderBy: { createdAt: 'desc' },
			})
		})

		it('should return 404 when user not found', async () => {
			vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

			const res = await app.request('/users/nonexistent/followers')

			expect(res.status).toBe(404)
		})

		it('should handle pagination correctly', async () => {
			const mockFollowers = Array(20)
				.fill(null)
				.map((_, i) => ({
					id: `follower_${i}`,
					actorUrl: `https://remote.com/users/user${i}`,
					userId: 'user_123',
					accepted: true,
					createdAt: new Date(),
				}))

			vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
			vi.mocked(prisma.follower.findMany).mockResolvedValue(mockFollowers as any)

			const res = await app.request('/users/alice/followers?page=1')

			expect(res.status).toBe(200)
			expect(createOrderedCollectionPage).toHaveBeenCalledWith(
				expect.stringContaining('?page=1'),
				expect.any(Array),
				expect.any(String),
				expect.stringContaining('?page=2'),
				undefined
			)
		})
	})

	describe('GET /users/:username/following', () => {
		it('should return following collection', async () => {
			vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
			vi.mocked(prisma.following.count).mockResolvedValue(3)

			const res = await app.request('/users/alice/following')

			expect(res.status).toBe(200)
			const body = (await res.json()) as { type: string; totalItems: number }
			expect(body.type).toBe('OrderedCollection')
			expect(body.totalItems).toBe(3)
		})

		it('should return following page when page parameter is provided', async () => {
			const mockFollowing = [
				{
					id: 'following_1',
					actorUrl: 'https://remote.com/users/bob',
					userId: 'user_123',
					accepted: true,
					createdAt: new Date(),
				},
			]

			vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
			vi.mocked(prisma.following.findMany).mockResolvedValue(mockFollowing as any)

			const res = await app.request('/users/alice/following?page=1')

			expect(res.status).toBe(200)
			expect(prisma.following.findMany).toHaveBeenCalled()
		})

		it('should return 404 when user not found', async () => {
			vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

			const res = await app.request('/users/nonexistent/following')

			expect(res.status).toBe(404)
		})
	})

	describe('GET /users/:username/outbox', () => {
		it('should return outbox collection', async () => {
			vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
			vi.mocked(prisma.event.count).mockResolvedValue(10)

			const res = await app.request('/users/alice/outbox')

			expect(res.status).toBe(200)
			const body = (await res.json()) as { type: string; totalItems: number }
			expect(body.type).toBe('OrderedCollection')
			expect(body.totalItems).toBe(10)
		})

		it('should return outbox page with Create activities', async () => {
			vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
			vi.mocked(prisma.event.findMany).mockResolvedValue([mockEvent] as any)

			const res = await app.request('/users/alice/outbox?page=1')

			expect(res.status).toBe(200)
			const body = (await res.json()) as {
				type: string
				orderedItems: Array<{
					type: string
					actor: string
					object: { type: string; name: string }
				}>
			}
			expect(body.type).toBe('OrderedCollectionPage')
			expect(body.orderedItems).toHaveLength(1)
			expect(body.orderedItems[0].type).toBe('Create')
			expect(body.orderedItems[0].object.type).toBe('Event')
			expect(body.orderedItems[0].object.name).toBe('Test Event')
		})

		it('should return 404 when user not found', async () => {
			vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

			const res = await app.request('/users/nonexistent/outbox')

			expect(res.status).toBe(404)
		})
	})

	describe('POST /users/:username/inbox', () => {
		const mockActivity = {
			'@context': 'https://www.w3.org/ns/activitystreams',
			id: 'https://remote.com/users/bob/activities/123',
			type: 'Follow',
			actor: 'https://remote.com/users/bob',
			object: 'http://localhost:3000/users/alice',
		}

		it('should accept valid activity with signature', async () => {
			vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
			vi.mocked(verifySignature).mockResolvedValue(true)

			const res = await app.request('/users/alice/inbox', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/activity+json',
					signature:
						'keyId="https://remote.com/users/bob#main-key",algorithm="rsa-sha256",headers="(request-target) host date",signature="mock_signature"',
					host: 'localhost:3000',
					date: new Date().toISOString(),
				},
				body: JSON.stringify(mockActivity),
			})

			expect(res.status).toBe(202)
			const body = (await res.json()) as { status: string }
			expect(body.status).toBe('accepted')
			expect(handleActivity).toHaveBeenCalledWith(mockActivity)
		})

		it('should return 404 when user not found', async () => {
			vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

			const res = await app.request('/users/nonexistent/inbox', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/activity+json',
					signature: 'mock_signature',
				},
				body: JSON.stringify(mockActivity),
			})

			expect(res.status).toBe(404)
		})

		it('should return 401 when signature is missing', async () => {
			vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)

			const res = await app.request('/users/alice/inbox', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/activity+json',
				},
				body: JSON.stringify(mockActivity),
			})

			expect(res.status).toBe(401)
			const body = (await res.json()) as { error: string }
			expect(body.error).toBe('Missing signature')
		})

		it('should return 401 when signature is invalid', async () => {
			vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
			vi.mocked(verifySignature).mockResolvedValue(false)

			const res = await app.request('/users/alice/inbox', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/activity+json',
					signature: 'invalid_signature',
					host: 'localhost:3000',
					date: new Date().toISOString(),
				},
				body: JSON.stringify(mockActivity),
			})

			expect(res.status).toBe(401)
			const body = (await res.json()) as { error: string }
			expect(body.error).toBe('Invalid signature')
		})

		it('should return 400 for invalid JSON', async () => {
			vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
			vi.mocked(verifySignature).mockResolvedValue(true)

			const res = await app.request('/users/alice/inbox', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/activity+json',
					signature: 'mock_signature',
					host: 'localhost:3000',
					date: new Date().toISOString(),
				},
				body: 'invalid json',
			})

			expect(res.status).toBe(400)
			const body = (await res.json()) as { error: string }
			expect(body.error).toBe('Invalid JSON payload')
		})

		it('should return 400 for invalid activity', async () => {
			vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
			vi.mocked(verifySignature).mockResolvedValue(true)

			const res = await app.request('/users/alice/inbox', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/activity+json',
					signature: 'mock_signature',
					host: 'localhost:3000',
					date: new Date().toISOString(),
				},
				body: JSON.stringify({ type: 'InvalidActivity' }),
			})

			expect(res.status).toBe(400)
			const body = (await res.json()) as { error: string }
			expect(body.error).toBe('Invalid activity')
		})

		it('should handle errors gracefully', async () => {
			vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error('Database error'))

			const res = await app.request('/users/alice/inbox', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/activity+json',
					signature: 'mock_signature',
				},
				body: JSON.stringify(mockActivity),
			})

			expect(res.status).toBe(500)
		})
	})

	describe('POST /inbox', () => {
		const mockActivity = {
			'@context': 'https://www.w3.org/ns/activitystreams',
			id: 'https://remote.com/users/bob/activities/123',
			type: 'Follow',
			actor: 'https://remote.com/users/bob',
			object: 'http://localhost:3000/users/alice',
		}

		it('should accept valid activity with signature', async () => {
			vi.mocked(verifySignature).mockResolvedValue(true)

			const res = await app.request('/inbox', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/activity+json',
					signature: 'mock_signature',
					host: 'localhost:3000',
					date: new Date().toISOString(),
				},
				body: JSON.stringify(mockActivity),
			})

			expect(res.status).toBe(202)
			const body = (await res.json()) as { status: string }
			expect(body.status).toBe('accepted')
			expect(handleActivity).toHaveBeenCalledWith(mockActivity)
		})

		it('should return 401 when signature is missing', async () => {
			const res = await app.request('/inbox', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/activity+json',
				},
				body: JSON.stringify(mockActivity),
			})

			expect(res.status).toBe(401)
		})

		it('should return 401 when signature is invalid', async () => {
			vi.mocked(verifySignature).mockResolvedValue(false)

			const res = await app.request('/inbox', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/activity+json',
					signature: 'invalid_signature',
					host: 'localhost:3000',
					date: new Date().toISOString(),
				},
				body: JSON.stringify(mockActivity),
			})

			expect(res.status).toBe(401)
		})

		it('should handle errors gracefully', async () => {
			vi.mocked(verifySignature).mockRejectedValue(new Error('Verification error'))

			const res = await app.request('/inbox', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/activity+json',
					signature: 'mock_signature',
				},
				body: JSON.stringify(mockActivity),
			})

			expect(res.status).toBe(500)
		})
	})

	describe('GET /events/:id', () => {
		it('should return Event object for valid event', async () => {
			vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as any)

			const res = await app.request('/events/event_123')

			expect(res.status).toBe(200)
			const body = (await res.json()) as {
				type: string
				id: string
				name: string
				startTime: string
				attributedTo: string
			}
			expect(body.type).toBe('Event')
			expect(body.id).toBe('http://localhost:3000/events/event_123')
			expect(body.name).toBe('Test Event')
			expect(body.startTime).toBe('2025-01-01T12:00:00.000Z')
			expect(body.attributedTo).toBe('http://localhost:3000/users/alice')
			expect(res.headers.get('Content-Type')).toBe('application/activity+json')
		})

		it('should return 404 when event not found', async () => {
			vi.mocked(prisma.event.findUnique).mockResolvedValue(null)

			const res = await app.request('/events/nonexistent')

			expect(res.status).toBe(404)
			const body = (await res.json()) as { error: string }
			expect(body.error).toBe('Event not found')
		})

		it('should handle remote users correctly', async () => {
			const remoteUser = {
				...mockUser,
				isRemote: true,
				externalActorUrl: 'https://remote.com/users/alice',
			}
			const eventWithRemoteUser = {
				...mockEvent,
				user: remoteUser,
			}

			vi.mocked(prisma.event.findUnique).mockResolvedValue(eventWithRemoteUser as any)

			const res = await app.request('/events/event_123')

			expect(res.status).toBe(200)
			const body = (await res.json()) as { attributedTo: string }
			expect(body.attributedTo).toBe('https://remote.com/users/alice')
		})

		it('should include optional fields when available', async () => {
			const { EventStatus, EventAttendanceMode } = await import('../constants/activitypub.js')
			const eventWithAllFields = {
				...mockEvent,
				headerImage: 'https://example.com/header.jpg',
				eventStatus: EventStatus.SCHEDULED,
				eventAttendanceMode: EventAttendanceMode.OFFLINE,
				maximumAttendeeCapacity: 100,
			}

			vi.mocked(prisma.event.findUnique).mockResolvedValue(eventWithAllFields as any)

			const res = await app.request('/events/event_123')

			expect(res.status).toBe(200)
			const body = (await res.json()) as {
				attachment?: Array<{ type: string; url: string }>
				eventStatus?: string
				eventAttendanceMode?: string
				maximumAttendeeCapacity?: number
			}
			expect(body.attachment).toBeDefined()
			expect(body.eventStatus).toBe(EventStatus.SCHEDULED)
			expect(body.eventAttendanceMode).toBe(EventAttendanceMode.OFFLINE)
			expect(body.maximumAttendeeCapacity).toBe(100)
		})

		it('should handle errors gracefully', async () => {
			vi.mocked(prisma.event.findUnique).mockRejectedValue(new Error('Database error'))

			const res = await app.request('/events/event_123')

			expect(res.status).toBe(500)
		})
	})
})
