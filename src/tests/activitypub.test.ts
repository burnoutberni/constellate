/**
 * Tests for ActivityPub Endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { config } from 'dotenv'
config()
import { Hono } from 'hono'
import activitypubApp from '../activitypub.js'
import { prisma } from '../lib/prisma.js'
import * as activitypubHelpers from '../lib/activitypubHelpers.js'
import * as httpSignature from '../lib/httpSignature.js'
import * as federation from '../federation.js'

// Mock dependencies
vi.mock('../lib/activitypubHelpers.js')
vi.mock('../lib/httpSignature.js')
vi.mock('../federation.js')

// Create test app
const app = new Hono()
app.route('/', activitypubApp)

describe('ActivityPub API', () => {
    let testUser: any
    let testEvent: any
    const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000'

    beforeEach(async () => {
        // Clean up
        await prisma.processedActivity.deleteMany({})
        await prisma.eventAttendance.deleteMany({})
        await prisma.eventLike.deleteMany({})
        await prisma.comment.deleteMany({})
        await prisma.follower.deleteMany({})
        await prisma.following.deleteMany({})
        await prisma.event.deleteMany({})
        await prisma.user.deleteMany({})

        // Create test user
        const timestamp = Date.now()
        testUser = await prisma.user.create({
            data: {
                username: `alice_${timestamp}`,
                email: `alice_${timestamp}@test.com`,
                name: 'Alice Test',
                isRemote: false,
            },
        })

        // Create test event
        testEvent = await prisma.event.create({
            data: {
                title: 'Test Event',
                summary: 'Test event description',
                startTime: new Date(Date.now() + 86400000),
                endTime: new Date(Date.now() + 86400000 + 3600000),
                userId: testUser.id,
                attributedTo: `${baseUrl}/users/${testUser.username}`,
            },
        })

        // Reset mocks
        vi.clearAllMocks()
        vi.mocked(activitypubHelpers.getBaseUrl).mockReturnValue(baseUrl)
    })

    describe('GET /.well-known/webfinger', () => {
        it('should return WebFinger data for user', async () => {
            const res = await app.request(`/.well-known/webfinger?resource=acct:${testUser.username}@${new URL(baseUrl).hostname}`)

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.subject).toBe(`acct:${testUser.username}@${new URL(baseUrl).hostname}`)
            expect(body.aliases).toContain(`${baseUrl}/users/${testUser.username}`)
            expect(body.links).toBeDefined()
        })

        it('should return 400 when resource parameter is missing', async () => {
            const res = await app.request('/.well-known/webfinger')

            expect(res.status).toBe(400)
            const body = await res.json() as any as any
            expect(body.error).toBe('Missing resource parameter')
        })

        it('should return 400 when resource format is invalid', async () => {
            const res = await app.request('/.well-known/webfinger?resource=invalid-format')

            expect(res.status).toBe(400)
            const body = await res.json() as any as any
            expect(body.error).toBe('Invalid resource format')
        })

        it('should return 404 when domain mismatch', async () => {
            const res = await app.request(`/.well-known/webfinger?resource=acct:${testUser.username}@wrong-domain.com`)

            expect(res.status).toBe(404)
            const body = await res.json() as any as any
            expect(body.error).toBe('Domain mismatch')
        })

        it('should return 404 when user not found', async () => {
            const res = await app.request(`/.well-known/webfinger?resource=acct:nonexistent@${new URL(baseUrl).hostname}`)

            expect(res.status).toBe(404)
            const body = await res.json() as any as any
            expect(body.error).toBe('User not found')
        })

        it('should handle errors gracefully', async () => {
            const originalFindUnique = prisma.user.findUnique
            vi.spyOn(prisma.user, 'findUnique').mockRejectedValueOnce(new Error('Database error'))

            const res = await app.request(`/.well-known/webfinger?resource=acct:${testUser.username}@${new URL(baseUrl).hostname}`)

            expect(res.status).toBe(500)

            // Restore
            prisma.user.findUnique = originalFindUnique
        })
    })

    describe('GET /.well-known/nodeinfo', () => {
        it('should return nodeinfo links', async () => {
            const res = await app.request('/.well-known/nodeinfo')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.links).toBeDefined()
            expect(body.links[0].rel).toBe('http://nodeinfo.diaspora.software/ns/schema/2.0')
        })
    })

    describe('GET /nodeinfo/2.0', () => {
        it('should return nodeinfo data', async () => {
            const res = await app.request('/nodeinfo/2.0')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.version).toBe('2.0')
            expect(body.software.name).toBe('constellate')
            expect(body.protocols).toContain('activitypub')
            expect(body.usage).toBeDefined()
            expect(body.metadata).toBeDefined()
        })
    })

    describe('GET /users/:username', () => {
        it('should return actor data for user', async () => {
            const res = await app.request(`/users/${testUser.username}`)

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.type).toBe('Person')
            expect(body.id).toBe(`${baseUrl}/users/${testUser.username}`)
            expect(body.preferredUsername).toBe(testUser.username)
            expect(body.inbox).toBe(`${baseUrl}/users/${testUser.username}/inbox`)
            expect(body.outbox).toBe(`${baseUrl}/users/${testUser.username}/outbox`)
        })

        it('should generate keys if user does not have them', async () => {
            // Create user without keys
            const userWithoutKeys = await prisma.user.create({
                data: {
                    username: `nokeys_${Date.now()}`,
                    email: `nokeys_${Date.now()}@test.com`,
                    name: 'No Keys User',
                    isRemote: false,
                    publicKey: null,
                    privateKey: null,
                },
            })

            const res = await app.request(`/users/${userWithoutKeys.username}`)

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.publicKey).toBeDefined()
            expect(body.publicKey.publicKeyPem).toBeDefined()

            // Verify keys were saved
            const updatedUser = await prisma.user.findUnique({
                where: { id: userWithoutKeys.id },
            })
            expect(updatedUser?.publicKey).toBeDefined()
            expect(updatedUser?.privateKey).toBeDefined()
        })

        it('should return 404 when user not found', async () => {
            const res = await app.request('/users/nonexistent')

            expect(res.status).toBe(404)
            const body = await res.json() as any as any
            expect(body.error).toBe('User not found')
        })

        it('should include optional fields when present', async () => {
            await prisma.user.update({
                where: { id: testUser.id },
                data: {
                    bio: 'Test bio',
                    profileImage: 'https://example.com/image.jpg',
                    headerImage: 'https://example.com/header.jpg',
                    displayColor: '#FF0000',
                },
            })

            const res = await app.request(`/users/${testUser.username}`)

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.summary).toBe('Test bio')
            expect(body.icon).toBeDefined()
            expect(body.image).toBeDefined()
            expect(body.displayColor).toBe('#FF0000')
        })

        it('should handle errors gracefully', async () => {
            const originalFindUnique = prisma.user.findUnique
            vi.spyOn(prisma.user, 'findUnique').mockRejectedValueOnce(new Error('Database error'))

            const res = await app.request(`/users/${testUser.username}`)

            expect(res.status).toBe(500)

            // Restore
            prisma.user.findUnique = originalFindUnique
        })
    })

    describe('GET /users/:username/followers', () => {
        it('should return followers collection', async () => {
            const res = await app.request(`/users/${testUser.username}/followers`)

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.type).toBe('OrderedCollection')
            expect(body.totalItems).toBeDefined()
        })

        it('should return followers page when page parameter provided', async () => {
            // Create followers
            const followerUser = await prisma.user.create({
                data: {
                    username: `follower_${Date.now()}`,
                    email: `follower_${Date.now()}@test.com`,
                    isRemote: false,
                },
            })

            await prisma.follower.create({
                data: {
                    userId: testUser.id,
                    actorUrl: `${baseUrl}/users/${followerUser.username}`,
                    username: followerUser.username,
                    inboxUrl: `${baseUrl}/users/${followerUser.username}/inbox`,
                    accepted: true,
                },
            })

            const res = await app.request(`/users/${testUser.username}/followers?page=1`)

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.type).toBe('OrderedCollectionPage')
            expect(body.orderedItems).toBeDefined()
        })

        it('should return 404 when user not found', async () => {
            const res = await app.request('/users/nonexistent/followers')

            expect(res.status).toBe(404)
        })

        it('should handle pagination correctly', async () => {
            // Create multiple followers
            for (let i = 0; i < 5; i++) {
                const followerUser = await prisma.user.create({
                    data: {
                        username: `follower${i}_${Date.now()}`,
                        email: `follower${i}_${Date.now()}@test.com`,
                        isRemote: false,
                    },
                })

                await prisma.follower.create({
                    data: {
                        userId: testUser.id,
                        actorUrl: `${baseUrl}/users/${followerUser.username}`,
                        username: followerUser.username,
                        inboxUrl: `${baseUrl}/users/${followerUser.username}/inbox`,
                        accepted: true,
                    },
                })
            }

            const res = await app.request(`/users/${testUser.username}/followers?page=1`)

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.orderedItems.length).toBeGreaterThan(0)
        })

        it('should handle errors gracefully', async () => {
            const originalFindUnique = prisma.user.findUnique
            vi.spyOn(prisma.user, 'findUnique').mockRejectedValueOnce(new Error('Database error'))

            const res = await app.request(`/users/${testUser.username}/followers`)

            expect(res.status).toBe(500)

            // Restore
            prisma.user.findUnique = originalFindUnique
        })
    })

    describe('GET /users/:username/following', () => {
        it('should return following collection', async () => {
            const res = await app.request(`/users/${testUser.username}/following`)

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.type).toBe('OrderedCollection')
            expect(body.totalItems).toBeDefined()
        })

        it('should return following page when page parameter provided', async () => {
            const followingUser = await prisma.user.create({
                data: {
                    username: `following_${Date.now()}`,
                    email: `following_${Date.now()}@test.com`,
                    isRemote: false,
                },
            })

            await prisma.following.create({
                data: {
                    userId: testUser.id,
                    actorUrl: `${baseUrl}/users/${followingUser.username}`,
                    username: followingUser.username,
                    inboxUrl: `${baseUrl}/users/${followingUser.username}/inbox`,
                    accepted: true,
                },
            })

            const res = await app.request(`/users/${testUser.username}/following?page=1`)

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.type).toBe('OrderedCollectionPage')
            expect(body.orderedItems).toBeDefined()
        })

        it('should return 404 when user not found', async () => {
            const res = await app.request('/users/nonexistent/following')

            expect(res.status).toBe(404)
        })

        it('should handle errors gracefully', async () => {
            const originalFindUnique = prisma.user.findUnique
            vi.spyOn(prisma.user, 'findUnique').mockRejectedValueOnce(new Error('Database error'))

            const res = await app.request(`/users/${testUser.username}/following`)

            expect(res.status).toBe(500)

            // Restore
            prisma.user.findUnique = originalFindUnique
        })
    })

    describe('GET /users/:username/outbox', () => {
        it('should return outbox collection', async () => {
            const res = await app.request(`/users/${testUser.username}/outbox`)

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.type).toBe('OrderedCollection')
            expect(body.totalItems).toBeDefined()
        })

        it('should return outbox page with events as Create activities', async () => {
            const res = await app.request(`/users/${testUser.username}/outbox?page=1`)

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.type).toBe('OrderedCollectionPage')
            expect(body.orderedItems).toBeDefined()
            if (body.orderedItems.length > 0) {
                expect(body.orderedItems[0].type).toBe('Create')
                expect(body.orderedItems[0].object.type).toBe('Event')
            }
        })

        it('should return 404 when user not found', async () => {
            const res = await app.request('/users/nonexistent/outbox')

            expect(res.status).toBe(404)
        })

        it('should handle pagination correctly', async () => {
            // Create multiple events
            for (let i = 0; i < 5; i++) {
                await prisma.event.create({
                    data: {
                        title: `Event ${i}`,
                        startTime: new Date(Date.now() + (i + 1) * 86400000),
                        userId: testUser.id,
                        attributedTo: `${baseUrl}/users/${testUser.username}`,
                    },
                })
            }

            const res = await app.request(`/users/${testUser.username}/outbox?page=1`)

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.orderedItems.length).toBeGreaterThan(0)
        })

        it('should handle errors gracefully', async () => {
            const originalFindUnique = prisma.user.findUnique
            vi.spyOn(prisma.user, 'findUnique').mockRejectedValueOnce(new Error('Database error'))

            const res = await app.request(`/users/${testUser.username}/outbox`)

            expect(res.status).toBe(500)

            // Restore
            prisma.user.findUnique = originalFindUnique
        })
    })

    describe('POST /users/:username/inbox', () => {
        it('should return 404 when user not found', async () => {
            const res = await app.request('/users/nonexistent/inbox', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'signature': 'test-signature',
                },
                body: JSON.stringify({
                    type: 'Follow',
                    actor: 'https://example.com/users/bob',
                    object: `${baseUrl}/users/nonexistent`,
                }),
            })

            expect(res.status).toBe(404)
        })

        it('should return 401 when signature is missing', async () => {
            const res = await app.request(`/users/${testUser.username}/inbox`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: 'Follow',
                    actor: 'https://example.com/users/bob',
                    object: `${baseUrl}/users/${testUser.username}`,
                }),
            })

            expect(res.status).toBe(401)
            const body = await res.json() as any as any
            expect(body.error).toBe('Missing signature')
        })

        it('should return 401 when signature is invalid', async () => {
            vi.mocked(httpSignature.verifySignature).mockResolvedValue(false)

            const res = await app.request(`/users/${testUser.username}/inbox`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'signature': 'invalid-signature',
                },
                body: JSON.stringify({
                    type: 'Follow',
                    actor: 'https://example.com/users/bob',
                    object: `${baseUrl}/users/${testUser.username}`,
                }),
            })

            expect(res.status).toBe(401)
            const body = await res.json() as any as any
            expect(body.error).toBe('Invalid signature')
        })

        it('should return 400 when activity is invalid', async () => {
            vi.mocked(httpSignature.verifySignature).mockResolvedValue(true)

            const res = await app.request(`/users/${testUser.username}/inbox`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'signature': 'valid-signature',
                },
                body: JSON.stringify({
                    type: 'InvalidActivity',
                    // Missing required fields
                }),
            })

            expect(res.status).toBe(400)
            const body = await res.json() as any as any
            expect(body.error).toBe('Invalid activity')
        })

        it('should accept valid activity', async () => {
            vi.mocked(httpSignature.verifySignature).mockResolvedValue(true)
            vi.mocked(federation.handleActivity).mockResolvedValue(undefined)

            const activity = {
                type: 'Follow',
                id: 'https://example.com/activities/1',
                actor: 'https://example.com/users/bob',
                object: `${baseUrl}/users/${testUser.username}`,
            }

            const res = await app.request(`/users/${testUser.username}/inbox`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'signature': 'valid-signature',
                },
                body: JSON.stringify(activity),
            })

            expect(res.status).toBe(202)
            const body = await res.json() as any as any
            expect(body.status).toBe('accepted')
        })

        it('should handle host header correction for reverse proxy', async () => {
            vi.mocked(httpSignature.verifySignature).mockResolvedValue(true)
            vi.mocked(federation.handleActivity).mockResolvedValue(undefined)

            const activity = {
                type: 'Follow',
                id: 'https://example.com/activities/1',
                actor: 'https://example.com/users/bob',
                object: `${baseUrl}/users/${testUser.username}`,
            }

            const res = await app.request(`/users/${testUser.username}/inbox`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'signature': 'valid-signature',
                    'host': 'localhost:3000', // Different from baseUrl hostname
                },
                body: JSON.stringify(activity),
            })

            expect(res.status).toBe(202)
        })

        it('should handle errors gracefully', async () => {
            const originalFindUnique = prisma.user.findUnique
            vi.spyOn(prisma.user, 'findUnique').mockRejectedValueOnce(new Error('Database error'))

            const res = await app.request(`/users/${testUser.username}/inbox`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'signature': 'test-signature',
                },
                body: JSON.stringify({
                    type: 'Follow',
                    actor: 'https://example.com/users/bob',
                    object: `${baseUrl}/users/${testUser.username}`,
                }),
            })

            expect(res.status).toBe(500)

            // Restore
            prisma.user.findUnique = originalFindUnique
        })
    })

    describe('POST /inbox (shared inbox)', () => {
        it('should return 401 when signature is missing', async () => {
            const res = await app.request('/inbox', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: 'Follow',
                    actor: 'https://example.com/users/bob',
                    object: `${baseUrl}/users/${testUser.username}`,
                }),
            })

            expect(res.status).toBe(401)
            const body = await res.json() as any as any
            expect(body.error).toBe('Missing signature')
        })

        it('should return 401 when signature is invalid', async () => {
            vi.mocked(httpSignature.verifySignature).mockResolvedValue(false)

            const res = await app.request('/inbox', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'signature': 'invalid-signature',
                },
                body: JSON.stringify({
                    type: 'Follow',
                    actor: 'https://example.com/users/bob',
                    object: `${baseUrl}/users/${testUser.username}`,
                }),
            })

            expect(res.status).toBe(401)
            const body = await res.json() as any as any
            expect(body.error).toBe('Invalid signature')
        })

        it('should return 400 when activity is invalid', async () => {
            vi.mocked(httpSignature.verifySignature).mockResolvedValue(true)

            const res = await app.request('/inbox', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'signature': 'valid-signature',
                },
                body: JSON.stringify({
                    type: 'InvalidActivity',
                }),
            })

            expect(res.status).toBe(400)
            const body = await res.json() as any as any
            expect(body.error).toBe('Invalid activity')
        })

        it('should accept valid activity', async () => {
            vi.mocked(httpSignature.verifySignature).mockResolvedValue(true)
            vi.mocked(federation.handleActivity).mockResolvedValue(undefined)

            const activity = {
                type: 'Follow',
                id: 'https://example.com/activities/1',
                actor: 'https://example.com/users/bob',
                object: `${baseUrl}/users/${testUser.username}`,
            }

            const res = await app.request('/inbox', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'signature': 'valid-signature',
                },
                body: JSON.stringify(activity),
            })

            expect(res.status).toBe(202)
            const body = await res.json() as any as any
            expect(body.status).toBe('accepted')
        })

        it('should handle host header correction for reverse proxy', async () => {
            vi.mocked(httpSignature.verifySignature).mockResolvedValue(true)
            vi.mocked(federation.handleActivity).mockResolvedValue(undefined)

            const activity = {
                type: 'Follow',
                id: 'https://example.com/activities/1',
                actor: 'https://example.com/users/bob',
                object: `${baseUrl}/users/${testUser.username}`,
            }

            const res = await app.request('/inbox', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'signature': 'valid-signature',
                    'host': 'localhost:3000',
                },
                body: JSON.stringify(activity),
            })

            expect(res.status).toBe(202)
        })

        it('should handle errors gracefully', async () => {
            vi.mocked(httpSignature.verifySignature).mockRejectedValueOnce(new Error('Verification error'))

            const res = await app.request('/inbox', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'signature': 'test-signature',
                },
                body: JSON.stringify({
                    type: 'Follow',
                    actor: 'https://example.com/users/bob',
                    object: `${baseUrl}/users/${testUser.username}`,
                }),
            })

            expect(res.status).toBe(500)
        })
    })

    describe('GET /events/:id', () => {
        it('should return event as ActivityPub object', async () => {
            const res = await app.request(`/events/${testEvent.id}`)

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.type).toBe('Event')
            expect(body.id).toBe(`${baseUrl}/events/${testEvent.id}`)
            expect(body.name).toBe(testEvent.title)
            expect(body.startTime).toBe(testEvent.startTime.toISOString())
        })

        it('should return 404 when event not found', async () => {
            const res = await app.request('/events/nonexistent-id')

            expect(res.status).toBe(404)
            const body = await res.json() as any as any
            expect(body.error).toBe('Event not found')
        })

        it('should include optional fields when present', async () => {
            await prisma.event.update({
                where: { id: testEvent.id },
                data: {
                    summary: 'Event summary',
                    location: 'Event location',
                    url: 'https://example.com/event',
                    headerImage: 'https://example.com/header.jpg',
                    eventStatus: 'EventScheduled',
                    eventAttendanceMode: 'OfflineEventAttendanceMode',
                    maximumAttendeeCapacity: 100,
                },
            })

            const res = await app.request(`/events/${testEvent.id}`)

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.summary).toBe('Event summary')
            expect(body.location).toBe('Event location')
            expect(body.url).toBe('https://example.com/event')
            expect(body.attachment).toBeDefined()
            expect(body.eventStatus).toBe('EventScheduled')
            expect(body.eventAttendanceMode).toBe('OfflineEventAttendanceMode')
            expect(body.maximumAttendeeCapacity).toBe(100)
        })

        it('should handle remote user attribution', async () => {
            const remoteUser = await prisma.user.create({
                data: {
                    username: 'remote@example.com',
                    isRemote: true,
                    externalActorUrl: 'https://example.com/users/remote',
                },
            })

            const remoteEvent = await prisma.event.create({
                data: {
                    title: 'Remote Event',
                    startTime: new Date(),
                    userId: remoteUser.id,
                    attributedTo: remoteUser.externalActorUrl!,
                },
            })

            const res = await app.request(`/events/${remoteEvent.id}`)

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.attributedTo).toBe(remoteUser.externalActorUrl)
        })

        it('should handle errors gracefully', async () => {
            const originalFindUnique = prisma.event.findUnique
            vi.spyOn(prisma.event, 'findUnique').mockRejectedValueOnce(new Error('Database error'))

            const res = await app.request(`/events/${testEvent.id}`)

            expect(res.status).toBe(500)

            // Restore
            prisma.event.findUnique = originalFindUnique
        })
    })
})

