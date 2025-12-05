/**
 * Tests for Event Management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { config } from 'dotenv'
config()
import { app } from '../server.js'
import { prisma } from '../lib/prisma.js'
import * as activityBuilder from '../services/ActivityBuilder.js'
import * as activityDelivery from '../services/ActivityDelivery.js'
import * as realtime from '../realtime.js'
import * as authModule from '../auth.js'
import * as tagsModule from '../lib/tags.js'
import { config as appConfig } from '../config.js'

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

    const mockAnnounceActivity = (eventId: string) => {
        vi.mocked(activityBuilder.buildAnnounceEventActivity).mockReturnValue({
            '@context': [],
            id: `${baseUrl}/users/${testUser.username}/activities/share-${eventId}`,
            type: 'Announce',
            actor: `${baseUrl}/users/${testUser.username}`,
            object: `${baseUrl}/events/${eventId}`,
            to: ['https://www.w3.org/ns/activitystreams#Public'],
            cc: [],
            published: new Date().toISOString(),
        } as any)
    }

    describe('POST /events/:id/share', () => {
        it('allows sharing a public event', async () => {
            const sourceUser = await prisma.user.create({
                data: {
                    username: 'share_source',
                    email: 'source@test.com',
                    isRemote: false,
                },
            })

            const event = await prisma.event.create({
                data: {
                    title: 'Public Event',
                    startTime: new Date(Date.now() + 86400000),
                    userId: sourceUser.id,
                    attributedTo: `${baseUrl}/users/${sourceUser.username}`,
                    visibility: 'PUBLIC',
                },
            })

            const sessionSpy = vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue({
                user: {
                    id: testUser.id,
                    username: testUser.username,
                    email: testUser.email,
                },
                session: {
                    id: 'share-session',
                    userId: testUser.id,
                    expiresAt: new Date(Date.now() + 86400000),
                },
            } as any)

            mockAnnounceActivity(event.id)

            const res = await app.request(`/api/events/${event.id}/share`, {
                method: 'POST',
            })

            expect(res.status).toBe(201)
            const body = await res.json() as any
            expect(body.share).toBeDefined()
            expect(body.share.sharedEventId).toBe(event.id)
            expect(body.alreadyShared).toBe(false)

            sessionSpy.mockRestore()
        })

        it('prevents sharing non-public events', async () => {
            const sourceUser = await prisma.user.create({
                data: {
                    username: 'share_private',
                    email: 'source_private@test.com',
                    isRemote: false,
                },
            })

            const event = await prisma.event.create({
                data: {
                    title: 'Private Event',
                    startTime: new Date(Date.now() + 86400000),
                    userId: sourceUser.id,
                    attributedTo: `${baseUrl}/users/${sourceUser.username}`,
                    visibility: 'PRIVATE',
                },
            })

            const sessionSpy = vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue({
                user: {
                    id: testUser.id,
                    username: testUser.username,
                    email: testUser.email,
                },
                session: {
                    id: 'share-session-private',
                    userId: testUser.id,
                    expiresAt: new Date(Date.now() + 86400000),
                },
            } as any)

            const res = await app.request(`/api/events/${event.id}/share`, {
                method: 'POST',
            })

            expect(res.status).toBe(403)

            sessionSpy.mockRestore()
        })

        it('is idempotent when sharing the same event twice', async () => {
            const sourceUser = await prisma.user.create({
                data: {
                    username: 'share_dupe',
                    email: 'source_dupe@test.com',
                    isRemote: false,
                },
            })

            const event = await prisma.event.create({
                data: {
                    title: 'Duplicate Share Event',
                    startTime: new Date(Date.now() + 86400000),
                    userId: sourceUser.id,
                    attributedTo: `${baseUrl}/users/${sourceUser.username}`,
                    visibility: 'PUBLIC',
                },
            })

            const sessionSpy = vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue({
                user: {
                    id: testUser.id,
                    username: testUser.username,
                    email: testUser.email,
                },
                session: {
                    id: 'share-session-dup',
                    userId: testUser.id,
                    expiresAt: new Date(Date.now() + 86400000),
                },
            } as any)

            mockAnnounceActivity(event.id)

            const first = await app.request(`/api/events/${event.id}/share`, {
                method: 'POST',
            })
            expect(first.status).toBe(201)

            const second = await app.request(`/api/events/${event.id}/share`, {
                method: 'POST',
            })
            expect(second.status).toBe(200)
            const body = await second.json() as any
            expect(body.alreadyShared).toBe(true)

            sessionSpy.mockRestore()
        })

        it('returns 404 when event does not exist', async () => {
            const sessionSpy = vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue({
                user: {
                    id: testUser.id,
                    username: testUser.username,
                    email: testUser.email,
                },
                session: {
                    id: 'share-session-notfound',
                    userId: testUser.id,
                    expiresAt: new Date(Date.now() + 86400000),
                },
            } as any)

            const res = await app.request('/api/events/non-existent-event-id/share', {
                method: 'POST',
            })

            expect(res.status).toBe(404)
            const body = await res.json() as any
            expect(body.error).toBe('Event not found')

            sessionSpy.mockRestore()
        })

        it('returns 404 when user is remote', async () => {
            const remoteUser = await prisma.user.create({
                data: {
                    username: 'remote_share_user',
                    email: 'remote@test.com',
                    isRemote: true,
                },
            })

            const sourceUser = await prisma.user.create({
                data: {
                    username: 'share_source_remote',
                    email: 'source_remote@test.com',
                    isRemote: false,
                },
            })

            const event = await prisma.event.create({
                data: {
                    title: 'Public Event for Remote',
                    startTime: new Date(Date.now() + 86400000),
                    userId: sourceUser.id,
                    attributedTo: `${baseUrl}/users/${sourceUser.username}`,
                    visibility: 'PUBLIC',
                },
            })

            const sessionSpy = vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue({
                user: {
                    id: remoteUser.id,
                    username: remoteUser.username,
                    email: remoteUser.email,
                },
                session: {
                    id: 'share-session-remote',
                    userId: remoteUser.id,
                    expiresAt: new Date(Date.now() + 86400000),
                },
            } as any)

            const res = await app.request(`/api/events/${event.id}/share`, {
                method: 'POST',
            })

            expect(res.status).toBe(404)
            const body = await res.json() as any
            expect(body.error).toBe('User not found or is remote')

            sessionSpy.mockRestore()
        })

        it('allows sharing an already-shared event (sharing the original)', async () => {
            const sourceUser = await prisma.user.create({
                data: {
                    username: 'share_original_source',
                    email: 'original_source@test.com',
                    isRemote: false,
                },
            })

            const originalEvent = await prisma.event.create({
                data: {
                    title: 'Original Event',
                    startTime: new Date(Date.now() + 86400000),
                    userId: sourceUser.id,
                    attributedTo: `${baseUrl}/users/${sourceUser.username}`,
                    visibility: 'PUBLIC',
                },
            })

            // Create a share of the original event
            const shareUser = await prisma.user.create({
                data: {
                    username: 'share_original_sharer',
                    email: 'original_sharer@test.com',
                    isRemote: false,
                },
            })

            const sharedEvent = await prisma.event.create({
                data: {
                    title: originalEvent.title,
                    startTime: originalEvent.startTime,
                    userId: shareUser.id,
                    attributedTo: `${baseUrl}/users/${shareUser.username}`,
                    visibility: 'PUBLIC',
                    sharedEventId: originalEvent.id,
                },
            })

            const sessionSpy = vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue({
                user: {
                    id: testUser.id,
                    username: testUser.username,
                    email: testUser.email,
                },
                session: {
                    id: 'share-session-original',
                    userId: testUser.id,
                    expiresAt: new Date(Date.now() + 86400000),
                },
            } as any)

            mockAnnounceActivity(originalEvent.id)

            // Share the original event (not the share itself)
            const res = await app.request(`/api/events/${sharedEvent.id}/share`, {
                method: 'POST',
            })

            expect(res.status).toBe(201)
            const body = await res.json() as any
            expect(body.share).toBeDefined()
            expect(body.share.sharedEventId).toBe(originalEvent.id)
            expect(body.alreadyShared).toBe(false)

            sessionSpy.mockRestore()
        })

        it('returns 403 when user cannot view the original event', async () => {
            const sourceUser = await prisma.user.create({
                data: {
                    username: 'share_followers_source',
                    email: 'followers_source@test.com',
                    isRemote: false,
                },
            })

            const event = await prisma.event.create({
                data: {
                    title: 'Followers Only Event',
                    startTime: new Date(Date.now() + 86400000),
                    userId: sourceUser.id,
                    attributedTo: `${baseUrl}/users/${sourceUser.username}`,
                    visibility: 'FOLLOWERS',
                },
            })

            // Create a user who doesn't follow the source
            const nonFollower = await prisma.user.create({
                data: {
                    username: 'non_follower_share',
                    email: 'non_follower@test.com',
                    isRemote: false,
                },
            })

            const sessionSpy = vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue({
                user: {
                    id: nonFollower.id,
                    username: nonFollower.username,
                    email: nonFollower.email,
                },
                session: {
                    id: 'share-session-nonfollower',
                    userId: nonFollower.id,
                    expiresAt: new Date(Date.now() + 86400000),
                },
            } as any)

            const res = await app.request(`/api/events/${event.id}/share`, {
                method: 'POST',
            })

            expect(res.status).toBe(403)
            const body = await res.json() as any
            expect(body.error).toBe('Forbidden')

            sessionSpy.mockRestore()
        })

        it('prevents sharing FOLLOWERS visibility events even if user can view', async () => {
            const sourceUser = await prisma.user.create({
                data: {
                    username: 'share_followers_visible',
                    email: 'followers_visible@test.com',
                    isRemote: false,
                },
            })

            const event = await prisma.event.create({
                data: {
                    title: 'Followers Event',
                    startTime: new Date(Date.now() + 86400000),
                    userId: sourceUser.id,
                    attributedTo: `${baseUrl}/users/${sourceUser.username}`,
                    visibility: 'FOLLOWERS',
                },
            })

            // Use the event owner - they can always view their own events
            // This ensures canUserViewEvent returns true, so we reach the visibility check
            const sessionSpy = vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue({
                user: {
                    id: sourceUser.id,
                    username: sourceUser.username,
                    email: sourceUser.email,
                },
                session: {
                    id: 'share-session-owner',
                    userId: sourceUser.id,
                    expiresAt: new Date(Date.now() + 86400000),
                },
            } as any)

            const res = await app.request(`/api/events/${event.id}/share`, {
                method: 'POST',
            })

            // Even though user can view (they own it), only PUBLIC events can be shared
            expect(res.status).toBe(403)
            const body = await res.json() as any
            expect(body.error).toBe('Only public events can be shared')

            sessionSpy.mockRestore()
        })

        it('prevents sharing UNLISTED visibility events even if user can view', async () => {
            const sourceUser = await prisma.user.create({
                data: {
                    username: 'share_unlisted_visible',
                    email: 'unlisted_visible@test.com',
                    isRemote: false,
                },
            })

            const event = await prisma.event.create({
                data: {
                    title: 'Unlisted Event',
                    startTime: new Date(Date.now() + 86400000),
                    userId: sourceUser.id,
                    attributedTo: `${baseUrl}/users/${sourceUser.username}`,
                    visibility: 'UNLISTED',
                },
            })

            const sessionSpy = vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue({
                user: {
                    id: sourceUser.id,
                    username: sourceUser.username,
                    email: sourceUser.email,
                },
                session: {
                    id: 'share-session-unlisted',
                    userId: sourceUser.id,
                    expiresAt: new Date(Date.now() + 86400000),
                },
            } as any)

            const res = await app.request(`/api/events/${event.id}/share`, {
                method: 'POST',
            })

            expect(res.status).toBe(403)
            const body = await res.json() as any
            expect(body.error).toBe('Only public events can be shared')

            sessionSpy.mockRestore()
        })

        it('handles event with externalId when building share', async () => {
            const sourceUser = await prisma.user.create({
                data: {
                    username: 'share_external_source',
                    email: 'external_source@test.com',
                    isRemote: false,
                },
            })

            const externalEventUrl = 'https://example.com/events/external-123'
            const event = await prisma.event.create({
                data: {
                    title: 'External Event',
                    startTime: new Date(Date.now() + 86400000),
                    userId: sourceUser.id,
                    attributedTo: `${baseUrl}/users/${sourceUser.username}`,
                    externalId: externalEventUrl,
                    visibility: 'PUBLIC',
                },
            })

            const sessionSpy = vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue({
                user: {
                    id: testUser.id,
                    username: testUser.username,
                    email: testUser.email,
                },
                session: {
                    id: 'share-session-external',
                    userId: testUser.id,
                    expiresAt: new Date(Date.now() + 86400000),
                },
            } as any)

            mockAnnounceActivity(event.id)

            const res = await app.request(`/api/events/${event.id}/share`, {
                method: 'POST',
            })

            expect(res.status).toBe(201)
            const body = await res.json() as any
            expect(body.share).toBeDefined()
            expect(body.share.sharedEventId).toBe(event.id)

            // Verify that buildAnnounceEventActivity was called with the external URL
            expect(activityBuilder.buildAnnounceEventActivity).toHaveBeenCalledWith(
                expect.objectContaining({ id: testUser.id }),
                externalEventUrl,
                'PUBLIC',
                expect.any(String)
            )

            sessionSpy.mockRestore()
        })

        it('handles event without attributedTo when building share', async () => {
            const sourceUser = await prisma.user.create({
                data: {
                    username: 'share_no_attributed',
                    email: 'no_attributed@test.com',
                    isRemote: false,
                },
            })

            const event = await prisma.event.create({
                data: {
                    title: 'Event Without AttributedTo',
                    startTime: new Date(Date.now() + 86400000),
                    userId: sourceUser.id,
                    // No attributedTo set
                    visibility: 'PUBLIC',
                },
            })

            const sessionSpy = vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue({
                user: {
                    id: testUser.id,
                    username: testUser.username,
                    email: testUser.email,
                },
                session: {
                    id: 'share-session-no-attributed',
                    userId: testUser.id,
                    expiresAt: new Date(Date.now() + 86400000),
                },
            } as any)

            mockAnnounceActivity(event.id)

            const res = await app.request(`/api/events/${event.id}/share`, {
                method: 'POST',
            })

            expect(res.status).toBe(201)
            const body = await res.json() as any
            expect(body.share).toBeDefined()

            // Verify that buildAnnounceEventActivity was called with actor URL derived from user
            expect(activityBuilder.buildAnnounceEventActivity).toHaveBeenCalledWith(
                expect.objectContaining({ id: testUser.id }),
                expect.stringContaining(`/events/${event.id}`),
                'PUBLIC',
                `${baseUrl}/users/${sourceUser.username}`
            )

            sessionSpy.mockRestore()
        })

        it('returns 500 on internal server error', async () => {
            const sourceUser = await prisma.user.create({
                data: {
                    username: 'share_error_source',
                    email: 'error_source@test.com',
                    isRemote: false,
                },
            })

            const event = await prisma.event.create({
                data: {
                    title: 'Error Event',
                    startTime: new Date(Date.now() + 86400000),
                    userId: sourceUser.id,
                    attributedTo: `${baseUrl}/users/${sourceUser.username}`,
                    visibility: 'PUBLIC',
                },
            })

            const sessionSpy = vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue({
                user: {
                    id: testUser.id,
                    username: testUser.username,
                    email: testUser.email,
                },
                session: {
                    id: 'share-session-error',
                    userId: testUser.id,
                    expiresAt: new Date(Date.now() + 86400000),
                },
            } as any)

            // Mock buildAnnounceEventActivity to throw an error
            vi.mocked(activityBuilder.buildAnnounceEventActivity).mockImplementation(() => {
                throw new Error('Test error')
            })

            const res = await app.request(`/api/events/${event.id}/share`, {
                method: 'POST',
            })

            expect(res.status).toBe(500)
            const body = await res.json() as any
            expect(body.error).toBe('Internal server error')

            sessionSpy.mockRestore()
        })
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
            const createMock = vi.spyOn(prisma.event, 'create').mockRejectedValue(new Error('Database error'))

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
            
            // Restore the mock to prevent affecting other tests
            createMock.mockRestore()
        })
    })

    describe('Event listing edge cases', () => {

        it('should handle errors in event listing', async () => {
            const findManyMock = vi.spyOn(prisma.event, 'findMany').mockRejectedValue(new Error('Database error'))

            const res = await app.request('/api/events')
            expect(res.status).toBe(500)
            
            // Restore the mock to prevent affecting other tests
            findManyMock.mockRestore()
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

        it('should reject tags exceeding max length (50 chars)', async () => {
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

            const eventData = {
                title: 'Event With Long Tag',
                startTime: new Date(Date.now() + 86400000).toISOString(),
                tags: ['a'.repeat(51)], // 51 characters, exceeds max of 50
            }

            const res = await app.request('/api/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(eventData),
            })

            expect(res.status).toBe(400)
        })

        it('should reject empty string tags', async () => {
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

            const eventData = {
                title: 'Event With Empty Tag',
                startTime: new Date(Date.now() + 86400000).toISOString(),
                tags: [''], // Empty string should fail validation
            }

            const res = await app.request('/api/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(eventData),
            })

            expect(res.status).toBe(400)
        })

        it('should reject non-string values in tags array', async () => {
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

            const eventData = {
                title: 'Event With Invalid Tag',
                startTime: new Date(Date.now() + 86400000).toISOString(),
                tags: [123, 'music'], // Non-string value should fail validation
            }

            const res = await app.request('/api/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(eventData),
            })

            expect(res.status).toBe(400)
        })

        it('should reject tags array with non-array value', async () => {
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

            const eventData = {
                title: 'Event With Invalid Tags',
                startTime: new Date(Date.now() + 86400000).toISOString(),
                tags: 'not-an-array', // Should be array, not string
            }

            const res = await app.request('/api/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(eventData),
            })

            expect(res.status).toBe(400)
        })

        it('should trim whitespace from tags', async () => {
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
                title: 'Event With Whitespace Tags',
                startTime: new Date(Date.now() + 86400000).toISOString(),
                tags: ['  music  ', '  concert  ', '  live  '],
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

        it('should remove duplicate tags after normalization', async () => {
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
                title: 'Event With Duplicate Tags',
                startTime: new Date(Date.now() + 86400000).toISOString(),
                tags: ['music', 'MUSIC', '#music', '  music  ', 'concert'],
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
            expect(body.tags.length).toBe(2)
            expect(body.tags.map((t: { tag: string }) => t.tag)).toEqual(['music', 'concert'])
        })

        it('should filter out tags that become empty after normalization', async () => {
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

            // Note: Empty strings are rejected by Zod validation before normalization
            // So we test with tags that become empty after normalization (whitespace-only)
            const eventData = {
                title: 'Event With Empty Tags',
                startTime: new Date(Date.now() + 86400000).toISOString(),
                tags: ['music', '   ', 'concert'], // Whitespace-only tags become empty after normalization
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
            expect(body.tags.length).toBe(2)
            expect(body.tags.map((t: { tag: string }) => t.tag)).toEqual(['music', 'concert'])
        })

        it('should update event with only tags (no other fields)', async () => {
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
                    title: 'Original Event',
                    startTime: new Date(Date.now() + 86400000),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                    tags: {
                        create: [{ tag: 'music' }],
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
                tags: ['festival', 'summer'],
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
            expect(body.tags.length).toBe(2)
            expect(body.tags.map((t: { tag: string }) => t.tag)).toEqual(['festival', 'summer'])
            // Verify updatedAt was updated even though no other fields changed
            expect(new Date(body.updatedAt).getTime()).toBeGreaterThan(new Date(event.updatedAt).getTime())
        })

        it('should remove all tags when updating with empty array', async () => {
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
                        create: [{ tag: 'music' }, { tag: 'concert' }],
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
                tags: [],
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
            expect(Array.isArray(body.tags)).toBe(true)
            expect(body.tags.length).toBe(0)
        })

        it('should reject tags exceeding max length during update', async () => {
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
                    title: 'Event',
                    startTime: new Date(Date.now() + 86400000),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                },
            })

            const updateData = {
                tags: ['a'.repeat(51)], // 51 characters, exceeds max of 50
            }

            const res = await app.request(`/api/events/${event.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updateData),
            })

            expect(res.status).toBe(400)
        })

        it('should reject empty string tags during update', async () => {
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
                    title: 'Event',
                    startTime: new Date(Date.now() + 86400000),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                },
            })

            const updateData = {
                tags: [''], // Empty string should fail validation
            }

            const res = await app.request(`/api/events/${event.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updateData),
            })

            expect(res.status).toBe(400)
        })

        it('should create event when all tags become empty after normalization', async () => {
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

            // All tags become empty after normalization (only # and whitespace)
            const eventData = {
                title: 'Event With All Empty Tags',
                startTime: new Date(Date.now() + 86400000).toISOString(),
                tags: ['#', '##', '   ', '\t', '\n'],
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

        it('should handle when tags is falsy (0) in create', async () => {
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

            // Tags is 0 (falsy) - should skip tag processing, but Zod will reject this
            // So this tests the validation branch, not the tags && branch
            const eventData = {
                title: 'Event Without Tags',
                startTime: new Date(Date.now() + 86400000).toISOString(),
                tags: 0 as any,
            }

            const res = await app.request('/api/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(eventData),
            })

            // Should fail validation since tags must be an array
            expect(res.status).toBe(400)
        })

        it('should handle when tags is undefined in create', async () => {
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

            // Tags is undefined - should skip tag processing
            const eventData = {
                title: 'Event Without Tags',
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
            expect(body.tags.length).toBe(0)
        })

        it('should handle when normalizedTags is falsy after normalization', async () => {
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

            // Tags that all become empty - normalizedTags.length === 0
            const eventData = {
                title: 'Event With Empty Normalized Tags',
                startTime: new Date(Date.now() + 86400000).toISOString(),
                tags: ['#', '##', '###'],
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
            // Should not create tags since normalizedTags.length === 0
            expect(body.tags).toBeDefined()
            expect(Array.isArray(body.tags)).toBe(true)
            expect(body.tags.length).toBe(0)
        })


        it('should handle error when normalizeTags throws in create', async () => {
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

            // Mock normalizeTags to throw an error
            const normalizeTagsSpy = vi.spyOn(tagsModule, 'normalizeTags').mockImplementation(() => {
                throw new Error('Normalization failed')
            })

            const eventData = {
                title: 'Event With Tags',
                startTime: new Date(Date.now() + 86400000).toISOString(),
                tags: ['music', 'concert'],
            }

            const res = await app.request('/api/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(eventData),
            })

            expect(res.status).toBe(400)
            const body = await res.json() as any
            expect(body.error).toBe('VALIDATION_ERROR')
            expect(body.message).toBe('Failed to process tags: ensure tags are valid strings')
            
            // In development mode, should include error details
            if (appConfig.isDevelopment) {
                expect(body.details).toBeDefined()
                expect(body.details.originalError).toBeDefined()
            }

            normalizeTagsSpy.mockRestore()
        })

        it('should handle error when normalizeTags throws in create (production mode)', async () => {
            // Mock production mode
            const isDevSpy = vi.spyOn(appConfig, 'isDevelopment', 'get').mockReturnValue(false)

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

            // Mock normalizeTags to throw an error
            const normalizeTagsSpy = vi.spyOn(tagsModule, 'normalizeTags').mockImplementation(() => {
                throw new Error('Normalization failed')
            })

            const eventData = {
                title: 'Event With Tags',
                startTime: new Date(Date.now() + 86400000).toISOString(),
                tags: ['music', 'concert'],
            }

            const res = await app.request('/api/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(eventData),
            })

            expect(res.status).toBe(400)
            const body = await res.json() as any
            expect(body.error).toBe('VALIDATION_ERROR')
            expect(body.message).toBe('Failed to process tags: ensure tags are valid strings')
            
            // In production mode, should NOT include error details
            expect(body.details).toBeUndefined()

            normalizeTagsSpy.mockRestore()
            isDevSpy.mockRestore()
        })

        it('should handle error when normalizeTags throws in update', async () => {
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
                    title: 'Event',
                    startTime: new Date(Date.now() + 86400000),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                },
            })

            // Mock normalizeTags to throw an error
            const normalizeTagsSpy = vi.spyOn(tagsModule, 'normalizeTags').mockImplementation(() => {
                throw new Error('Normalization failed')
            })

            const updateData = {
                tags: ['music', 'concert'],
            }

            const res = await app.request(`/api/events/${event.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updateData),
            })

            expect(res.status).toBe(400)
            const body = await res.json() as any
            expect(body.error).toBe('VALIDATION_ERROR')
            expect(body.message).toBe('Failed to process tags: ensure tags are valid strings')
            
            // In development mode, should include error details
            if (appConfig.isDevelopment) {
                expect(body.details).toBeDefined()
                expect(body.details.originalError).toBeDefined()
            }

            normalizeTagsSpy.mockRestore()
        })

        it('should handle error when normalizeTags throws in update (production mode)', async () => {
            // Mock production mode
            const isDevSpy = vi.spyOn(appConfig, 'isDevelopment', 'get').mockReturnValue(false)

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
                    title: 'Event',
                    startTime: new Date(Date.now() + 86400000),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                },
            })

            // Mock normalizeTags to throw an error
            const normalizeTagsSpy = vi.spyOn(tagsModule, 'normalizeTags').mockImplementation(() => {
                throw new Error('Normalization failed')
            })

            const updateData = {
                tags: ['music', 'concert'],
            }

            const res = await app.request(`/api/events/${event.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updateData),
            })

            expect(res.status).toBe(400)
            const body = await res.json() as any
            expect(body.error).toBe('VALIDATION_ERROR')
            expect(body.message).toBe('Failed to process tags: ensure tags are valid strings')
            
            // In production mode, should NOT include error details
            expect(body.details).toBeUndefined()

            normalizeTagsSpy.mockRestore()
            isDevSpy.mockRestore()
        })


        it('should handle when tags is not an array in create', async () => {
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

            // Tags is not an array - should fail validation before reaching normalization
            const eventData = {
                title: 'Event',
                startTime: new Date(Date.now() + 86400000).toISOString(),
                tags: 'not-an-array',
            }

            const res = await app.request('/api/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(eventData),
            })

            // Should fail Zod validation
            expect(res.status).toBe(400)
        })

        it('should handle when tags is not an array in update', async () => {
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
                    title: 'Event',
                    startTime: new Date(Date.now() + 86400000),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                },
            })

            // Tags is not an array - should use empty array branch
            const updateData = {
                tags: 'not-an-array',
            }

            const res = await app.request(`/api/events/${event.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updateData),
            })

            // Should fail Zod validation
            expect(res.status).toBe(400)
        })

    })

    afterEach(() => {
        // Restore all mocks and spies to prevent test isolation issues
        vi.restoreAllMocks()
    })
})

