import { config } from 'dotenv'
config()
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import {
    PersonSchema,
    EventSchema,
    OrderedCollectionSchema,
    WebFingerSchema
} from '../lib/activitypubSchemas.js'
import { prisma } from '../lib/prisma.js'
import { generateKeyPairSync } from 'crypto'
import { signRequest, createDigest } from '../lib/httpSignature.js'
import * as ssrfProtection from '../lib/ssrfProtection.js'

describe('ActivityPub Conformance', () => {
    let app: any
    let testUser: any
    let testEvent: any
    let testPrivateKey: string
    let testPublicKey: string
    const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000'

    beforeAll(async () => {
        const mod = await import('../server.js')
        app = mod.app
    })

    beforeEach(async () => {
        // Clean up test data
        await prisma.processedActivity.deleteMany({})
        await prisma.eventAttendance.deleteMany({})
        await prisma.eventLike.deleteMany({})
        await prisma.comment.deleteMany({})
        await prisma.follower.deleteMany({})
        await prisma.following.deleteMany({})
        await prisma.event.deleteMany({})
        await prisma.user.deleteMany({})

        // Generate test keys
        const { publicKey, privateKey } = generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: {
                type: 'spki',
                format: 'pem',
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem',
            },
        })

        testPrivateKey = privateKey
        testPublicKey = publicKey

        // Create test user
        testUser = await prisma.user.create({
            data: {
                username: 'testuser',
                email: 'test@example.com',
                name: 'Test User',
                isRemote: false,
                publicKey: testPublicKey,
            },
        })

        // Create test event
        testEvent = await prisma.event.create({
            data: {
                title: 'Test Event',
                startTime: new Date(),
                userId: testUser.id,
                attributedTo: `${baseUrl}/users/${testUser.username}`,
            },
        })
    })

    afterEach(async () => {
        // Clean up
        await prisma.processedActivity.deleteMany({})
        await prisma.eventAttendance.deleteMany({})
        await prisma.eventLike.deleteMany({})
        await prisma.comment.deleteMany({})
        await prisma.follower.deleteMany({})
        await prisma.following.deleteMany({})
        await prisma.event.deleteMany({})
        await prisma.user.deleteMany({})
    })

    describe('WebFinger', () => {
        it('should return 404 for non-existent users', async () => {
            const domain = new URL(baseUrl).hostname
            const res = await app.request(`/.well-known/webfinger?resource=acct:nonexistent@${domain}`)
            
            expect(res.status).toBe(404)
        })

        it('should return 400 for missing resource parameter', async () => {
            const res = await app.request('/.well-known/webfinger')
            expect(res.status).toBe(400)
        })

        it('should return 400 for invalid resource format', async () => {
            const res = await app.request('/.well-known/webfinger?resource=invalid-format')
            expect(res.status).toBe(400)
        })

        it('should return 404 for domain mismatch', async () => {
            const res = await app.request('/.well-known/webfinger?resource=acct:testuser@wrongdomain.com')
            expect(res.status).toBe(404)
        })

        it('should return valid JSON resource descriptor for existing user', async () => {
            const domain = new URL(baseUrl).hostname
            const resource = `acct:${testUser.username}@${domain}`
            const res = await app.request(`/.well-known/webfinger?resource=${encodeURIComponent(resource)}`)

            expect(res.status).toBe(200)
            const body = await res.json() as any
            
            // Validate against WebFinger schema
            const result = WebFingerSchema.safeParse(body)
            expect(result.success).toBe(true)
            
            // Check required fields
            expect(body.subject).toBe(resource)
            expect(body.links).toBeDefined()
            expect(Array.isArray(body.links)).toBe(true)
            expect(body.links.length).toBeGreaterThan(0)
            
            // Check that links contain required ActivityPub link
            const selfLink = body.links.find((link: any) => link.rel === 'self')
            expect(selfLink).toBeDefined()
            expect(selfLink.type).toBe('application/activity+json')
            expect(selfLink.href).toBe(`${baseUrl}/users/${testUser.username}`)
            
            // Check aliases
            expect(body.aliases).toBeDefined()
            expect(Array.isArray(body.aliases)).toBe(true)
            expect(body.aliases).toContain(`${baseUrl}/users/${testUser.username}`)
        })
    })

    describe('NodeInfo', () => {
        it('should serve NodeInfo discovery', async () => {
            const res = await app.request('/.well-known/nodeinfo')
            expect(res.status).toBe(200)
            const body = await res.json() as any
            expect(body.links).toBeDefined()
            expect(Array.isArray(body.links)).toBe(true)
        })

        it('should serve NodeInfo 2.0', async () => {
            const res = await app.request('/nodeinfo/2.0')
            expect(res.status).toBe(200)
            const body = await res.json() as any
            expect(body.version).toBe('2.0')
            expect(body.software.name).toBe('stellar-calendar')
            expect(body.protocols).toContain('activitypub')
        })
    })

    describe('Actor (Person)', () => {
        it('should serve a valid Person object at /users/:username', async () => {
            const res = await app.request(`/users/${testUser.username}`, {
                headers: { Accept: 'application/activity+json' }
            })

            expect(res.status).toBe(200)
            const body = await res.json() as any
            const result = PersonSchema.safeParse(body)
            if (!result.success) {
                console.error('Person validation errors:', result.error)
            }
            expect(result.success).toBe(true)
            expect(body.type).toBe('Person')
            expect(body['@context']).toBeDefined()
            expect(body.id).toBe(`${baseUrl}/users/${testUser.username}`)
            expect(body.inbox).toBe(`${baseUrl}/users/${testUser.username}/inbox`)
            expect(body.outbox).toBe(`${baseUrl}/users/${testUser.username}/outbox`)
            expect(body.followers).toBe(`${baseUrl}/users/${testUser.username}/followers`)
            expect(body.following).toBe(`${baseUrl}/users/${testUser.username}/following`)
            expect(body.publicKey).toBeDefined()
            expect(body.publicKey.publicKeyPem).toBe(testPublicKey)
            expect(body.preferredUsername).toBe(testUser.username)
            expect(body.name).toBe(testUser.name)
        })

        it('should generate keys if user does not have them', async () => {
            // Create user without keys
            const userWithoutKeys = await prisma.user.create({
                data: {
                    username: 'nokeys',
                    email: 'nokeys@example.com',
                    name: 'No Keys User',
                    isRemote: false,
                    publicKey: null,
                    privateKey: null,
                },
            })

            const res = await app.request(`/users/${userWithoutKeys.username}`, {
                headers: { Accept: 'application/activity+json' }
            })

            expect(res.status).toBe(200)
            const body = await res.json() as any
            expect(body.publicKey).toBeDefined()
            expect(body.publicKey.publicKeyPem).toBeDefined()

            // Verify keys were saved
            const updatedUser = await prisma.user.findUnique({
                where: { id: userWithoutKeys.id },
            })
            expect(updatedUser?.publicKey).toBeTruthy()
            expect(updatedUser?.privateKey).toBeTruthy()

            // Cleanup
            await prisma.user.delete({ where: { id: userWithoutKeys.id } })
        })

        it('should include optional fields when present', async () => {
            const userWithProfile = await prisma.user.create({
                data: {
                    username: 'profileuser',
                    email: 'profile@example.com',
                    name: 'Profile User',
                    bio: 'Test bio',
                    profileImage: 'https://example.com/avatar.jpg',
                    headerImage: 'https://example.com/header.jpg',
                    displayColor: '#ff0000',
                    isRemote: false,
                    publicKey: testPublicKey,
                },
            })

            const res = await app.request(`/users/${userWithProfile.username}`, {
                headers: { Accept: 'application/activity+json' }
            })

            expect(res.status).toBe(200)
            const body = await res.json() as any
            expect(body.summary).toBe('Test bio')
            expect(body.icon).toBeDefined()
            expect(body.icon.url).toBe('https://example.com/avatar.jpg')
            expect(body.image).toBeDefined()
            expect(body.image.url).toBe('https://example.com/header.jpg')
            expect(body.displayColor).toBe('#ff0000')

            // Cleanup
            await prisma.user.delete({ where: { id: userWithProfile.id } })
        })

        it('should return 404 for non-existent users', async () => {
            const res = await app.request('/users/nonexistentuser123', {
                headers: { Accept: 'application/activity+json' }
            })
            expect(res.status).toBe(404)
        })
    })

    describe('Collections', () => {
        describe('Outbox', () => {
            it('should serve a valid Outbox collection summary', async () => {
                const res = await app.request(`/users/${testUser.username}/outbox`, {
                    headers: { Accept: 'application/activity+json' }
                })

                expect(res.status).toBe(200)
                const body = await res.json() as any
                const result = OrderedCollectionSchema.safeParse(body)
                expect(result.success).toBe(true)
                expect(body.type).toBe('OrderedCollection')
                expect(body.id).toBe(`${baseUrl}/users/${testUser.username}/outbox`)
                expect(typeof body.totalItems).toBe('number')
                expect(body.totalItems).toBe(1) // We created one event
            })

            it('should serve Outbox collection page with events', async () => {
                const res = await app.request(`/users/${testUser.username}/outbox?page=1`, {
                    headers: { Accept: 'application/activity+json' }
                })

                expect(res.status).toBe(200)
                const body = await res.json() as any
                expect(body.type).toBe('OrderedCollectionPage')
                expect(body.orderedItems).toBeDefined()
                expect(Array.isArray(body.orderedItems)).toBe(true)
                expect(body.orderedItems.length).toBeGreaterThan(0)
                
                // Check first activity
                const activity = body.orderedItems[0]
                expect(activity.type).toBe('Create')
                expect(activity.actor).toBe(`${baseUrl}/users/${testUser.username}`)
                expect(activity.object).toBeDefined()
                expect(activity.object.type).toBe('Event')
            })

            it('should handle pagination correctly', async () => {
                // Create multiple events
                for (let i = 0; i < 5; i++) {
                    await prisma.event.create({
                        data: {
                            title: `Event ${i}`,
                            startTime: new Date(),
                            userId: testUser.id,
                            attributedTo: `${baseUrl}/users/${testUser.username}`,
                        },
                    })
                }

                const res = await app.request(`/users/${testUser.username}/outbox?page=1`, {
                    headers: { Accept: 'application/activity+json' }
                })

                expect(res.status).toBe(200)
                const body = await res.json() as any
                expect(body.orderedItems.length).toBeLessThanOrEqual(20) // Default page size
            })

            it('should return 404 for non-existent user', async () => {
                const res = await app.request('/users/nonexistent/outbox', {
                    headers: { Accept: 'application/activity+json' }
                })
                expect(res.status).toBe(404)
            })
        })

        describe('Followers', () => {
            it('should serve a valid Followers collection summary', async () => {
                const res = await app.request(`/users/${testUser.username}/followers`, {
                    headers: { Accept: 'application/activity+json' }
                })

                expect(res.status).toBe(200)
                const body = await res.json() as any
                const result = OrderedCollectionSchema.safeParse(body)
                expect(result.success).toBe(true)
                expect(body.type).toBe('OrderedCollection')
                expect(body.id).toBe(`${baseUrl}/users/${testUser.username}/followers`)
                expect(typeof body.totalItems).toBe('number')
            })

            it('should serve Followers collection page', async () => {
                // Create a follower
                const follower = await prisma.user.create({
                    data: {
                        username: 'follower',
                        email: 'follower@example.com',
                        isRemote: false,
                    },
                })

                await prisma.follower.create({
                    data: {
                        userId: testUser.id,
                        actorUrl: `${baseUrl}/users/follower`,
                        username: 'follower',
                        inboxUrl: `${baseUrl}/users/follower/inbox`,
                        accepted: true,
                    },
                })

                const res = await app.request(`/users/${testUser.username}/followers?page=1`, {
                    headers: { Accept: 'application/activity+json' }
                })

                expect(res.status).toBe(200)
                const body = await res.json() as any
                expect(body.type).toBe('OrderedCollectionPage')
                expect(body.orderedItems).toBeDefined()
                expect(Array.isArray(body.orderedItems)).toBe(true)
                expect(body.orderedItems.length).toBeGreaterThan(0)

                // Cleanup
                await prisma.follower.deleteMany({})
                await prisma.user.delete({ where: { id: follower.id } })
            })

            it('should only include accepted followers', async () => {
                const follower = await prisma.user.create({
                    data: {
                        username: 'pendingfollower',
                        email: 'pending@example.com',
                        isRemote: false,
                    },
                })

                await prisma.follower.create({
                    data: {
                        userId: testUser.id,
                        actorUrl: `${baseUrl}/users/pendingfollower`,
                        username: 'pendingfollower',
                        inboxUrl: `${baseUrl}/users/pendingfollower/inbox`,
                        accepted: false,
                    },
                })

                const res = await app.request(`/users/${testUser.username}/followers?page=1`, {
                    headers: { Accept: 'application/activity+json' }
                })

                expect(res.status).toBe(200)
                const body = await res.json() as any
                // Should not include pending follower
                const hasPending = body.orderedItems?.some((item: string) => 
                    item.includes('pendingfollower')
                )
                expect(hasPending).toBe(false)

                // Cleanup
                await prisma.follower.deleteMany({})
                await prisma.user.delete({ where: { id: follower.id } })
            })
        })

        describe('Following', () => {
            it('should serve a valid Following collection summary', async () => {
                const res = await app.request(`/users/${testUser.username}/following`, {
                    headers: { Accept: 'application/activity+json' }
                })

                expect(res.status).toBe(200)
                const body = await res.json() as any
                const result = OrderedCollectionSchema.safeParse(body)
                expect(result.success).toBe(true)
                expect(body.type).toBe('OrderedCollection')
                expect(body.id).toBe(`${baseUrl}/users/${testUser.username}/following`)
            })

            it('should serve Following collection page', async () => {
                const following = await prisma.user.create({
                    data: {
                        username: 'following',
                        email: 'following@example.com',
                        isRemote: false,
                    },
                })

                await prisma.following.create({
                    data: {
                        userId: testUser.id,
                        actorUrl: `${baseUrl}/users/following`,
                        username: 'following',
                        inboxUrl: `${baseUrl}/users/following/inbox`,
                        accepted: true,
                    },
                })

                const res = await app.request(`/users/${testUser.username}/following?page=1`, {
                    headers: { Accept: 'application/activity+json' }
                })

                expect(res.status).toBe(200)
                const body = await res.json() as any
                expect(body.type).toBe('OrderedCollectionPage')
                expect(body.orderedItems).toBeDefined()

                // Cleanup
                await prisma.following.deleteMany({})
                await prisma.user.delete({ where: { id: following.id } })
            })
        })
    })

    describe('Inbox', () => {
        async function createSignedRequest(
            path: string,
            activity: any,
            keyId: string = `${baseUrl}/users/${testUser.username}#main-key`
        ) {
            const method = 'POST'
            const url = new URL(path, baseUrl)
            const body = JSON.stringify(activity)
            const digest = await createDigest(body)
            const date = new Date().toUTCString()
            
            const headers: Record<string, string> = {
                host: url.hostname,
                date,
                digest,
                'content-type': 'application/activity+json',
            }

            const signature = signRequest(testPrivateKey, keyId, method, url.pathname, headers)

            return app.request(path, {
                method,
                headers: {
                    ...headers,
                    signature,
                },
                body,
            })
        }

        it('should reject inbox POST without signature', async () => {
            const res = await app.request(`/users/${testUser.username}/inbox`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/activity+json' },
                body: JSON.stringify({
                    '@context': 'https://www.w3.org/ns/activitystreams',
                    type: 'Follow',
                    actor: 'https://example.com/users/bob',
                    object: `${baseUrl}/users/${testUser.username}`
                })
            })
            expect(res.status).toBe(401)
        })

        it('should reject inbox POST with invalid signature', async () => {
            const res = await app.request(`/users/${testUser.username}/inbox`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/activity+json',
                    signature: 'keyId="invalid",algorithm="rsa-sha256",headers="(request-target) host date",signature="invalid"',
                },
                body: JSON.stringify({
                    '@context': 'https://www.w3.org/ns/activitystreams',
                    type: 'Follow',
                    actor: 'https://example.com/users/bob',
                    object: `${baseUrl}/users/${testUser.username}`
                })
            })
            expect(res.status).toBe(401)
        })

        it('should reject inbox POST with invalid activity', async () => {
            // Mock public key fetch to return our test public key
            vi.spyOn(ssrfProtection, 'safeFetch').mockResolvedValue({
                ok: true,
                json: async () => ({
                    publicKey: {
                        publicKeyPem: testPublicKey,
                    },
                }),
            } as any)

            const invalidActivity = {
                '@context': 'https://www.w3.org/ns/activitystreams',
                type: 'InvalidActivity',
                // Missing required fields
            }

            const res = await createSignedRequest(`/users/${testUser.username}/inbox`, invalidActivity)
            expect(res.status).toBe(400)

            vi.restoreAllMocks()
        })

        it('should accept inbox POST with valid signature and activity', async () => {
            // Mock public key fetch
            vi.spyOn(ssrfProtection, 'safeFetch').mockResolvedValue({
                ok: true,
                json: async () => ({
                    publicKey: {
                        publicKeyPem: testPublicKey,
                    },
                }),
            } as any)

            const validActivity = {
                '@context': 'https://www.w3.org/ns/activitystreams',
                id: 'https://example.com/activities/1',
                type: 'Follow',
                actor: 'https://example.com/users/bob',
                object: `${baseUrl}/users/${testUser.username}`,
            }

            const res = await createSignedRequest(`/users/${testUser.username}/inbox`, validActivity)
            expect(res.status).toBe(202)
            const body = await res.json()
            expect(body.status).toBe('accepted')

            vi.restoreAllMocks()
        })

        it('should reject shared inbox POST without signature', async () => {
            const res = await app.request('/inbox', {
                method: 'POST',
                headers: { 'Content-Type': 'application/activity+json' },
                body: JSON.stringify({
                    '@context': 'https://www.w3.org/ns/activitystreams',
                    type: 'Follow',
                    actor: 'https://example.com/users/bob',
                    object: `${baseUrl}/users/${testUser.username}`
                })
            })
            expect(res.status).toBe(401)
        })

        it('should accept shared inbox POST with valid signature', async () => {
            // Mock public key fetch
            vi.spyOn(ssrfProtection, 'safeFetch').mockResolvedValue({
                ok: true,
                json: async () => ({
                    publicKey: {
                        publicKeyPem: testPublicKey,
                    },
                }),
            } as any)

            const validActivity = {
                '@context': 'https://www.w3.org/ns/activitystreams',
                id: 'https://example.com/activities/2',
                type: 'Follow',
                actor: 'https://example.com/users/bob',
                object: `${baseUrl}/users/${testUser.username}`,
            }

            const res = await createSignedRequest('/inbox', validActivity)
            expect(res.status).toBe(202)

            vi.restoreAllMocks()
        })

        it('should return 404 for non-existent user inbox', async () => {
            const res = await app.request('/users/nonexistent/inbox', {
                method: 'POST',
                headers: { 'Content-Type': 'application/activity+json' },
                body: JSON.stringify({
                    '@context': 'https://www.w3.org/ns/activitystreams',
                    type: 'Follow',
                    actor: 'https://example.com/users/bob',
                    object: `${baseUrl}/users/nonexistent`
                })
            })
            expect(res.status).toBe(404)
        })
    })

    describe('Event as ActivityPub Object', () => {
        it('should serve event as ActivityPub object', async () => {
            const res = await app.request(`/events/${testEvent.id}`, {
                headers: { Accept: 'application/activity+json' }
            })

            expect(res.status).toBe(200)
            const body = await res.json() as any
            const result = EventSchema.safeParse(body)
            expect(result.success).toBe(true)
            expect(body.type).toBe('Event')
            expect(body.id).toBe(`${baseUrl}/events/${testEvent.id}`)
            expect(body.name).toBe(testEvent.title)
            expect(body.startTime).toBeDefined()
            expect(body.attributedTo).toBe(`${baseUrl}/users/${testUser.username}`)
        })

        it('should include optional event fields when present', async () => {
            const eventWithDetails = await prisma.event.create({
                data: {
                    title: 'Detailed Event',
                    summary: 'Event summary',
                    location: 'Test Location',
                    startTime: new Date(),
                    endTime: new Date(Date.now() + 3600000),
                    duration: 'PT1H',
                    url: 'https://example.com/event',
                    eventStatus: 'EventScheduled',
                    eventAttendanceMode: 'OfflineEventAttendanceMode',
                    maximumAttendeeCapacity: 100,
                    headerImage: 'https://example.com/image.jpg',
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                },
            })

            const res = await app.request(`/events/${eventWithDetails.id}`, {
                headers: { Accept: 'application/activity+json' }
            })

            expect(res.status).toBe(200)
            const body = await res.json() as any
            expect(body.summary).toBe('Event summary')
            expect(body.location).toBe('Test Location')
            expect(body.endTime).toBeDefined()
            expect(body.duration).toBe('PT1H')
            expect(body.url).toBe('https://example.com/event')
            expect(body.eventStatus).toBe('EventScheduled')
            expect(body.eventAttendanceMode).toBe('OfflineEventAttendanceMode')
            expect(body.maximumAttendeeCapacity).toBe(100)
            expect(body.attachment).toBeDefined()
            expect(body.attachment[0].url).toBe('https://example.com/image.jpg')

            // Cleanup
            await prisma.event.delete({ where: { id: eventWithDetails.id } })
        })

        it('should return 404 for non-existent event', async () => {
            const res = await app.request('/events/nonexistent-id', {
                headers: { Accept: 'application/activity+json' }
            })
            expect(res.status).toBe(404)
        })
    })

    describe('API Documentation', () => {
        it('should serve OpenAPI specification at /doc', async () => {
            const res = await app.request('/doc')
            expect(res.status).toBe(200)
            const body = await res.json() as any
            expect(body.openapi).toBe('3.0.0')
            expect(body.info.title).toBe('Stellar Calendar API')
            expect(body.info.description).toBeDefined()
        })

        it('should serve Scalar API reference UI at /reference', async () => {
            const res = await app.request('/reference')
            expect(res.status).toBe(200)
            // Scalar returns HTML
            const contentType = res.headers.get('content-type')
            expect(contentType).toContain('text/html')
        })
    })
})
