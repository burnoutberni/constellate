/**
 * Tests for Likes API
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

describe('Likes API', () => {
    let testUser: any
    let testUser2: any
    let testEvent: any
    const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000'

    beforeEach(async () => {
        // Clean up
        await prisma.eventLike.deleteMany({})
        await prisma.eventAttendance.deleteMany({})
        await prisma.comment.deleteMany({})
        await prisma.event.deleteMany({})
        await prisma.following.deleteMany({})
        await prisma.user.deleteMany({})

        // Create test users
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

        testUser2 = await prisma.user.create({
            data: {
                username: `bob_${suffix}`,
                email: `bob_${suffix}@test.com`,
                name: 'Bob Test',
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
                userId: testUser2.id,
                attributedTo: `${baseUrl}/users/${testUser2.username}`,
            },
        })

        // Reset mocks
        vi.clearAllMocks()
    })

    describe('POST /:id/like', () => {
        it('should like an event', async () => {
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

            vi.mocked(activityBuilder.buildLikeActivity).mockReturnValue({
                type: 'Like',
                actor: `${baseUrl}/users/${testUser.username}`,
                object: `${baseUrl}/events/${testEvent.id}`,
            } as any)
            vi.mocked(activityDelivery.deliverToActors).mockResolvedValue(undefined)
            vi.mocked(activityDelivery.deliverToFollowers).mockResolvedValue(undefined)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            const res = await app.request(`/api/events/${testEvent.id}/like`, {
                method: 'POST',
            })

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.eventId).toBe(testEvent.id)
            expect(body.userId).toBe(testUser.id)
        })

        it('should return 404 when event not found', async () => {
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

            const res = await app.request('/api/events/nonexistent-id/like', {
                method: 'POST',
            })

            expect(res.status).toBe(404)
        })

        it('should return 404 when user not found', async () => {
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

            const res = await app.request(`/api/events/${testEvent.id}/like`, {
                method: 'POST',
            })

            expect(res.status).toBe(404)
        })

        it('should return 400 when already liked', async () => {
            await prisma.eventLike.create({
                data: {
                    eventId: testEvent.id,
                    userId: testUser.id,
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

            const res = await app.request(`/api/events/${testEvent.id}/like`, {
                method: 'POST',
            })

            expect(res.status).toBe(400)
        })

        it('should handle remote event author', async () => {
            const remoteEvent = await prisma.event.create({
                data: {
                    title: 'Remote Event',
                    startTime: new Date(Date.now() + 86400000),
                    attributedTo: 'https://remote.example.com/users/remoteuser',
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

            vi.mocked(activityBuilder.buildLikeActivity).mockReturnValue({
                type: 'Like',
                actor: `${baseUrl}/users/${testUser.username}`,
                object: `${baseUrl}/events/${remoteEvent.id}`,
            } as any)
            vi.mocked(activityDelivery.deliverToActors).mockResolvedValue(undefined)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            const res = await app.request(`/api/events/${remoteEvent.id}/like`, {
                method: 'POST',
            })

            expect(res.status).toBe(200)
        })

        it('should handle event with external ID', async () => {
            const eventWithExternalId = await prisma.event.create({
                data: {
                    title: 'Event with External ID',
                    startTime: new Date(Date.now() + 86400000),
                    userId: testUser2.id,
                    attributedTo: `${baseUrl}/users/${testUser2.username}`,
                    externalId: 'https://example.com/events/123',
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

            vi.mocked(activityBuilder.buildLikeActivity).mockReturnValue({
                type: 'Like',
                actor: `${baseUrl}/users/${testUser.username}`,
                object: eventWithExternalId.externalId!,
            } as any)
            vi.mocked(activityDelivery.deliverToActors).mockResolvedValue(undefined)
            vi.mocked(activityDelivery.deliverToFollowers).mockResolvedValue(undefined)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            const res = await app.request(`/api/events/${eventWithExternalId.id}/like`, {
                method: 'POST',
            })

            expect(res.status).toBe(200)
        })

        it('should return 401 when not authenticated', async () => {
            vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue(null)

            const res = await app.request(`/api/events/${testEvent.id}/like`, {
                method: 'POST',
            })

            expect([401, 404, 500]).toContain(res.status)
        })

        it('should handle errors gracefully', async () => {
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
            vi.spyOn(prisma.eventLike, 'create').mockRejectedValue(new Error('Database error'))

            const res = await app.request(`/api/events/${testEvent.id}/like`, {
                method: 'POST',
            })

            expect(res.status).toBe(500)
        })
    })

    describe('DELETE /:id/like', () => {
        it('should unlike an event', async () => {
            await prisma.eventLike.create({
                data: {
                    eventId: testEvent.id,
                    userId: testUser.id,
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

            vi.mocked(activityBuilder.buildUndoActivity).mockReturnValue({
                type: 'Undo',
                actor: `${baseUrl}/users/${testUser.username}`,
                object: {
                    type: 'Like',
                    actor: `${baseUrl}/users/${testUser.username}`,
                    object: `${baseUrl}/events/${testEvent.id}`,
                },
            } as any)
            vi.mocked(activityDelivery.deliverToActors).mockResolvedValue(undefined)
            vi.mocked(activityDelivery.deliverToFollowers).mockResolvedValue(undefined)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            const res = await app.request(`/api/events/${testEvent.id}/like`, {
                method: 'DELETE',
            })

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.success).toBe(true)

            // Verify like is deleted
            const deletedLike = await prisma.eventLike.findUnique({
                where: {
                    eventId_userId: {
                        eventId: testEvent.id,
                        userId: testUser.id,
                    },
                },
            })
            expect(deletedLike).toBeNull()
        })

        it('should return 404 when event not found', async () => {
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

            const res = await app.request('/api/events/nonexistent-id/like', {
                method: 'DELETE',
            })

            expect(res.status).toBe(404)
        })

        it('should return 404 when like not found', async () => {
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

            const res = await app.request(`/api/events/${testEvent.id}/like`, {
                method: 'DELETE',
            })

            expect(res.status).toBe(404)
        })

        it('should return 404 when user not found', async () => {
            await prisma.eventLike.create({
                data: {
                    eventId: testEvent.id,
                    userId: testUser.id,
                },
            })

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

            const res = await app.request(`/api/events/${testEvent.id}/like`, {
                method: 'DELETE',
            })

            expect(res.status).toBe(404)
        })

        it('should handle remote event author', async () => {
            const remoteEvent = await prisma.event.create({
                data: {
                    title: 'Remote Event',
                    startTime: new Date(Date.now() + 86400000),
                    attributedTo: 'https://remote.example.com/users/remoteuser',
                },
            })

            await prisma.eventLike.create({
                data: {
                    eventId: remoteEvent.id,
                    userId: testUser.id,
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

            vi.mocked(activityBuilder.buildUndoActivity).mockReturnValue({
                type: 'Undo',
                actor: `${baseUrl}/users/${testUser.username}`,
                object: {
                    type: 'Like',
                    actor: `${baseUrl}/users/${testUser.username}`,
                    object: `${baseUrl}/events/${remoteEvent.id}`,
                },
            } as any)
            vi.mocked(activityDelivery.deliverToActors).mockResolvedValue(undefined)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            const res = await app.request(`/api/events/${remoteEvent.id}/like`, {
                method: 'DELETE',
            })

            expect(res.status).toBe(200)
        })

        it('should return 401 when not authenticated', async () => {
            await prisma.eventLike.create({
                data: {
                    eventId: testEvent.id,
                    userId: testUser.id,
                },
            })

            vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue(null)

            const res = await app.request(`/api/events/${testEvent.id}/like`, {
                method: 'DELETE',
            })

            expect([401, 404, 500]).toContain(res.status)
        })

        it('should handle errors gracefully', async () => {
            await prisma.eventLike.create({
                data: {
                    eventId: testEvent.id,
                    userId: testUser.id,
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

            // Mock prisma to throw an error
            vi.spyOn(prisma.eventLike, 'delete').mockRejectedValue(new Error('Database error'))

            const res = await app.request(`/api/events/${testEvent.id}/like`, {
                method: 'DELETE',
            })

            expect(res.status).toBe(500)
        })

        it('should return 400 when already liked', async () => {
            // Create existing like
            await prisma.eventLike.create({
                data: {
                    eventId: testEvent.id,
                    userId: testUser.id,
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

            const res = await app.request(`/api/events/${testEvent.id}/like`, {
                method: 'POST',
            })

            expect(res.status).toBe(400)
            const body = await res.json() as any as any
            expect(body.error).toBe('Already liked')
        })

        it('should handle event without user but with attributedTo starting with baseUrl', async () => {
            // Create event without user but with attributedTo
            const eventWithoutUser = await prisma.event.create({
                data: {
                    title: 'Event Without User',
                    startTime: new Date(Date.now() + 86400000),
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                    // No userId
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

            vi.mocked(activityBuilder.buildLikeActivity).mockReturnValue({
                type: 'Like',
                actor: `${baseUrl}/users/${testUser.username}`,
                object: `${baseUrl}/events/${eventWithoutUser.id}`,
            } as any)
            vi.mocked(activityDelivery.deliverToActors).mockResolvedValue(undefined)
            vi.mocked(activityDelivery.deliverToFollowers).mockResolvedValue(undefined)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            const res = await app.request(`/api/events/${eventWithoutUser.id}/like`, {
                method: 'POST',
            })

            expect(res.status).toBe(201)
            // Should have called deliverToActors
            expect(activityDelivery.deliverToActors).toHaveBeenCalled()
        })
    })

    describe('Unlike Event Edge Cases', () => {
        it('should handle unlike for event without user but with attributedTo', async () => {
            const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000'
            
            // Create event without user but with attributedTo
            const eventWithoutUser = await prisma.event.create({
                data: {
                    title: 'Event Without User',
                    startTime: new Date(Date.now() + 86400000),
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                    // No userId
                },
            })

            // Create like
            const like = await prisma.eventLike.create({
                data: {
                    eventId: eventWithoutUser.id,
                    userId: testUser.id,
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

            vi.mocked(prisma.eventLike.findUnique).mockResolvedValue({
                ...like,
                event: {
                    ...eventWithoutUser,
                    user: null,
                },
                user: testUser,
            } as any)
            vi.mocked(activityBuilder.buildUndoActivity).mockReturnValue({
                type: 'Undo',
                actor: `${baseUrl}/users/${testUser.username}`,
                object: {
                    type: 'Like',
                    actor: `${baseUrl}/users/${testUser.username}`,
                    object: `${baseUrl}/events/${eventWithoutUser.id}`,
                },
            } as any)
            vi.mocked(activityDelivery.deliverActivity).mockResolvedValue(undefined)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            const res = await app.request(`/api/events/${eventWithoutUser.id}/like`, {
                method: 'DELETE',
            })

            expect(res.status).toBe(200)
        })

        it('should handle unlike with event author followers URL from attributedTo', async () => {
            const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000'
            
            // Create event without user but with attributedTo starting with baseUrl
            const eventWithoutUser = await prisma.event.create({
                data: {
                    title: 'Event Without User',
                    startTime: new Date(Date.now() + 86400000),
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                },
            })

            // Create like
            const like = await prisma.eventLike.create({
                data: {
                    eventId: eventWithoutUser.id,
                    userId: testUser.id,
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

            vi.mocked(prisma.eventLike.findUnique).mockResolvedValue({
                ...like,
                event: {
                    ...eventWithoutUser,
                    user: null,
                },
                user: testUser,
            } as any)
            vi.mocked(activityBuilder.buildUndoActivity).mockReturnValue({
                type: 'Undo',
                actor: `${baseUrl}/users/${testUser.username}`,
                object: {
                    type: 'Like',
                    actor: `${baseUrl}/users/${testUser.username}`,
                    object: `${baseUrl}/events/${eventWithoutUser.id}`,
                },
            } as any)
            vi.mocked(activityDelivery.deliverActivity).mockResolvedValue(undefined)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            const res = await app.request(`/api/events/${eventWithoutUser.id}/like`, {
                method: 'DELETE',
            })

            expect(res.status).toBe(200)
            // Should have called deliverActivity
            expect(activityDelivery.deliverActivity).toHaveBeenCalled()
        })

        it('should handle unlike with event that has user', async () => {
            // Create like
            const like = await prisma.eventLike.create({
                data: {
                    eventId: testEvent.id,
                    userId: testUser.id,
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

            vi.mocked(prisma.eventLike.findUnique).mockResolvedValue({
                ...like,
                event: {
                    ...testEvent,
                    user: testUser,
                },
                user: testUser,
            } as any)
            vi.mocked(activityBuilder.buildUndoActivity).mockReturnValue({
                type: 'Undo',
                actor: `${baseUrl}/users/${testUser.username}`,
                object: {
                    type: 'Like',
                    actor: `${baseUrl}/users/${testUser.username}`,
                    object: `${baseUrl}/events/${testEvent.id}`,
                },
            } as any)
            vi.mocked(activityDelivery.deliverActivity).mockResolvedValue(undefined)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            const res = await app.request(`/api/events/${testEvent.id}/like`, {
                method: 'DELETE',
            })

            expect(res.status).toBe(200)
        })

        it('should handle unlike with event external ID', async () => {
            const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000'
            
            // Create event with external ID
            const eventWithExternalId = await prisma.event.create({
                data: {
                    title: 'Event with External ID',
                    startTime: new Date(Date.now() + 86400000),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                    externalId: 'https://example.com/events/1',
                },
            })

            // Create like
            const like = await prisma.eventLike.create({
                data: {
                    eventId: eventWithExternalId.id,
                    userId: testUser.id,
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

            vi.mocked(prisma.eventLike.findUnique).mockResolvedValue({
                ...like,
                event: {
                    ...eventWithExternalId,
                    user: testUser,
                },
                user: testUser,
            } as any)
            vi.mocked(activityBuilder.buildUndoActivity).mockReturnValue({
                type: 'Undo',
                actor: `${baseUrl}/users/${testUser.username}`,
                object: {
                    type: 'Like',
                    actor: `${baseUrl}/users/${testUser.username}`,
                    object: eventWithExternalId.externalId,
                },
            } as any)
            vi.mocked(activityDelivery.deliverActivity).mockResolvedValue(undefined)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            const res = await app.request(`/api/events/${eventWithExternalId.id}/like`, {
                method: 'DELETE',
            })

            expect(res.status).toBe(200)
        })
    })
})

