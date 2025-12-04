/**
 * Tests for Event Management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { config } from 'dotenv'
config()
import { app } from '../server.js'
import { prisma } from '../lib/prisma.js'
import * as activityBuilder from '../services/ActivityBuilder.js'
import * as activityDelivery from '../services/ActivityDelivery.js'
import * as realtime from '../realtime.js'
import * as authModule from '../auth.js'

// Mock dependencies
vi.mock('../services/ActivityBuilder.js')
vi.mock('../services/ActivityDelivery.js')
vi.mock('../realtime.js')

describe('Events API', () => {
    let testUser: any
    let authToken: string
    const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000'

    beforeEach(async () => {
        // Clean up
        await prisma.eventTag.deleteMany({})
        await prisma.eventAttendance.deleteMany({})
        await prisma.eventLike.deleteMany({})
        await prisma.comment.deleteMany({})
        await prisma.event.deleteMany({})
        await prisma.following.deleteMany({})
        await prisma.user.deleteMany({})

        // Create test user with unique identifiers to avoid race conditions
        const timestamp = Date.now()
        const randomSuffix = Math.random().toString(36).substring(7)
        const suffix = `${timestamp}_${randomSuffix}`

        testUser = await prisma.user.create({
            data: {
                username: `alice_${suffix}`,
                email: `alice_${suffix}@test.com`,
                name: 'Alice Test',
                isRemote: false,
            },
        })

        // Mock auth - in real tests, you'd get a proper token
        // For now, we'll test with userId in context
        authToken = 'test-token'

        // Reset mocks
        vi.clearAllMocks()
    })

    describe('Event visibility', () => {
        it('defaults new events to PUBLIC visibility', async () => {
            const event = await prisma.event.create({
                data: {
                    title: 'Visibility Default',
                    startTime: new Date(Date.now() + 86400000),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                },
            })

            expect(event.visibility).toBe('PUBLIC')
        })

        it('blocks access to private events for other users', async () => {
            const privateEvent = await prisma.event.create({
                data: {
                    title: 'Secret Meeting',
                    startTime: new Date(Date.now() + 86400000),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                    visibility: 'PRIVATE',
                },
            })

            const otherUser = await prisma.user.create({
                data: {
                    username: 'bob_private',
                    email: 'bob_private@test.com',
                    isRemote: false,
                },
            })

            const sessionSpy = vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue({
                user: {
                    id: otherUser.id,
                    username: otherUser.username,
                    email: otherUser.email,
                },
                session: {
                    id: 'session-private',
                    userId: otherUser.id,
                    expiresAt: new Date(Date.now() + 86400000),
                },
            } as any)

            const res = await app.request(`/api/events/by-user/${testUser.username}/${privateEvent.id}`)
            expect(res.status).toBe(403)

            sessionSpy.mockRestore()
        })

        it('allows followers to view follower-only events', async () => {
            const follower = await prisma.user.create({
                data: {
                    username: 'charlie_follow',
                    email: 'charlie_follow@test.com',
                    isRemote: false,
                },
            })

            await prisma.following.create({
                data: {
                    userId: follower.id,
                    actorUrl: `${baseUrl}/users/${testUser.username}`,
                    username: testUser.username,
                    inboxUrl: `${baseUrl}/users/${testUser.username}/inbox`,
                    accepted: true,
                },
            })

            const followerOnlyEvent = await prisma.event.create({
                data: {
                    title: 'Followers Hangout',
                    startTime: new Date(Date.now() + 86400000),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                    visibility: 'FOLLOWERS',
                },
            })

            const sessionSpy = vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue({
                user: {
                    id: follower.id,
                    username: follower.username,
                    email: follower.email,
                },
                session: {
                    id: 'session-follow',
                    userId: follower.id,
                    expiresAt: new Date(Date.now() + 86400000),
                },
            } as any)

            const res = await app.request(`/api/events/by-user/${testUser.username}/${followerOnlyEvent.id}`)
            expect(res.status).toBe(200)

            sessionSpy.mockRestore()
        })
    })

    describe('POST /events', () => {

        it('should return 401 when not authenticated', async () => {
            const eventData = {
                title: 'Test Event',
                startTime: new Date(Date.now() + 86400000).toISOString(),
            }

            const res = await app.request('/api/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(eventData),
            })

            expect(res.status).toBe(401)
        })

        it('should validate event data', async () => {
            const invalidData = {
                title: '', // Empty title
                startTime: 'invalid-date',
            }

            vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue({
                user: {
                    id: testUser.id,
                    username: testUser.username,
                    email: testUser.email,
                },
                session: {
                    id: 'test-session',
                    userId: testUser.id,
                    expiresAt: new Date(Date.now() + 86400000),
                },
            } as any)

            const res = await app.request('/api/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(invalidData),
            })

            expect(res.status).toBe(400)
        })

        it('should handle optional fields', async () => {
            const eventData = {
                title: 'Minimal Event',
                startTime: new Date(Date.now() + 86400000).toISOString(),
            }

            vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue({
                user: {
                    id: testUser.id,
                    username: testUser.username,
                    email: testUser.email,
                },
                session: {
                    id: 'test-session',
                    userId: testUser.id,
                    expiresAt: new Date(Date.now() + 86400000),
                },
            } as any)

            vi.mocked(activityBuilder.buildCreateEventActivity).mockReturnValue({
                type: 'Create',
                actor: `${baseUrl}/users/${testUser.username}`,
                object: { type: 'Event' },
            } as any)
            vi.mocked(activityDelivery.deliverActivity).mockResolvedValue(undefined)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            const res = await app.request('/api/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(eventData),
            })

            expect(res.status).toBe(201)
        })
    })

    describe('GET /events', () => {
        it('should list events', async () => {
            // Ensure user exists before creating events
            const user = await prisma.user.findUnique({ where: { id: testUser.id } })
            if (!user) {
                throw new Error('Test user not found')
            }

            // Create test events using individual create calls to avoid foreign key issues
            await prisma.event.create({
                data: {
                    title: 'Event 1',
                    startTime: new Date(Date.now() + 86400000),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                },
            })
            await prisma.event.create({
                data: {
                    title: 'Event 2',
                    startTime: new Date(Date.now() + 172800000),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                },
            })

            const res = await app.request('/api/events')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.events).toBeDefined()
            expect(Array.isArray(body.events)).toBe(true)
            expect(body.pagination).toBeDefined()
        })

        it('should support pagination', async () => {
            // Ensure user exists before creating events
            const user = await prisma.user.findUnique({ where: { id: testUser.id } })
            if (!user) {
                throw new Error('Test user not found')
            }

            // Create multiple events using Promise.all to avoid foreign key issues
            await Promise.all(
                Array.from({ length: 25 }, (_, i) =>
                    prisma.event.create({
                        data: {
                            title: `Event ${i + 1}`,
                            startTime: new Date(Date.now() + (i + 1) * 86400000),
                            userId: testUser.id,
                            attributedTo: `${baseUrl}/users/${testUser.username}`,
                        },
                    })
                )
            )

            const res = await app.request('/api/events?page=1&limit=10')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.events.length).toBeLessThanOrEqual(10)
            expect(body.pagination.page).toBe(1)
            expect(body.pagination.limit).toBe(10)
        })

        it('should filter events for authenticated users', async () => {
            // Create events from different users
            const otherUser = await prisma.user.create({
                data: {
                    username: 'bob',
                    email: 'bob@test.com',
                    isRemote: false,
                },
            })

            // Create events using individual create calls to avoid foreign key issues
            await prisma.event.create({
                data: {
                    title: 'My Event',
                    startTime: new Date(Date.now() + 86400000),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                },
            })
            await prisma.event.create({
                data: {
                    title: 'Other Event',
                    startTime: new Date(Date.now() + 86400000),
                    userId: otherUser.id,
                    attributedTo: `${baseUrl}/users/${otherUser.username}`,
                },
            })

            const res = await app.request('/api/events')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            // Should return events (may be filtered based on auth)
            expect(body.events).toBeDefined()
        })

        it('should include recurring events that overlap the requested range', async () => {
            const recurringEvent = await prisma.event.create({
                data: {
                    title: 'Weekly Standup',
                    startTime: new Date('2025-01-01T10:00:00Z'),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                    recurrencePattern: 'WEEKLY',
                    recurrenceEndDate: new Date('2025-03-01T10:00:00Z'),
                },
            })

            const params = new URLSearchParams({
                rangeStart: '2025-02-01T00:00:00.000Z',
                rangeEnd: '2025-02-28T23:59:59.000Z',
                limit: '50',
            })

            const res = await app.request(`/api/events?${params.toString()}`)

            expect(res.status).toBe(200)
            const body = await res.json() as any
            const found = body.events.find((event: any) => event.id === recurringEvent.id)
            expect(found).toBeDefined()
            expect(found.recurrencePattern).toBe('WEEKLY')
            expect(found.recurrenceEndDate).toBeDefined()
        })

        it('should exclude recurring events that start after the range end', async () => {
            const recurringEvent = await prisma.event.create({
                data: {
                    title: 'Future Recurring Event',
                    startTime: new Date('2025-03-15T10:00:00Z'),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                    recurrencePattern: 'WEEKLY',
                    recurrenceEndDate: new Date('2025-06-01T10:00:00Z'),
                },
            })

            const params = new URLSearchParams({
                rangeStart: '2025-01-01T00:00:00.000Z',
                rangeEnd: '2025-02-28T23:59:59.000Z',
                limit: '50',
            })

            const res = await app.request(`/api/events?${params.toString()}`)

            expect(res.status).toBe(200)
            const body = await res.json() as any
            const found = body.events.find((event: any) => event.id === recurringEvent.id)
            expect(found).toBeUndefined()
        })

        it('should exclude recurring events where recurrence ends before the range start', async () => {
            const recurringEvent = await prisma.event.create({
                data: {
                    title: 'Past Recurring Event',
                    startTime: new Date('2024-12-01T10:00:00Z'),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                    recurrencePattern: 'WEEKLY',
                    recurrenceEndDate: new Date('2024-12-31T10:00:00Z'),
                },
            })

            const params = new URLSearchParams({
                rangeStart: '2025-01-01T00:00:00.000Z',
                rangeEnd: '2025-02-28T23:59:59.000Z',
                limit: '50',
            })

            const res = await app.request(`/api/events?${params.toString()}`)

            expect(res.status).toBe(200)
            const body = await res.json() as any
            const found = body.events.find((event: any) => event.id === recurringEvent.id)
            expect(found).toBeUndefined()
        })

        it('should include recurring events that start before the range but have occurrences within it', async () => {
            const recurringEvent = await prisma.event.create({
                data: {
                    title: 'Ongoing Recurring Event',
                    startTime: new Date('2024-12-15T10:00:00Z'),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                    recurrencePattern: 'WEEKLY',
                    recurrenceEndDate: new Date('2025-03-01T10:00:00Z'),
                },
            })

            const params = new URLSearchParams({
                rangeStart: '2025-01-01T00:00:00.000Z',
                rangeEnd: '2025-02-28T23:59:59.000Z',
                limit: '50',
            })

            const res = await app.request(`/api/events?${params.toString()}`)

            expect(res.status).toBe(200)
            const body = await res.json() as any
            const found = body.events.find((event: any) => event.id === recurringEvent.id)
            expect(found).toBeDefined()
            expect(found.recurrencePattern).toBe('WEEKLY')
        })
    })

    describe('GET /events/:id', () => {

        it('should include related data', async () => {
            const event = await prisma.event.create({
                data: {
                    title: 'Test Event',
                    startTime: new Date(Date.now() + 86400000),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                },
            })

            // Add attendance
            await prisma.eventAttendance.create({
                data: {
                    eventId: event.id,
                    userId: testUser.id,
                    status: 'attending',
                },
            })

            const res = await app.request(`/api/events/${event.id}`)

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.attendance).toBeDefined()
            expect(Array.isArray(body.attendance)).toBe(true)
        })
    })

    

    

    describe('GET /events/by-user/:username/:eventId', () => {

        it('should handle remote users', async () => {
            const remoteUser = await prisma.user.create({
                data: {
                    username: 'bob@example.com',
                    isRemote: true,
                    externalActorUrl: 'https://example.com/users/bob',
                },
            })

            const event = await prisma.event.create({
                data: {
                    title: 'Remote Event',
                    startTime: new Date(Date.now() + 86400000),
                    externalId: 'https://example.com/events/1',
                    attributedTo: remoteUser.externalActorUrl,
                },
            })

            const originalFetch = global.fetch
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    type: 'Event',
                    id: event.externalId,
                    name: 'Remote Event',
                }),
            }) as typeof global.fetch

            try {
                const res = await app.request(`/api/events/by-user/${remoteUser.username}/${event.id}`)
                expect(res.status).toBe(200)
            } finally {
                global.fetch = originalFetch
            }
        })

        it('should return 404 when user not found', async () => {
            const res = await app.request('/api/events/by-user/nonexistent/event-id')
            expect(res.status).toBe(404)
        })

        it('should return 404 when event not found for user', async () => {
            const res = await app.request(`/api/events/by-user/${testUser.username}/nonexistent-event-id`)
            expect(res.status).toBe(404)
        })
    })

    describe('Event creation edge cases', () => {
        it('should handle user not found error', async () => {
            vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue({
                user: {
                    id: 'nonexistent-user-id',
                    username: 'nonexistent',
                    email: 'nonexistent@test.com',
                },
                session: {
                    id: 'test-session',
                    userId: 'nonexistent-user-id',
                    expiresAt: new Date(Date.now() + 86400000),
                },
            } as any)

            const res = await app.request('/api/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: 'Test Event',
                    startTime: new Date(Date.now() + 86400000).toISOString(),
                }),
            })

            expect(res.status).toBe(404)
        })

        it('should handle remote user error', async () => {
            const remoteUser = await prisma.user.create({
                data: {
                    username: 'remote@example.com',
                    email: 'remote@example.com',
                    isRemote: true,
                    externalActorUrl: 'https://example.com/users/remote',
                },
            })

            vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue({
                user: {
                    id: remoteUser.id,
                    username: remoteUser.username,
                    email: remoteUser.email,
                },
                session: {
                    id: 'test-session',
                    userId: remoteUser.id,
                    expiresAt: new Date(Date.now() + 86400000),
                },
            } as any)

            const res = await app.request('/api/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: 'Test Event',
                    startTime: new Date(Date.now() + 86400000).toISOString(),
                }),
            })

            expect(res.status).toBe(404)
        })

        it('should handle errors in event creation', async () => {
            vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue({
                user: {
                    id: testUser.id,
                    username: testUser.username,
                    email: testUser.email,
                },
                session: {
                    id: 'test-session',
                    userId: testUser.id,
                    expiresAt: new Date(Date.now() + 86400000),
                },
            } as any)

            // Mock prisma to throw an error
            vi.spyOn(prisma.event, 'create').mockRejectedValue(new Error('Database error'))

            const res = await app.request('/api/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: 'Test Event',
                    startTime: new Date(Date.now() + 86400000).toISOString(),
                }),
            })

            expect(res.status).toBe(500)
        })
    })

    describe('Event listing edge cases', () => {

        it('should handle errors in event listing', async () => {
            vi.spyOn(prisma.event, 'findMany').mockRejectedValue(new Error('Database error'))

            const res = await app.request('/api/events')
            expect(res.status).toBe(500)
        })

    })

    describe('Event Tags', () => {
        it('should create event with tags', async () => {
            vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue({
                user: {
                    id: testUser.id,
                    username: testUser.username,
                    email: testUser.email,
                },
                session: {
                    id: 'test-session',
                    userId: testUser.id,
                    expiresAt: new Date(Date.now() + 86400000),
                },
            } as any)

            vi.mocked(activityBuilder.buildCreateEventActivity).mockReturnValue({
                type: 'Create',
                actor: `${baseUrl}/users/${testUser.username}`,
                object: { type: 'Event' },
            } as any)
            vi.mocked(activityDelivery.deliverActivity).mockResolvedValue(undefined)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            const eventData = {
                title: 'Tagged Event',
                startTime: new Date(Date.now() + 86400000).toISOString(),
                tags: ['music', 'concert', 'live'],
            }

            const res = await app.request('/api/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(eventData),
            })

            expect(res.status).toBe(201)
            const body = await res.json() as any
            expect(body.tags).toBeDefined()
            expect(Array.isArray(body.tags)).toBe(true)
            expect(body.tags.length).toBe(3)
            expect(body.tags.map((t: { tag: string }) => t.tag)).toContain('music')
            expect(body.tags.map((t: { tag: string }) => t.tag)).toContain('concert')
            expect(body.tags.map((t: { tag: string }) => t.tag)).toContain('live')
        })

        it('should normalize tags to lowercase', async () => {
            vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue({
                user: {
                    id: testUser.id,
                    username: testUser.username,
                    email: testUser.email,
                },
                session: {
                    id: 'test-session',
                    userId: testUser.id,
                    expiresAt: new Date(Date.now() + 86400000),
                },
            } as any)

            vi.mocked(activityBuilder.buildCreateEventActivity).mockReturnValue({
                type: 'Create',
                actor: `${baseUrl}/users/${testUser.username}`,
                object: { type: 'Event' },
            } as any)
            vi.mocked(activityDelivery.deliverActivity).mockResolvedValue(undefined)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            const eventData = {
                title: 'Tagged Event',
                startTime: new Date(Date.now() + 86400000).toISOString(),
                tags: ['MUSIC', 'ConCert', 'LIVE'],
            }

            const res = await app.request('/api/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(eventData),
            })

            expect(res.status).toBe(201)
            const body = await res.json() as any
            expect(body.tags.length).toBe(3)
            expect(body.tags.map((t: { tag: string }) => t.tag)).toEqual(['music', 'concert', 'live'])
        })

        it('should remove # prefix from tags', async () => {
            vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue({
                user: {
                    id: testUser.id,
                    username: testUser.username,
                    email: testUser.email,
                },
                session: {
                    id: 'test-session',
                    userId: testUser.id,
                    expiresAt: new Date(Date.now() + 86400000),
                },
            } as any)

            vi.mocked(activityBuilder.buildCreateEventActivity).mockReturnValue({
                type: 'Create',
                actor: `${baseUrl}/users/${testUser.username}`,
                object: { type: 'Event' },
            } as any)
            vi.mocked(activityDelivery.deliverActivity).mockResolvedValue(undefined)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            const eventData = {
                title: 'Tagged Event',
                startTime: new Date(Date.now() + 86400000).toISOString(),
                tags: ['#music', '#concert', '#live'],
            }

            const res = await app.request('/api/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(eventData),
            })

            expect(res.status).toBe(201)
            const body = await res.json() as any
            expect(body.tags.length).toBe(3)
            expect(body.tags.map((t: { tag: string }) => t.tag)).toEqual(['music', 'concert', 'live'])
        })

        it('should include tags when listing events', async () => {
            const event = await prisma.event.create({
                data: {
                    title: 'Tagged Event',
                    startTime: new Date(Date.now() + 86400000),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                    tags: {
                        create: [
                            { tag: 'music' },
                            { tag: 'concert' },
                        ],
                    },
                },
            })

            const res = await app.request('/api/events')
            expect(res.status).toBe(200)
            const body = await res.json() as any
            const foundEvent = body.events.find((e: { id: string }) => e.id === event.id)
            expect(foundEvent).toBeDefined()
            expect(foundEvent.tags).toBeDefined()
            expect(Array.isArray(foundEvent.tags)).toBe(true)
            expect(foundEvent.tags.length).toBe(2)
        })

        it('should include tags when getting event by ID', async () => {
            const event = await prisma.event.create({
                data: {
                    title: 'Tagged Event',
                    startTime: new Date(Date.now() + 86400000),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                    tags: {
                        create: [
                            { tag: 'music' },
                            { tag: 'concert' },
                        ],
                    },
                },
            })

            const res = await app.request(`/api/events/${event.id}`)
            expect(res.status).toBe(200)
            const body = await res.json() as any
            expect(body.tags).toBeDefined()
            expect(Array.isArray(body.tags)).toBe(true)
            expect(body.tags.length).toBe(2)
            expect(body.tags.map((t: { tag: string }) => t.tag)).toContain('music')
            expect(body.tags.map((t: { tag: string }) => t.tag)).toContain('concert')
        })

        it('should update event tags', async () => {
            vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue({
                user: {
                    id: testUser.id,
                    username: testUser.username,
                    email: testUser.email,
                },
                session: {
                    id: 'test-session',
                    userId: testUser.id,
                    expiresAt: new Date(Date.now() + 86400000),
                },
            } as any)

            const event = await prisma.event.create({
                data: {
                    title: 'Tagged Event',
                    startTime: new Date(Date.now() + 86400000),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                    tags: {
                        create: [
                            { tag: 'music' },
                            { tag: 'concert' },
                        ],
                    },
                },
            })

            vi.mocked(activityBuilder.buildUpdateEventActivity).mockReturnValue({
                type: 'Update',
                actor: `${baseUrl}/users/${testUser.username}`,
                object: { type: 'Event' },
            } as any)
            vi.mocked(activityDelivery.deliverToFollowers).mockResolvedValue(undefined)

            const updateData = {
                tags: ['music', 'festival', 'summer'],
            }

            const res = await app.request(`/api/events/${event.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updateData),
            })

            expect(res.status).toBe(200)
            const body = await res.json() as any
            expect(body.tags).toBeDefined()
            expect(body.tags.length).toBe(3)
            expect(body.tags.map((t: { tag: string }) => t.tag)).toContain('music')
            expect(body.tags.map((t: { tag: string }) => t.tag)).toContain('festival')
            expect(body.tags.map((t: { tag: string }) => t.tag)).toContain('summer')
            expect(body.tags.map((t: { tag: string }) => t.tag)).not.toContain('concert')
        })

        it('should handle empty tags array', async () => {
            vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue({
                user: {
                    id: testUser.id,
                    username: testUser.username,
                    email: testUser.email,
                },
                session: {
                    id: 'test-session',
                    userId: testUser.id,
                    expiresAt: new Date(Date.now() + 86400000),
                },
            } as any)

            vi.mocked(activityBuilder.buildCreateEventActivity).mockReturnValue({
                type: 'Create',
                actor: `${baseUrl}/users/${testUser.username}`,
                object: { type: 'Event' },
            } as any)
            vi.mocked(activityDelivery.deliverActivity).mockResolvedValue(undefined)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            const eventData = {
                title: 'Event Without Tags',
                startTime: new Date(Date.now() + 86400000).toISOString(),
                tags: [],
            }

            const res = await app.request('/api/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(eventData),
            })

            expect(res.status).toBe(201)
            const body = await res.json() as any
            expect(body.tags).toBeDefined()
            expect(Array.isArray(body.tags)).toBe(true)
            expect(body.tags.length).toBe(0)
        })

        it('should handle missing tags field', async () => {
            vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue({
                user: {
                    id: testUser.id,
                    username: testUser.username,
                    email: testUser.email,
                },
                session: {
                    id: 'test-session',
                    userId: testUser.id,
                    expiresAt: new Date(Date.now() + 86400000),
                },
            } as any)

            vi.mocked(activityBuilder.buildCreateEventActivity).mockReturnValue({
                type: 'Create',
                actor: `${baseUrl}/users/${testUser.username}`,
                object: { type: 'Event' },
            } as any)
            vi.mocked(activityDelivery.deliverActivity).mockResolvedValue(undefined)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            const eventData = {
                title: 'Event Without Tags Field',
                startTime: new Date(Date.now() + 86400000).toISOString(),
            }

            const res = await app.request('/api/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(eventData),
            })

            expect(res.status).toBe(201)
            const body = await res.json() as any
            expect(body.tags).toBeDefined()
            expect(Array.isArray(body.tags)).toBe(true)
        })
    })

    
})

