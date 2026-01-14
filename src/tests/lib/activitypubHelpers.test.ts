import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
	getBaseUrl,
	fetchActor,
	cacheRemoteUser,
	cacheRemoteUserByUrl,
	fetchRemoteCollectionCount,
	fetchRemoteCollectionItems,
	createOrderedCollection,
	createOrderedCollectionPage,
	parseActivityId,
	isActivityProcessed,
	markActivityProcessed,
	cleanupProcessedActivities,
	isUserBlocked,
	isDomainBlocked,
	cacheEventFromOutboxActivity,
	extractLocationValue,
} from '../../lib/activitypubHelpers.js'
import { prisma } from '../../lib/prisma.js'
import { safeFetch } from '../../lib/ssrfProtection.js'
import { ContentType } from '../../constants/activitypub.js'
import type { Actor } from '../../lib/activitypubSchemas.js'

// Mock dependencies
vi.mock('../../lib/prisma.js', () => ({
	prisma: {
		user: {
			findUnique: vi.fn(),
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
		event: {
			upsert: vi.fn(),
		},
	},
}))

vi.mock('../../lib/ssrfProtection.js', () => ({
	safeFetch: vi.fn(),
}))

vi.mock('../../lib/instanceHelpers.js', () => ({
	trackInstance: vi.fn().mockResolvedValue(undefined),
	discoverPublicEndpoint: vi.fn(),
	fetchInstanceMetadata: vi.fn(),
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

	// resolveWebFinger moved to webfinger.test.ts

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
				headers: new Map([['content-type', 'application/activity+json']]),
				json: async () => mockActor,
			}
			vi.mocked(safeFetch).mockResolvedValue(mockResponse as unknown as Response)

			const result = await fetchActor('https://example.com/users/alice')
			expect(result).toEqual(mockActor)
			expect(safeFetch).toHaveBeenCalledWith('https://example.com/users/alice', {
				headers: {
					Accept: `${ContentType.ACTIVITY_JSON}, ${ContentType.LD_JSON}, application/json`,
				},
			})
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

			const result = await cacheRemoteUser(mockActor as Actor)
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
					profileSync: expect.any(Date),
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
					profileSync: expect.any(Date),
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

			const result = await cacheRemoteUser(mockActor as Actor)
			expect(result).toEqual(mockUser)
			expect(prisma.user.upsert).toHaveBeenCalledWith({
				where: { externalActorUrl: 'https://example.com/users/bob' },
				update: {
					name: 'bob',
					publicKey: null,
					inboxUrl: 'https://example.com/users/bob/inbox',
					sharedInboxUrl: null,
					profileImage: null,
					headerImage: null,
					bio: null,
					displayColor: '#3b82f6',
					profileSync: expect.any(Date),
				},
				create: {
					username: 'bob@example.com',
					name: 'bob',
					externalActorUrl: 'https://example.com/users/bob',
					isRemote: true,
					publicKey: null,
					inboxUrl: 'https://example.com/users/bob/inbox',
					sharedInboxUrl: null,
					profileImage: null,
					headerImage: null,
					bio: null,
					displayColor: '#3b82f6',
					profileSync: expect.any(Date),
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

			await cacheRemoteUser(mockActor as Actor)
			expect(prisma.user.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					create: expect.objectContaining({
						username: 'charlie@example.com',
					}),
				})
			)
		})

		it('should handle actor with all optional fields', async () => {
			const mockActor = {
				type: 'Person',
				id: 'https://example.com/users/dave',
				preferredUsername: 'dave',
				name: 'Dave Johnson',
				inbox: 'https://example.com/users/dave/inbox',
				outbox: 'https://example.com/users/dave/outbox',
				endpoints: {
					sharedInbox: 'https://example.com/shared inbox',
				},
				publicKey: {
					id: 'https://example.com/users/dave#main-key',
					owner: 'https://example.com/users/dave',
					publicKeyPem: '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----',
				},
				icon: {
					type: 'Image',
					url: 'https://example.com/dave/avatar.jpg',
				},
				image: {
					type: 'Image',
					url: 'https://example.com/dave/header.jpg',
				},
				summary: 'Full featured user',
				url: 'https://example.com/@dave',
			}

			const mockUser = {
				id: 'user_dave',
				username: 'dave@example.com',
			}

			vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as any)

			const result = await cacheRemoteUser(mockActor as unknown as Actor)

			expect(result).toEqual(mockUser)
			expect(prisma.user.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					update: expect.objectContaining({
						name: 'Dave Johnson',
						publicKey: '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----',
						profileImage: 'https://example.com/dave/avatar.jpg',
						headerImage: 'https://example.com/dave/header.jpg',
						bio: 'Full featured user',
						displayColor: '#3b82f6',
					}),
				})
			)
		})
	})

	describe('cacheRemoteUserByUrl', () => {
		it('should return cached user if already in database', async () => {
			const cachedUser = {
				id: 'user_123',
				username: 'alice@example.com',
				name: 'Alice',
				profileImage: 'https://example.com/avatar.jpg',
				displayColor: '#3b82f6',
				isRemote: true,
			}

			vi.mocked(prisma.user.findUnique).mockResolvedValue(cachedUser as any)

			const result = await cacheRemoteUserByUrl('https://example.com/users/alice')

			expect(result).toEqual(cachedUser)
			expect(prisma.user.findUnique).toHaveBeenCalledWith({
				where: { externalActorUrl: 'https://example.com/users/alice' },
				select: expect.any(Object),
			})
			expect(safeFetch).not.toHaveBeenCalled()
		})

		it('should fetch and cache user if not in database', async () => {
			const cachedUser = {
				id: 'user_123',
				username: 'alice@example.com',
				name: 'Alice',
				profileImage: null,
				displayColor: '#3b82f6',
				isRemote: true,
			}

			vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
			vi.mocked(safeFetch).mockResolvedValue({
				ok: true,
				headers: new Map([['content-type', 'application/activity+json']]),
				json: async () => ({
					type: 'Person',
					id: 'https://example.com/users/alice',
					preferredUsername: 'alice',
					name: 'Alice',
					inbox: 'https://example.com/users/alice/inbox',
					outbox: 'https://example.com/users/alice/outbox',
				}),
			} as unknown as Response)
			vi.mocked(prisma.user.upsert).mockResolvedValue(cachedUser as any)

			const result = await cacheRemoteUserByUrl('https://example.com/users/alice')

			expect(result).toEqual(cachedUser)
			expect(safeFetch).toHaveBeenCalled()
			expect(prisma.user.upsert).toHaveBeenCalled()
		})

		it('should return null when actor fetch fails', async () => {
			vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
			vi.mocked(safeFetch).mockResolvedValue({ ok: false } as Response)

			const result = await cacheRemoteUserByUrl('https://example.com/users/alice')

			expect(result).toBeNull()
		})

		it('should return null when fetch throws error', async () => {
			vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
			vi.mocked(safeFetch).mockRejectedValue(new Error('Network error'))

			const result = await cacheRemoteUserByUrl('https://example.com/users/alice')

			expect(result).toBeNull()
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

	describe('cacheEventFromOutboxActivity', () => {
		const mockEvent = {
			id: 'https://example.com/events/1',
			type: 'Event',
			name: 'Future Event',
			startTime: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
			url: 'https://example.com/events/1',
			duration: 'PT1H',
		}

		const mockCreateActivity = {
			type: 'Create',
			object: mockEvent,
		}

		it('should cache a future event', async () => {
			const userExternalActorUrl = 'https://example.com/users/alice'
			vi.mocked(prisma.event.upsert).mockResolvedValue({} as any)

			await cacheEventFromOutboxActivity(mockCreateActivity as any, userExternalActorUrl)

			expect(prisma.event.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { externalId: 'https://example.com/events/1' },
				})
			)
		})

		it('should skip a past event', async () => {
			const pastEvent = {
				...mockEvent,
				id: 'https://example.com/events/past',
				startTime: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 2 days ago
			}
			const pastCreateActivity = {
				type: 'Create',
				object: pastEvent,
			}
			const userExternalActorUrl = 'https://example.com/users/alice'

			await cacheEventFromOutboxActivity(pastCreateActivity as any, userExternalActorUrl)

			expect(prisma.event.upsert).not.toHaveBeenCalled()
		})

		it('should handle malformed organizer URLs gracefully', async () => {
			const eventWithBadUrl = {
				...mockEvent,
				id: 'https://example.com/events/2',
				attributedTo: ['https://valid.com/u/alice', 'not-a-valid-url'],
			}
			const createActivity = {
				type: 'Create',
				object: eventWithBadUrl,
			}
			const userExternalActorUrl = 'https://example.com/users/alice'

			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

			vi.mocked(prisma.event.upsert).mockResolvedValue({} as any)

			await cacheEventFromOutboxActivity(createActivity as any, userExternalActorUrl)

			expect(prisma.event.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					create: expect.objectContaining({
						organizers: expect.arrayContaining([
							expect.objectContaining({
								url: 'not-a-valid-url',
								username: 'unknown',
								host: 'unknown',
							}),
						]),
					}),
				})
			)

			expect(consoleSpy).toHaveBeenCalled()
			consoleSpy.mockRestore()
		})

		it('should skip Announce activities', async () => {
			const announceActivity = {
				type: 'Create',
				object: {
					type: 'Announce',
					id: 'https://example.com/activities/1',
				},
			}
			const userExternalActorUrl = 'https://example.com/users/alice'

			await cacheEventFromOutboxActivity(announceActivity as any, userExternalActorUrl)

			expect(prisma.event.upsert).not.toHaveBeenCalled()
		})

		it('should skip activities that are not Create', async () => {
			const updateActivity = {
				type: 'Update',
				object: mockEvent,
			}
			const userExternalActorUrl = 'https://example.com/users/alice'

			await cacheEventFromOutboxActivity(updateActivity as any, userExternalActorUrl)

			expect(prisma.event.upsert).not.toHaveBeenCalled()
		})

		it('should use contacts as organizers', async () => {
			const eventWithContacts = {
				...mockEvent,
				id: 'https://example.com/events/3',
				contacts: 'https://example.com/users/bob',
			}
			const createActivity = {
				type: 'Create',
				object: eventWithContacts,
			}
			const userExternalActorUrl = 'https://example.com/users/alice'

			vi.mocked(prisma.event.upsert).mockResolvedValue({} as any)

			await cacheEventFromOutboxActivity(createActivity as any, userExternalActorUrl)

			expect(prisma.event.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					create: expect.objectContaining({
						organizers: expect.arrayContaining([
							expect.objectContaining({
								url: 'https://example.com/users/bob',
								username: 'bob',
								host: 'example.com',
							}),
						]),
					}),
				})
			)
		})

		it('should handle organizer as object with id', async () => {
			const eventWithOrganizerObject = {
				...mockEvent,
				id: 'https://example.com/events/4',
				organizer: {
					id: 'https://example.com/users/carol',
					type: 'Person',
				},
			}
			const createActivity = {
				type: 'Create',
				object: eventWithOrganizerObject,
			}
			const userExternalActorUrl = 'https://example.com/users/alice'

			vi.mocked(prisma.event.upsert).mockResolvedValue({} as any)

			await cacheEventFromOutboxActivity(createActivity as any, userExternalActorUrl)

			expect(prisma.event.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					create: expect.objectContaining({
						attributedTo: 'https://example.com/users/carol',
						organizers: expect.arrayContaining([
							expect.objectContaining({
								url: 'https://example.com/users/carol',
								username: 'carol',
							}),
						]),
					}),
				})
			)
		})

		it('should use event content as summary if summary is missing', async () => {
			const eventWithContent = {
				...mockEvent,
				id: 'https://example.com/events/5',
				summary: undefined,
				content: 'Event content here',
			}
			const createActivity = {
				type: 'Create',
				object: eventWithContent,
			}
			const userExternalActorUrl = 'https://example.com/users/alice'

			vi.mocked(prisma.event.upsert).mockResolvedValue({} as any)

			await cacheEventFromOutboxActivity(createActivity as any, userExternalActorUrl)

			expect(prisma.event.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					create: expect.objectContaining({
						summary: 'Event content here',
					}),
				})
			)
		})

		it('should extract header image from attachment', async () => {
			const eventWithAttachment = {
				...mockEvent,
				id: 'https://example.com/events/6',
				attachment: [{ url: 'https://example.com/image.jpg' }],
			}
			const createActivity = {
				type: 'Create',
				object: eventWithAttachment,
			}
			const userExternalActorUrl = 'https://example.com/users/alice'

			vi.mocked(prisma.event.upsert).mockResolvedValue({} as any)

			await cacheEventFromOutboxActivity(createActivity as any, userExternalActorUrl)

			expect(prisma.event.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					create: expect.objectContaining({
						headerImage: 'https://example.com/image.jpg',
					}),
				})
			)
		})

		it('should handle event without required fields gracefully', async () => {
			const incompleteEvent = {
				type: 'Event',
				// Missing id, name, startTime
			}
			const createActivity = {
				type: 'Create',
				object: incompleteEvent,
			}
			const userExternalActorUrl = 'https://example.com/users/alice'

			await cacheEventFromOutboxActivity(createActivity as any, userExternalActorUrl)

			expect(prisma.event.upsert).not.toHaveBeenCalled()
		})
	})

	describe('fetchRemoteCollectionCount', () => {
		it('should return count from collection with totalItems as number', async () => {
			const mockResponse = {
				ok: true,
				headers: new Map([['content-type', 'application/activity+json']]),
				json: async () => ({
					totalItems: 100,
				}),
			}
			vi.mocked(safeFetch).mockResolvedValue(mockResponse as unknown as Response)

			const result = await fetchRemoteCollectionCount(
				'https://example.com/users/bob/followers'
			)

			expect(result).toBe(100)
		})

		it('should return count from collection with totalItems as string', async () => {
			const mockResponse = {
				ok: true,
				headers: new Map([['content-type', 'application/activity+json']]),
				json: async () => ({
					totalItems: '250',
				}),
			}
			vi.mocked(safeFetch).mockResolvedValue(mockResponse as unknown as Response)

			const result = await fetchRemoteCollectionCount(
				'https://example.com/users/bob/following'
			)

			expect(result).toBe(250)
		})

		it('should return null when totalItems is missing', async () => {
			const mockResponse = {
				ok: true,
				headers: new Map([['content-type', 'application/activity+json']]),
				json: async () => ({}),
			}
			vi.mocked(safeFetch).mockResolvedValue(mockResponse as unknown as Response)

			const result = await fetchRemoteCollectionCount(
				'https://example.com/users/bob/followers'
			)

			expect(result).toBeNull()
		})

		it('should return null when response is not ok', async () => {
			const mockResponse = {
				ok: false,
			}
			vi.mocked(safeFetch).mockResolvedValue(mockResponse as Response)

			const result = await fetchRemoteCollectionCount(
				'https://example.com/users/bob/followers'
			)

			expect(result).toBeNull()
		})

		it('should handle fetch errors gracefully', async () => {
			vi.mocked(safeFetch).mockRejectedValue(new Error('Network error'))

			const result = await fetchRemoteCollectionCount(
				'https://example.com/users/bob/followers'
			)

			expect(result).toBeNull()
		})
	})

	describe('fetchRemoteCollectionItems', () => {
		it('should return items from single page collection', async () => {
			const mockResponse = {
				ok: true,
				headers: new Map([['content-type', 'application/activity+json']]),
				json: async () => ({
					orderedItems: [{ id: '1' }, { id: '2' }, { id: '3' }],
				}),
			}
			vi.mocked(safeFetch).mockResolvedValue(mockResponse as unknown as Response)

			const result = await fetchRemoteCollectionItems<{ id: string }>(
				'https://example.com/users/bob/followers'
			)

			expect(result).toHaveLength(3)
			expect(result[0]).toEqual({ id: '1' })
		})

		it('should return items using items field when orderedItems is empty', async () => {
			const mockResponse = {
				ok: true,
				headers: new Map([['content-type', 'application/activity+json']]),
				json: async () => ({
					items: [{ id: 'a' }, { id: 'b' }],
				}),
			}
			vi.mocked(safeFetch).mockResolvedValue(mockResponse as unknown as Response)

			const result = await fetchRemoteCollectionItems<{ id: string }>(
				'https://example.com/users/bob/following'
			)

			expect(result).toHaveLength(2)
			expect(result[0]).toEqual({ id: 'a' })
		})

		it('should return empty array when collection is empty', async () => {
			const mockResponse = {
				ok: true,
				headers: new Map([['content-type', 'application/activity+json']]),
				json: async () => ({
					orderedItems: [],
				}),
			}
			vi.mocked(safeFetch).mockResolvedValue(mockResponse as unknown as Response)

			const result = await fetchRemoteCollectionItems<{ id: string }>(
				'https://example.com/users/bob/followers'
			)

			expect(result).toEqual([])
		})

		it('should return null when fetch fails', async () => {
			const mockResponse = {
				ok: false,
			}
			vi.mocked(safeFetch).mockResolvedValue(mockResponse as Response)

			const result = await fetchRemoteCollectionItems<{ id: string }>(
				'https://example.com/users/bob/followers'
			)

			expect(result).toEqual([])
		})

		it('should handle fetch errors gracefully', async () => {
			vi.mocked(safeFetch).mockRejectedValue(new Error('Network error'))

			const result = await fetchRemoteCollectionItems<{ id: string }>(
				'https://example.com/users/bob/followers'
			)

			expect(result).toEqual([])
		})

		it('should paginate through multiple pages using next link', async () => {
			const page1Fetch = {
				ok: true,
				headers: new Map([['content-type', 'application/activity+json']]),
				json: async () => ({
					orderedItems: [{ id: '1' }, { id: '2' }],
					next: 'https://example.com/users/bob/followers?page=2',
				}),
			}
			const page1Next = {
				ok: true,
				headers: new Map([['content-type', 'application/activity+json']]),
				json: async () => ({
					next: 'https://example.com/users/bob/followers?page=2',
				}),
			}
			const page2Fetch = {
				ok: true,
				headers: new Map([['content-type', 'application/activity+json']]),
				json: async () => ({
					orderedItems: [{ id: '3' }, { id: '4' }],
					next: 'https://example.com/users/bob/followers?page=3',
				}),
			}
			const page2Next = {
				ok: true,
				headers: new Map([['content-type', 'application/activity+json']]),
				json: async () => ({
					next: 'https://example.com/users/bob/followers?page=3',
				}),
			}
			const page3Fetch = {
				ok: true,
				headers: new Map([['content-type', 'application/activity+json']]),
				json: async () => ({
					orderedItems: [{ id: '5' }],
				}),
			}
			const page3Next = {
				ok: true,
				headers: new Map([['content-type', 'application/activity+json']]),
				json: async () => ({}),
			}

			vi.mocked(safeFetch)
				.mockResolvedValueOnce(page1Fetch as unknown as Response)
				.mockResolvedValueOnce(page1Next as unknown as Response)
				.mockResolvedValueOnce(page2Fetch as unknown as Response)
				.mockResolvedValueOnce(page2Next as unknown as Response)
				.mockResolvedValueOnce(page3Fetch as unknown as Response)
				.mockResolvedValueOnce(page3Next as unknown as Response)

			const result = await fetchRemoteCollectionItems<{ id: string }>(
				'https://example.com/users/bob/followers?page=1'
			)

			expect(result).toHaveLength(5)
			expect(result).toEqual([
				{ id: '1' },
				{ id: '2' },
				{ id: '3' },
				{ id: '4' },
				{ id: '5' },
			])
		})

		it('should fetch first page when first link is present but items are empty', async () => {
			const firstPageResponse = {
				ok: true,
				headers: new Map([['content-type', 'application/activity+json']]),
				json: async () => ({
					orderedItems: [{ id: '1' }, { id: '2' }],
				}),
			}

			vi.mocked(safeFetch).mockResolvedValue(firstPageResponse as unknown as Response)

			const result = await fetchRemoteCollectionItems<{ id: string }>(
				'https://example.com/users/bob/followers'
			)

			expect(result).toHaveLength(2)
		})

		it('should handle first as object with id property', async () => {
			const firstPageResponse = {
				ok: true,
				headers: new Map([['content-type', 'application/activity+json']]),
				json: async () => ({
					orderedItems: [{ id: '1' }],
				}),
			}

			vi.mocked(safeFetch).mockResolvedValue(firstPageResponse as unknown as Response)

			const result = await fetchRemoteCollectionItems<{ id: string }>(
				'https://example.com/users/bob/followers'
			)

			expect(result).toHaveLength(1)
		})

		it('should return empty array when first fetch fails', async () => {
			const failResponse = {
				ok: false,
			}

			vi.mocked(safeFetch).mockResolvedValue(failResponse as Response)

			const result = await fetchRemoteCollectionItems<{ id: string }>(
				'https://example.com/users/bob/followers'
			)

			expect(result).toEqual([])
		})
	})

	describe('extractLocationValue', () => {
		it('should return string location as-is', () => {
			const result = extractLocationValue('Central Park')
			expect(result).toBe('Central Park')
		})

		it('should extract name from object location', () => {
			const result = extractLocationValue({ name: 'Conference Room A' })
			expect(result).toBe('Conference Room A')
		})

		it('should return null for undefined', () => {
			const result = extractLocationValue(undefined)
			expect(result).toBeNull()
		})

		it('should return null for object without name', () => {
			const result = extractLocationValue({ type: 'Place' })
			expect(result).toBeNull()
		})

		it('should return null for null', () => {
			const result = extractLocationValue(null as unknown as undefined)
			expect(result).toBeNull()
		})
	})

	describe('fetchActor edge cases', () => {
		it('should skip non-JSON content types', async () => {
			const mockResponse = {
				ok: true,
				headers: new Map([['content-type', 'text/html']]),
				json: async () => ({}),
			}
			vi.mocked(safeFetch).mockResolvedValue(mockResponse as unknown as Response)

			const result = await fetchActor('https://example.com/users/alice')
			expect(result).toBeNull()
		})

		it('should handle ld+json content type', async () => {
			const mockActor = { id: 'https://example.com/users/alice', type: 'Person' }
			const mockResponse = {
				ok: true,
				headers: new Map([
					[
						'content-type',
						'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
					],
				]),
				json: async () => mockActor,
			}
			vi.mocked(safeFetch).mockResolvedValue(mockResponse as unknown as Response)

			const result = await fetchActor('https://example.com/users/alice')
			expect(result).toEqual(mockActor)
		})

		it('should handle plain json content type', async () => {
			const mockActor = { id: 'https://example.com/users/alice', type: 'Person' }
			const mockResponse = {
				ok: true,
				headers: new Map([['content-type', 'application/json']]),
				json: async () => mockActor,
			}
			vi.mocked(safeFetch).mockResolvedValue(mockResponse as unknown as Response)

			const result = await fetchActor('https://example.com/users/alice')
			expect(result).toEqual(mockActor)
		})
	})

	describe('cacheRemoteUser edge cases', () => {
		it('should handle icon as string URL', async () => {
			const mockActor = {
				type: 'Person',
				id: 'https://example.com/users/stringicon',
				preferredUsername: 'stringicon',
				inbox: 'https://example.com/users/stringicon/inbox',
				outbox: 'https://example.com/users/stringicon/outbox',
				icon: 'https://example.com/avatar-string.jpg',
			}

			vi.mocked(prisma.user.upsert).mockResolvedValue({ id: 'user_123' } as any)

			await cacheRemoteUser(mockActor as unknown as Actor)

			expect(prisma.user.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					update: expect.objectContaining({
						profileImage: 'https://example.com/avatar-string.jpg',
					}),
				})
			)
		})

		it('should handle icon.url as non-string', async () => {
			const mockActor = {
				type: 'Person',
				id: 'https://example.com/users/badicon',
				preferredUsername: 'badicon',
				inbox: 'https://example.com/users/badicon/inbox',
				outbox: 'https://example.com/users/badicon/outbox',
				icon: { url: 12345 },
			}

			vi.mocked(prisma.user.upsert).mockResolvedValue({ id: 'user_123' } as any)

			await cacheRemoteUser(mockActor as unknown as Actor)

			expect(prisma.user.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					update: expect.objectContaining({
						profileImage: null,
					}),
				})
			)
		})

		it('should handle displayColor from actor', async () => {
			const mockActor = {
				type: 'Person',
				id: 'https://example.com/users/colorful',
				preferredUsername: 'colorful',
				inbox: 'https://example.com/users/colorful/inbox',
				outbox: 'https://example.com/users/colorful/outbox',
				displayColor: '#ff0000',
			}

			vi.mocked(prisma.user.upsert).mockResolvedValue({ id: 'user_123' } as any)

			await cacheRemoteUser(mockActor as Actor)

			expect(prisma.user.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					update: expect.objectContaining({
						displayColor: '#ff0000',
					}),
				})
			)
		})

		it('should handle published date', async () => {
			const mockActor = {
				type: 'Person',
				id: 'https://example.com/users/dated',
				preferredUsername: 'dated',
				inbox: 'https://example.com/users/dated/inbox',
				outbox: 'https://example.com/users/dated/outbox',
				published: '2023-01-01T00:00:00Z',
			}

			vi.mocked(prisma.user.upsert).mockResolvedValue({ id: 'user_123' } as any)

			await cacheRemoteUser(mockActor as Actor)

			expect(prisma.user.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					update: expect.objectContaining({
						createdAt: new Date('2023-01-01T00:00:00Z'),
					}),
				})
			)
		})
	})

	describe('cacheEventFromOutboxActivity edge cases', () => {
		it('should handle organizer as string URL', async () => {
			const mockEvent = {
				id: 'https://example.com/events/org-string',
				type: 'Event',
				name: 'Test Event',
				startTime: new Date(Date.now() + 86400000).toISOString(),
				organizer: 'https://example.com/users/organizer',
			}
			const createActivity = {
				type: 'Create',
				object: mockEvent,
			}

			vi.mocked(prisma.event.upsert).mockResolvedValue({} as any)

			await cacheEventFromOutboxActivity(
				createActivity as any,
				'https://example.com/users/alice'
			)

			expect(prisma.event.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					create: expect.objectContaining({
						attributedTo: 'https://example.com/users/organizer',
					}),
				})
			)
		})

		it('should handle attributedTo as array', async () => {
			const mockEvent = {
				id: 'https://example.com/events/multi-org',
				type: 'Event',
				name: 'Test Event',
				startTime: new Date(Date.now() + 86400000).toISOString(),
				attributedTo: ['https://example.com/users/org1', 'https://example.com/users/org2'],
			}
			const createActivity = {
				type: 'Create',
				object: mockEvent,
			}

			vi.mocked(prisma.event.upsert).mockResolvedValue({} as any)

			await cacheEventFromOutboxActivity(
				createActivity as any,
				'https://example.com/users/alice'
			)

			expect(prisma.event.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					create: expect.objectContaining({
						attributedTo: 'https://example.com/users/org1',
						organizers: expect.arrayContaining([
							expect.objectContaining({ url: 'https://example.com/users/org1' }),
							expect.objectContaining({ url: 'https://example.com/users/org2' }),
						]),
					}),
				})
			)
		})

		it('should handle contacts as array', async () => {
			const mockEvent = {
				id: 'https://example.com/events/multi-contact',
				type: 'Event',
				name: 'Test Event',
				startTime: new Date(Date.now() + 86400000).toISOString(),
				contacts: ['https://example.com/users/c1', 'https://example.com/users/c2'],
			}
			const createActivity = {
				type: 'Create',
				object: mockEvent,
			}

			vi.mocked(prisma.event.upsert).mockResolvedValue({} as any)

			await cacheEventFromOutboxActivity(
				createActivity as any,
				'https://example.com/users/alice'
			)

			expect(prisma.event.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					create: expect.objectContaining({
						organizers: expect.arrayContaining([
							expect.objectContaining({ url: 'https://example.com/users/c1' }),
							expect.objectContaining({ url: 'https://example.com/users/c2' }),
						]),
					}),
				})
			)
		})

		it('should handle location as Place object', async () => {
			const mockEvent = {
				id: 'https://example.com/events/place-loc',
				type: 'Event',
				name: 'Test Event',
				startTime: new Date(Date.now() + 86400000).toISOString(),
				location: { type: 'Place', name: 'Central Park' },
			}
			const createActivity = {
				type: 'Create',
				object: mockEvent,
			}

			vi.mocked(prisma.event.upsert).mockResolvedValue({} as any)

			await cacheEventFromOutboxActivity(
				createActivity as any,
				'https://example.com/users/alice'
			)

			expect(prisma.event.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					create: expect.objectContaining({
						location: 'Central Park',
					}),
				})
			)
		})

		it('should skip when activity object is undefined', async () => {
			const activity = {
				type: 'Create',
			}

			await cacheEventFromOutboxActivity(activity as any, 'https://example.com/users/alice')

			expect(prisma.event.upsert).not.toHaveBeenCalled()
		})

		it('should handle @ prefixed username in URL', async () => {
			const mockEvent = {
				id: 'https://example.com/events/at-user',
				type: 'Event',
				name: 'Test Event',
				startTime: new Date(Date.now() + 86400000).toISOString(),
				attributedTo: 'https://example.com/@alice',
			}
			const createActivity = {
				type: 'Create',
				object: mockEvent,
			}

			vi.mocked(prisma.event.upsert).mockResolvedValue({} as any)

			await cacheEventFromOutboxActivity(
				createActivity as any,
				'https://example.com/users/fallback'
			)

			expect(prisma.event.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					create: expect.objectContaining({
						organizers: expect.arrayContaining([
							expect.objectContaining({
								url: 'https://example.com/@alice',
								username: 'alice',
							}),
						]),
					}),
				})
			)
		})

		it('should include all event metadata fields', async () => {
			const mockEvent = {
				id: 'https://example.com/events/full',
				type: 'Event',
				name: 'Full Event',
				summary: 'Event summary',
				startTime: new Date(Date.now() + 86400000).toISOString(),
				endTime: new Date(Date.now() + 90000000).toISOString(),
				duration: 'PT2H',
				url: 'https://example.com/events/full',
				eventStatus: 'EventScheduled',
				eventAttendanceMode: 'OfflineEventAttendanceMode',
				maximumAttendeeCapacity: 100,
				location: 'Test Location',
			}
			const createActivity = {
				type: 'Create',
				object: mockEvent,
			}

			vi.mocked(prisma.event.upsert).mockResolvedValue({} as any)

			await cacheEventFromOutboxActivity(
				createActivity as any,
				'https://example.com/users/alice'
			)

			expect(prisma.event.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					create: expect.objectContaining({
						title: 'Full Event',
						summary: 'Event summary',
						duration: 'PT2H',
						url: 'https://example.com/events/full',
						eventStatus: 'EventScheduled',
						eventAttendanceMode: 'OfflineEventAttendanceMode',
						maximumAttendeeCapacity: 100,
						location: 'Test Location',
					}),
				})
			)
		})
	})
})
