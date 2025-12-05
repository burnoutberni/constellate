/**
 * Tests for Comments API
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

describe('Comments API', () => {
    let testUser: any
    let testUser2: any
    let testEvent: any
    const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000'

    beforeEach(async () => {
        // Clean up
        await prisma.comment.deleteMany({})
        await prisma.eventAttendance.deleteMany({})
        await prisma.eventLike.deleteMany({})
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
                userId: testUser.id,
                attributedTo: `${baseUrl}/users/${testUser.username}`,
            },
        })

        // Reset mocks
        vi.clearAllMocks()
    })

    describe('POST /:id/comments', () => {
        it('should create a comment successfully', async () => {
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

            const res = await app.request(`/api/events/${testEvent.id}/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: 'Test comment content',
                }),
            })

            expect(res.status).toBe(201)
            const body = await res.json() as any
            expect(body.content).toBe('Test comment content')
            expect(body.authorId).toBe(testUser.id)
            expect(body.eventId).toBe(testEvent.id)
        })

        it('should validate comment content', async () => {
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

            const res = await app.request(`/api/events/${testEvent.id}/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: '', // Empty content
                }),
            })

            expect(res.status).toBe(400)
        })



        it('should return 401 when not authenticated and handle AppError', async () => {
            vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue(null)

            const res = await app.request(`/api/events/${testEvent.id}/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: 'Test comment',
                }),
            })

            expect(res.status).toBe(401)
            const body = await res.json() as any
            expect(body.error).toBe('UNAUTHORIZED')
            expect(body.message).toBeDefined()
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

            const res = await app.request('/api/events/non-existent-id/comments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: 'Test comment',
                }),
            })

            expect(res.status).toBe(404)
        })

        it('should create a reply comment', async () => {
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

            // Create parent comment
            const parentComment = await prisma.comment.create({
                data: {
                    content: 'Parent comment',
                    eventId: testEvent.id,
                    authorId: testUser.id,
                },
            })

            const res = await app.request(`/api/events/${testEvent.id}/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: 'Reply comment',
                    inReplyToId: parentComment.id,
                }),
            })

            expect(res.status).toBe(201)
            const body = await res.json() as any
            expect(body.content).toBe('Reply comment')
            expect(body.inReplyToId).toBe(parentComment.id)
        })

        it('should return 400 when replying to invalid parent comment', async () => {
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

            const res = await app.request(`/api/events/${testEvent.id}/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: 'Reply comment',
                    inReplyToId: 'invalid-comment-id',
                }),
            })

            expect(res.status).toBe(400)
        })
    })

    describe('GET /:id/comments', () => {
        it('should return empty array when no comments', async () => {
            const res = await app.request(`/api/events/${testEvent.id}/comments`, {
                method: 'GET',
            })

            expect(res.status).toBe(200)
            const body = await res.json() as any
            expect(body.comments).toHaveLength(0)
            expect(body.count).toBe(0)
        })

        it('should return comments with replies', async () => {
            // Create parent comment
            const parentComment = await prisma.comment.create({
                data: {
                    content: 'Parent comment',
                    eventId: testEvent.id,
                    authorId: testUser.id,
                },
            })

            // Create reply
            await prisma.comment.create({
                data: {
                    content: 'Reply comment',
                    eventId: testEvent.id,
                    authorId: testUser.id,
                    inReplyToId: parentComment.id,
                },
            })

            const res = await app.request(`/api/events/${testEvent.id}/comments`, {
                method: 'GET',
            })

            expect(res.status).toBe(200)
            const body = await res.json() as any
            expect(body.comments).toHaveLength(1)
            expect(body.comments[0].replies).toHaveLength(1)
        })
    })

    describe('DELETE /comments/:commentId', () => {





        it('should delete a comment successfully', async () => {
            const comment = await prisma.comment.create({
                data: {
                    content: 'Comment to delete',
                    eventId: testEvent.id,
                    authorId: testUser.id,
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

            const res = await app.request(`/api/events/comments/${comment.id}`, {
                method: 'DELETE',
            })

            expect(res.status).toBe(200)
            const body = await res.json() as any
            expect(body.success).toBe(true)

            // Verify comment is deleted
            const deletedComment = await prisma.comment.findUnique({
                where: { id: comment.id },
            })
            expect(deletedComment).toBeNull()
        })

        it('should return 401 when not authenticated and handle AppError', async () => {
            const comment = await prisma.comment.create({
                data: {
                    content: 'Comment to delete',
                    eventId: testEvent.id,
                    authorId: testUser.id,
                },
            })

            vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue(null)

            const res = await app.request(`/api/events/comments/${comment.id}`, {
                method: 'DELETE',
            })

            expect(res.status).toBe(401)
            const body = await res.json() as any
            expect(body.error).toBe('UNAUTHORIZED')
            expect(body.message).toBeDefined()
        })

        it('should return 403 when trying to delete another user\'s comment', async () => {
            const comment = await prisma.comment.create({
                data: {
                    content: 'Comment to delete',
                    eventId: testEvent.id,
                    authorId: testUser.id,
                },
            })

            vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue({
                user: {
                    id: testUser2.id,
                    username: testUser2.username,
                    email: testUser2.email,
                },
                session: {
                    id: 'test-session-2',
                    userId: testUser2.id,
                    expiresAt: new Date(Date.now() + 86400000),
                },
            } as any)

            const res = await app.request(`/api/events/comments/${comment.id}`, {
                method: 'DELETE',
            })

            expect(res.status).toBe(403)
        })

        it('should return 404 when comment not found', async () => {
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

            const res = await app.request('/api/events/comments/non-existent-id', {
                method: 'DELETE',
            })

            expect(res.status).toBe(404)
        })







    })
})

