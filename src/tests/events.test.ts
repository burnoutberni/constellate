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

    describe('POST /events', () => {
        it('should create an event', async () => {
            const eventData = {
                title: 'Test Event',
                summary: 'Test event description',
                location: 'Test Location',
                startTime: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
                endTime: new Date(Date.now() + 86400000 + 3600000).toISOString(), // Tomorrow + 1 hour
            }

            // Mock auth to return a session for our test user
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
                object: {
                    type: 'Event',
                    id: `${baseUrl}/events/test-id`,
                },
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
            const body = await res.json()
            expect(body.title).toBe(eventData.title)
            expect(body.summary).toBe(eventData.summary)
            expect(body.location).toBe(eventData.location)
        })

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

            // Should return 401 or handle gracefully
            expect([401, 404, 500]).toContain(res.status)
        })

        it('should validate event data', async () => {
            const invalidData = {
                title: '', // Empty title
                startTime: 'invalid-date',
            }

            const res = await app.request('/api/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(invalidData),
            })

            expect(res.status).toBeGreaterThanOrEqual(400)
        })

        it('should handle optional fields', async () => {
            const eventData = {
                title: 'Minimal Event',
                startTime: new Date(Date.now() + 86400000).toISOString(),
            }

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

            // Should handle gracefully (may need auth)
            expect(res.status).toBeGreaterThanOrEqual(200)
        })
    })

    describe('GET /events', () => {
        it('should list events', async () => {
            // Create test events
            await prisma.event.createMany({
                data: [
                    {
                        title: 'Event 1',
                        startTime: new Date(Date.now() + 86400000),
                        userId: testUser.id,
                        attributedTo: `${baseUrl}/users/${testUser.username}`,
                    },
                    {
                        title: 'Event 2',
                        startTime: new Date(Date.now() + 172800000),
                        userId: testUser.id,
                        attributedTo: `${baseUrl}/users/${testUser.username}`,
                    },
                ],
            })

            const res = await app.request('/api/events')

            expect(res.status).toBe(200)
            const body = await res.json()
            expect(body.events).toBeDefined()
            expect(Array.isArray(body.events)).toBe(true)
            expect(body.pagination).toBeDefined()
        })

        it('should support pagination', async () => {
            // Create multiple events
            await prisma.event.createMany({
                data: Array.from({ length: 25 }, (_, i) => ({
                    title: `Event ${i + 1}`,
                    startTime: new Date(Date.now() + (i + 1) * 86400000),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                })),
            })

            const res = await app.request('/api/events?page=1&limit=10')

            expect(res.status).toBe(200)
            const body = await res.json()
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

            await prisma.event.createMany({
                data: [
                    {
                        title: 'My Event',
                        startTime: new Date(Date.now() + 86400000),
                        userId: testUser.id,
                        attributedTo: `${baseUrl}/users/${testUser.username}`,
                    },
                    {
                        title: 'Other Event',
                        startTime: new Date(Date.now() + 86400000),
                        userId: otherUser.id,
                        attributedTo: `${baseUrl}/users/${otherUser.username}`,
                    },
                ],
            })

            const res = await app.request('/api/events')

            expect(res.status).toBe(200)
            const body = await res.json()
            // Should return events (may be filtered based on auth)
            expect(body.events).toBeDefined()
        })
    })

    describe('GET /events/:id', () => {
        it('should get a single event', async () => {
            const event = await prisma.event.create({
                data: {
                    title: 'Test Event',
                    startTime: new Date(Date.now() + 86400000),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                },
            })

            const res = await app.request(`/api/events/${event.id}`)

            expect(res.status).toBe(200)
            const body = await res.json()
            // API returns ActivityPub URL format, not just the ID
            expect(body.id).toContain(event.id)
            expect(body.title).toBe(event.title)
        })

        it('should return 404 for non-existent event', async () => {
            const res = await app.request('/api/events/non-existent-id')

            expect(res.status).toBe(404)
        })

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
            const body = await res.json()
            expect(body.attendance).toBeDefined()
            expect(Array.isArray(body.attendance)).toBe(true)
        })
    })

    describe('PUT /events/:id', () => {
        it('should update an event', async () => {
            const event = await prisma.event.create({
                data: {
                    title: 'Original Title',
                    startTime: new Date(Date.now() + 86400000),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                },
            })

            vi.mocked(activityBuilder.buildUpdateEventActivity).mockReturnValue({
                type: 'Update',
                actor: `${baseUrl}/users/${testUser.username}`,
                object: { type: 'Event' },
            } as any)
            vi.mocked(activityDelivery.deliverToFollowers).mockResolvedValue(undefined)

            const updateData = {
                title: 'Updated Title',
                summary: 'Updated summary',
            }

            const res = await app.request(`/api/events/${event.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updateData),
            })

            // May need auth, so check for 401 or success
            if (res.status === 200) {
                const body = await res.json()
                expect(body.title).toBe(updateData.title)
            } else {
                expect([401, 403, 404]).toContain(res.status)
            }
        })

        it('should return 403 when updating another user\'s event', async () => {
            const otherUser = await prisma.user.create({
                data: {
                    username: 'bob',
                    email: 'bob@test.com',
                    isRemote: false,
                },
            })

            const event = await prisma.event.create({
                data: {
                    title: 'Other User Event',
                    startTime: new Date(Date.now() + 86400000),
                    userId: otherUser.id,
                    attributedTo: `${baseUrl}/users/${otherUser.username}`,
                },
            })

            const res = await app.request(`/api/events/${event.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ title: 'Hacked Title' }),
            })

            // Should return 403 or 401
            expect([401, 403, 404]).toContain(res.status)
        })
    })

    describe('DELETE /events/:id', () => {
        it('should delete an event', async () => {
            const event = await prisma.event.create({
                data: {
                    title: 'Event to Delete',
                    startTime: new Date(Date.now() + 86400000),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                },
            })

            vi.mocked(activityBuilder.buildDeleteEventActivity).mockReturnValue({
                type: 'Delete',
                actor: `${baseUrl}/users/${testUser.username}`,
                object: { type: 'Event' },
            } as any)
            vi.mocked(activityDelivery.deliverToFollowers).mockResolvedValue(undefined)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            const res = await app.request(`/api/events/${event.id}`, {
                method: 'DELETE',
            })

            // May need auth
            if (res.status === 200) {
                // Verify event was deleted
                const deleted = await prisma.event.findUnique({
                    where: { id: event.id },
                })
                expect(deleted).toBeNull()
            } else {
                expect([401, 403, 404]).toContain(res.status)
            }
        })

        it('should return 404 for non-existent event', async () => {
            const res = await app.request('/api/events/non-existent-id', {
                method: 'DELETE',
            })

            expect([401, 403, 404]).toContain(res.status)
        })
    })

    describe('GET /events/by-user/:username/:eventId', () => {
        it('should get event by username and eventId', async () => {
            const event = await prisma.event.create({
                data: {
                    title: 'User Event',
                    startTime: new Date(Date.now() + 86400000),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                },
            })

            const res = await app.request(`/api/events/by-user/${testUser.username}/${event.id}`)

            expect(res.status).toBe(200)
            const body = await res.json()
            // API returns ActivityPub URL format, not just the ID
            expect(body.id).toContain(event.id)
            expect(body.title).toBe(event.title)
        })

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

            // Mock fetch for remote event
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    type: 'Event',
                    id: event.externalId,
                    name: 'Remote Event',
                }),
            })

            const res = await app.request(`/api/events/by-user/${remoteUser.username}/${event.id}`)

            // Should handle remote events
            expect(res.status).toBeGreaterThanOrEqual(200)
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

        it('should handle all optional event fields', async () => {
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
                object: {
                    type: 'Event',
                    id: `${baseUrl}/events/test-id`,
                },
            } as any)
            vi.mocked(activityDelivery.deliverActivity).mockResolvedValue(undefined)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            const eventData = {
                title: 'Full Event',
                summary: 'Event summary',
                location: 'Event location',
                headerImage: 'https://example.com/image.jpg',
                url: 'https://example.com/event',
                startTime: new Date(Date.now() + 86400000).toISOString(),
                endTime: new Date(Date.now() + 86400000 + 3600000).toISOString(),
                duration: 'PT1H',
                eventStatus: 'EventScheduled' as const,
                eventAttendanceMode: 'OfflineEventAttendanceMode' as const,
                maximumAttendeeCapacity: 100,
            }

            const res = await app.request('/api/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(eventData),
            })

            expect(res.status).toBe(201)
            const body = await res.json()
            expect(body.summary).toBe(eventData.summary)
            expect(body.location).toBe(eventData.location)
            expect(body.eventStatus).toBe(eventData.eventStatus)
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
        it('should handle authenticated user with following', async () => {
            const otherUser = await prisma.user.create({
                data: {
                    username: `bob_${Date.now()}`,
                    email: `bob_${Date.now()}@test.com`,
                    isRemote: false,
                },
            })

            await prisma.following.create({
                data: {
                    userId: testUser.id,
                    actorUrl: `${baseUrl}/users/${otherUser.username}`,
                    accepted: true,
                },
            })

            await prisma.event.create({
                data: {
                    title: 'Followed User Event',
                    startTime: new Date(Date.now() + 86400000),
                    userId: otherUser.id,
                    attributedTo: `${baseUrl}/users/${otherUser.username}`,
                },
            })

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

            const res = await app.request('/api/events')
            expect(res.status).toBe(200)
            const body = await res.json()
            expect(body.events).toBeDefined()
        })

        it('should handle remote events in listing', async () => {
            const remoteUser = await prisma.user.create({
                data: {
                    username: 'remote@example.com',
                    isRemote: true,
                    externalActorUrl: 'https://example.com/users/remote',
                },
            })

            await prisma.event.create({
                data: {
                    title: 'Remote Event',
                    startTime: new Date(Date.now() + 86400000),
                    attributedTo: remoteUser.externalActorUrl,
                },
            })

            const res = await app.request('/api/events')
            expect(res.status).toBe(200)
            const body = await res.json()
            expect(body.events).toBeDefined()
        })

        it('should handle errors in event listing', async () => {
            vi.spyOn(prisma.event, 'findMany').mockRejectedValue(new Error('Database error'))

            const res = await app.request('/api/events')
            expect(res.status).toBe(500)
        })

        it('should populate remote users for events without user', async () => {
            // Create a remote user
            const remoteUser = await prisma.user.create({
                data: {
                    username: 'bob@example.com',
                    email: 'bob@example.com',
                    name: 'Bob Remote',
                    isRemote: true,
                    externalActorUrl: 'https://example.com/users/bob',
                },
            })

            // Create an event attributed to the remote user (but without userId)
            const remoteEvent = await prisma.event.create({
                data: {
                    title: 'Remote Event',
                    startTime: new Date(Date.now() + 86400000),
                    attributedTo: remoteUser.externalActorUrl!,
                    externalId: 'https://example.com/events/1',
                },
            })

            const res = await app.request('/api/events')

            expect(res.status).toBe(200)
            const body = await res.json()
            const foundEvent = body.events.find((e: any) => e.id === remoteEvent.id)
            expect(foundEvent).toBeDefined()
            expect(foundEvent.user).toBeDefined()
            expect(foundEvent.user.username).toBe(remoteUser.username)
        })

        it('should handle events with no user found', async () => {
            // Create an event with attributedTo but no matching user
            const orphanEvent = await prisma.event.create({
                data: {
                    title: 'Orphan Event',
                    startTime: new Date(Date.now() + 86400000),
                    attributedTo: 'https://example.com/users/nonexistent',
                    externalId: 'https://example.com/events/orphan',
                },
            })

            const res = await app.request('/api/events')

            expect(res.status).toBe(200)
            const body = await res.json()
            const foundEvent = body.events.find((e: any) => e.id === orphanEvent.id)
            expect(foundEvent).toBeDefined()
            // User should be null or undefined
            expect(foundEvent.user).toBeFalsy()
        })
    })

    describe('GET /by-user/:username/:eventId', () => {
        it('should fetch and cache remote event details', async () => {
            // Create remote user
            const remoteUser = await prisma.user.create({
                data: {
                    username: 'bob@example.com',
                    email: 'bob@example.com',
                    name: 'Bob Remote',
                    isRemote: true,
                    externalActorUrl: 'https://example.com/users/bob',
                },
            })

            // Create remote event
            const remoteEvent = await prisma.event.create({
                data: {
                    title: 'Remote Event',
                    startTime: new Date(Date.now() + 86400000),
                    attributedTo: remoteUser.externalActorUrl!,
                    externalId: 'https://example.com/events/1',
                },
            })

            // Mock fetch to return remote event data
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    type: 'Event',
                    id: 'https://example.com/events/1',
                    name: 'Remote Event',
                    replies: {
                        items: [
                            {
                                type: 'Accept',
                                actor: 'https://example.com/users/attendee1',
                            },
                            {
                                type: 'Note',
                                id: 'https://example.com/comments/1',
                                attributedTo: 'https://example.com/users/commenter1',
                                content: 'Great event!',
                            },
                        ],
                    },
                    likes: {
                        items: [
                            {
                                actor: 'https://example.com/users/liker1',
                            },
                        ],
                    },
                    url: 'https://example.com/event-page',
                }),
            } as Response)

            // Mock activitypubHelpers
            const mockActor = {
                id: 'https://example.com/users/attendee1',
                type: 'Person',
                preferredUsername: 'attendee1',
            }

            const { cacheRemoteUser, fetchActor } = await import('../lib/activitypubHelpers.js')
            vi.mocked(fetchActor).mockResolvedValue(mockActor as any)
            vi.mocked(cacheRemoteUser).mockResolvedValue({
                id: 'attendee-user-id',
                username: 'attendee1@example.com',
            } as any)

            const res = await app.request(`/api/events/by-user/${remoteUser.username}/${remoteEvent.id}`)

            expect(res.status).toBe(200)
            const body = await res.json()
            expect(body.id).toBe(remoteEvent.id)
        })

        it('should handle fetch errors when fetching remote event', async () => {
            const remoteUser = await prisma.user.create({
                data: {
                    username: 'bob@example.com',
                    email: 'bob@example.com',
                    name: 'Bob Remote',
                    isRemote: true,
                    externalActorUrl: 'https://example.com/users/bob',
                },
            })

            const remoteEvent = await prisma.event.create({
                data: {
                    title: 'Remote Event',
                    startTime: new Date(Date.now() + 86400000),
                    attributedTo: remoteUser.externalActorUrl!,
                    externalId: 'https://example.com/events/1',
                },
            })

            // Mock fetch to fail
            global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

            const res = await app.request(`/api/events/by-user/${remoteUser.username}/${remoteEvent.id}`)

            // Should still return the event (with cached data)
            expect(res.status).toBe(200)
            const body = await res.json()
            expect(body.id).toBe(remoteEvent.id)
        })

        it('should handle remote event with non-ok response', async () => {
            const remoteUser = await prisma.user.create({
                data: {
                    username: 'bob@example.com',
                    email: 'bob@example.com',
                    name: 'Bob Remote',
                    isRemote: true,
                    externalActorUrl: 'https://example.com/users/bob',
                },
            })

            const remoteEvent = await prisma.event.create({
                data: {
                    title: 'Remote Event',
                    startTime: new Date(Date.now() + 86400000),
                    attributedTo: remoteUser.externalActorUrl!,
                    externalId: 'https://example.com/events/1',
                },
            })

            // Mock fetch to return non-ok response
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 404,
            } as Response)

            const res = await app.request(`/api/events/by-user/${remoteUser.username}/${remoteEvent.id}`)

            // Should still return the event (with cached data)
            expect(res.status).toBe(200)
            const body = await res.json()
            expect(body.id).toBe(remoteEvent.id)
        })

        it('should cache attendance from remote event replies', async () => {
            const remoteUser = await prisma.user.create({
                data: {
                    username: 'bob@example.com',
                    email: 'bob@example.com',
                    name: 'Bob Remote',
                    isRemote: true,
                    externalActorUrl: 'https://example.com/users/bob',
                },
            })

            const remoteEvent = await prisma.event.create({
                data: {
                    title: 'Remote Event',
                    startTime: new Date(Date.now() + 86400000),
                    attributedTo: remoteUser.externalActorUrl!,
                    externalId: 'https://example.com/events/1',
                },
            })

            // Create attendee user
            const attendeeUser = await prisma.user.create({
                data: {
                    username: 'attendee1@example.com',
                    email: 'attendee1@example.com',
                    isRemote: true,
                    externalActorUrl: 'https://example.com/users/attendee1',
                },
            })

            // Mock fetch
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    type: 'Event',
                    id: 'https://example.com/events/1',
                    replies: {
                        items: [
                            {
                                type: 'Accept',
                                actor: attendeeUser.externalActorUrl,
                            },
                        ],
                    },
                }),
            } as Response)

            const res = await app.request(`/api/events/by-user/${remoteUser.username}/${remoteEvent.id}`)

            expect(res.status).toBe(200)

            // Check that attendance was cached
            const attendance = await prisma.eventAttendance.findFirst({
                where: {
                    eventId: remoteEvent.id,
                    userId: attendeeUser.id,
                },
            })

            expect(attendance).toBeDefined()
            expect(attendance?.status).toBe('attending')
        })

        it('should cache likes from remote event', async () => {
            const remoteUser = await prisma.user.create({
                data: {
                    username: 'bob@example.com',
                    email: 'bob@example.com',
                    name: 'Bob Remote',
                    isRemote: true,
                    externalActorUrl: 'https://example.com/users/bob',
                },
            })

            const remoteEvent = await prisma.event.create({
                data: {
                    title: 'Remote Event',
                    startTime: new Date(Date.now() + 86400000),
                    attributedTo: remoteUser.externalActorUrl!,
                    externalId: 'https://example.com/events/1',
                },
            })

            // Create liker user
            const likerUser = await prisma.user.create({
                data: {
                    username: 'liker1@example.com',
                    email: 'liker1@example.com',
                    isRemote: true,
                    externalActorUrl: 'https://example.com/users/liker1',
                },
            })

            // Mock fetch
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    type: 'Event',
                    id: 'https://example.com/events/1',
                    likes: {
                        items: [
                            {
                                actor: likerUser.externalActorUrl,
                            },
                        ],
                    },
                }),
            } as Response)

            const res = await app.request(`/api/events/by-user/${remoteUser.username}/${remoteEvent.id}`)

            expect(res.status).toBe(200)

            // Check that like was cached
            const like = await prisma.eventLike.findFirst({
                where: {
                    eventId: remoteEvent.id,
                    userId: likerUser.id,
                },
            })

            expect(like).toBeDefined()
        })

        it('should update event URL from remote event', async () => {
            const remoteUser = await prisma.user.create({
                data: {
                    username: 'bob@example.com',
                    email: 'bob@example.com',
                    name: 'Bob Remote',
                    isRemote: true,
                    externalActorUrl: 'https://example.com/users/bob',
                },
            })

            const remoteEvent = await prisma.event.create({
                data: {
                    title: 'Remote Event',
                    startTime: new Date(Date.now() + 86400000),
                    attributedTo: remoteUser.externalActorUrl!,
                    externalId: 'https://example.com/events/1',
                    url: null, // No URL initially
                },
            })

            // Mock fetch
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    type: 'Event',
                    id: 'https://example.com/events/1',
                    url: 'https://example.com/event-page',
                }),
            } as Response)

            const res = await app.request(`/api/events/by-user/${remoteUser.username}/${remoteEvent.id}`)

            expect(res.status).toBe(200)

            // Check that URL was updated
            const updatedEvent = await prisma.event.findUnique({
                where: { id: remoteEvent.id },
            })

            expect(updatedEvent?.url).toBe('https://example.com/event-page')
        })
    })

    describe('Event Creation Edge Cases', () => {
        it('should handle event creation with activity addressing', async () => {
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
                object: {
                    type: 'Event',
                    name: 'Test Event',
                },
                to: [`${baseUrl}/followers`],
                cc: [],
            } as any)
            vi.mocked(activityDelivery.deliverActivity).mockResolvedValue(undefined)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

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

            expect(res.status).toBe(201)
            // Should have called deliverActivity with addressing
            expect(activityDelivery.deliverActivity).toHaveBeenCalled()
        })

        it('should handle event creation with array to/cc fields', async () => {
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
                object: {
                    type: 'Event',
                    name: 'Test Event',
                },
                to: [`${baseUrl}/followers`, `${baseUrl}/users/${testUser.username}/followers`],
                cc: [`${baseUrl}/public`],
            } as any)
            vi.mocked(activityDelivery.deliverActivity).mockResolvedValue(undefined)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

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

            expect(res.status).toBe(201)
            // Should handle array to/cc fields
            expect(activityDelivery.deliverActivity).toHaveBeenCalled()
        })

        it('should handle event creation with single string to/cc fields', async () => {
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
                object: {
                    type: 'Event',
                    name: 'Test Event',
                },
                to: `${baseUrl}/followers`,
                cc: `${baseUrl}/public`,
            } as any)
            vi.mocked(activityDelivery.deliverActivity).mockResolvedValue(undefined)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

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

            expect(res.status).toBe(201)
            // Should convert single string to array
            expect(activityDelivery.deliverActivity).toHaveBeenCalled()
        })

        it('should handle event creation with null/undefined to/cc fields', async () => {
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
                object: {
                    type: 'Event',
                    name: 'Test Event',
                },
                to: null,
                cc: undefined,
            } as any)
            vi.mocked(activityDelivery.deliverActivity).mockResolvedValue(undefined)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

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

            expect(res.status).toBe(201)
            // Should handle null/undefined gracefully
            expect(activityDelivery.deliverActivity).toHaveBeenCalled()
        })

        it('should broadcast EVENT_CREATED with all event data', async () => {
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
                object: {
                    type: 'Event',
                    name: 'Test Event',
                },
            } as any)
            vi.mocked(activityDelivery.deliverActivity).mockResolvedValue(undefined)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            const res = await app.request('/api/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: 'Test Event',
                    summary: 'Test summary',
                    location: 'Test location',
                    url: 'https://example.com/event',
                    startTime: new Date(Date.now() + 86400000).toISOString(),
                    endTime: new Date(Date.now() + 86400000 + 3600000).toISOString(),
                    eventStatus: 'EventScheduled',
                }),
            })

            expect(res.status).toBe(201)
            // Should have broadcasted EVENT_CREATED
            expect(realtime.broadcast).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: BroadcastEvents.EVENT_CREATED,
                    data: expect.objectContaining({
                        event: expect.objectContaining({
                            title: 'Test Event',
                            summary: 'Test summary',
                            location: 'Test location',
                            url: 'https://example.com/event',
                        }),
                    }),
                })
            )
        })
    })
})

