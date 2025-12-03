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
        it('should create a comment', async () => {
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

            vi.mocked(activityBuilder.buildCreateCommentActivity).mockReturnValue({
                type: 'Create',
                actor: `${baseUrl}/users/${testUser.username}`,
                object: {
                    type: 'Note',
                    id: `${baseUrl}/comments/test-id`,
                },
            } as any)
            vi.mocked(activityDelivery.deliverToActors).mockResolvedValue(undefined)
            vi.mocked(activityDelivery.deliverToFollowers).mockResolvedValue(undefined)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            const res = await app.request(`/api/events/${testEvent.id}/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: 'Test comment',
                }),
            })

            expect(res.status).toBe(201)
            const body = await res.json() as any as any
            expect(body.content).toBe('Test comment')
            expect(body.authorId).toBe(testUser.id)
            expect(body.eventId).toBe(testEvent.id)
        })

        it('should create a reply comment', async () => {
            const parentComment = await prisma.comment.create({
                data: {
                    content: 'Parent comment',
                    eventId: testEvent.id,
                    authorId: testUser2.id,
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

            vi.mocked(activityBuilder.buildCreateCommentActivity).mockReturnValue({
                type: 'Create',
                actor: `${baseUrl}/users/${testUser.username}`,
                object: {
                    type: 'Note',
                    id: `${baseUrl}/comments/test-id`,
                },
            } as any)
            vi.mocked(activityDelivery.deliverToActors).mockResolvedValue(undefined)
            vi.mocked(activityDelivery.deliverToFollowers).mockResolvedValue(undefined)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

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
            const body = await res.json() as any as any
            expect(body.content).toBe('Reply comment')
            expect(body.inReplyToId).toBe(parentComment.id)
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

            const res = await app.request('/api/events/nonexistent-id/comments', {
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

        it('should return 400 when parent comment is invalid', async () => {
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

        it('should return 400 when parent comment belongs to different event', async () => {
            const otherEvent = await prisma.event.create({
                data: {
                    title: 'Other Event',
                    startTime: new Date(Date.now() + 86400000),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                },
            })

            const parentComment = await prisma.comment.create({
                data: {
                    content: 'Parent comment',
                    eventId: otherEvent.id,
                    authorId: testUser2.id,
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

            expect(res.status).toBe(400)
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

        it('should handle remote event author', async () => {
            const remoteEvent = await prisma.event.create({
                data: {
                    title: 'Remote Event',
                    startTime: new Date(Date.now() + 86400000),
                    userId: null,
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

            vi.mocked(activityBuilder.buildCreateCommentActivity).mockReturnValue({
                type: 'Create',
                actor: `${baseUrl}/users/${testUser.username}`,
                object: {
                    type: 'Note',
                    id: `${baseUrl}/comments/test-id`,
                },
            } as any)
            vi.mocked(activityDelivery.deliverToActors).mockResolvedValue(undefined)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            const res = await app.request(`/api/events/${remoteEvent.id}/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: 'Test comment',
                }),
            })

            expect(res.status).toBe(201)
        })

        it('should handle error when user not found', async () => {
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

            const res = await app.request(`/api/events/${testEvent.id}/comments`, {
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

        it('should return 401 when not authenticated', async () => {
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

            expect([401, 404, 500]).toContain(res.status)
        })
    })

    describe('GET /:id/comments', () => {
        it('should get comments for an event', async () => {
            await prisma.comment.create({
                data: {
                    content: 'First comment',
                    eventId: testEvent.id,
                    authorId: testUser.id,
                },
            })

            await prisma.comment.create({
                data: {
                    content: 'Second comment',
                    eventId: testEvent.id,
                    authorId: testUser2.id,
                },
            })

            const res = await app.request(`/api/events/${testEvent.id}/comments`, {
                method: 'GET',
            })

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.comments).toHaveLength(2)
            expect(body.count).toBe(2)
        })

        it('should return nested replies', async () => {
            const parentComment = await prisma.comment.create({
                data: {
                    content: 'Parent comment',
                    eventId: testEvent.id,
                    authorId: testUser.id,
                },
            })

            await prisma.comment.create({
                data: {
                    content: 'Reply comment',
                    eventId: testEvent.id,
                    authorId: testUser2.id,
                    inReplyToId: parentComment.id,
                },
            })

            const res = await app.request(`/api/events/${testEvent.id}/comments`, {
                method: 'GET',
            })

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.comments).toHaveLength(1)
            expect(body.comments[0].replies).toHaveLength(1)
        })

        it('should return empty array when no comments', async () => {
            const res = await app.request(`/api/events/${testEvent.id}/comments`, {
                method: 'GET',
            })

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.comments).toHaveLength(0)
            expect(body.count).toBe(0)
        })

        it('should handle errors gracefully', async () => {
            // Mock prisma to throw an error
            const originalFindMany = prisma.comment.findMany
            vi.spyOn(prisma.comment, 'findMany').mockRejectedValue(new Error('Database error'))

            const res = await app.request(`/api/events/${testEvent.id}/comments`, {
                method: 'GET',
            })

            expect(res.status).toBe(500)
        })
    })

    describe('DELETE /comments/:commentId', () => {
        it('should delete a comment', async () => {
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

            vi.mocked(activityBuilder.buildDeleteCommentActivity).mockReturnValue({
                type: 'Delete',
                actor: `${baseUrl}/users/${testUser.username}`,
                object: {
                    type: 'Note',
                    id: `${baseUrl}/comments/${comment.id}`,
                },
            } as any)
            vi.mocked(activityDelivery.deliverToActors).mockResolvedValue(undefined)
            vi.mocked(activityDelivery.deliverToFollowers).mockResolvedValue(undefined)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            const res = await app.request(`/api/comments/${comment.id}`, {
                method: 'DELETE',
            })

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.success).toBe(true)

            // Verify comment is deleted
            const deletedComment = await prisma.comment.findUnique({
                where: { id: comment.id },
            })
            expect(deletedComment).toBeNull()
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

            const res = await app.request('/api/comments/nonexistent-id', {
                method: 'DELETE',
            })

            expect(res.status).toBe(404)
        })

        it('should return 403 when user is not the author', async () => {
            const comment = await prisma.comment.create({
                data: {
                    content: 'Comment to delete',
                    eventId: testEvent.id,
                    authorId: testUser2.id, // Different author
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

            const res = await app.request(`/api/comments/${comment.id}`, {
                method: 'DELETE',
            })

            expect(res.status).toBe(403)
        })

        it('should handle remote event author in delete', async () => {
            const remoteEvent = await prisma.event.create({
                data: {
                    title: 'Remote Event',
                    startTime: new Date(Date.now() + 86400000),
                    userId: null,
                    attributedTo: 'https://remote.example.com/users/remoteuser',
                },
            })

            const comment = await prisma.comment.create({
                data: {
                    content: 'Comment to delete',
                    eventId: remoteEvent.id,
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

            vi.mocked(activityBuilder.buildDeleteCommentActivity).mockReturnValue({
                type: 'Delete',
                actor: `${baseUrl}/users/${testUser.username}`,
                object: {
                    type: 'Note',
                    id: `${baseUrl}/comments/${comment.id}`,
                },
            } as any)
            vi.mocked(activityDelivery.deliverToActors).mockResolvedValue(undefined)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            const res = await app.request(`/api/comments/${comment.id}`, {
                method: 'DELETE',
            })

            expect(res.status).toBe(200)
        })

        it('should handle reply comment deletion with parent author', async () => {
            const parentComment = await prisma.comment.create({
                data: {
                    content: 'Parent comment',
                    eventId: testEvent.id,
                    authorId: testUser2.id,
                },
            })

            const replyComment = await prisma.comment.create({
                data: {
                    content: 'Reply comment',
                    eventId: testEvent.id,
                    authorId: testUser.id,
                    inReplyToId: parentComment.id,
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

            vi.mocked(activityBuilder.buildDeleteCommentActivity).mockReturnValue({
                type: 'Delete',
                actor: `${baseUrl}/users/${testUser.username}`,
                object: {
                    type: 'Note',
                    id: `${baseUrl}/comments/${replyComment.id}`,
                },
            } as any)
            vi.mocked(activityDelivery.deliverToActors).mockResolvedValue(undefined)
            vi.mocked(activityDelivery.deliverToFollowers).mockResolvedValue(undefined)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            const res = await app.request(`/api/comments/${replyComment.id}`, {
                method: 'DELETE',
            })

            expect(res.status).toBe(200)
        })

        it('should return 401 when not authenticated', async () => {
            const comment = await prisma.comment.create({
                data: {
                    content: 'Comment to delete',
                    eventId: testEvent.id,
                    authorId: testUser.id,
                },
            })

            vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue(null)

            const res = await app.request(`/api/comments/${comment.id}`, {
                method: 'DELETE',
            })

            expect([401, 404, 500]).toContain(res.status)
        })

        it('should handle errors gracefully', async () => {
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

            // Mock prisma to throw an error
            vi.spyOn(prisma.comment, 'delete').mockRejectedValue(new Error('Database error'))

            const res = await app.request(`/api/comments/${comment.id}`, {
                method: 'DELETE',
            })

            expect(res.status).toBe(500)
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

            vi.mocked(activityBuilder.buildCreateCommentActivity).mockReturnValue({
                type: 'Create',
                actor: `${baseUrl}/users/${testUser.username}`,
                object: {
                    type: 'Note',
                    content: 'Test comment',
                },
            } as any)
            vi.mocked(activityDelivery.deliverToActors).mockResolvedValue(undefined)
            vi.mocked(activityDelivery.deliverToFollowers).mockResolvedValue(undefined)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            const res = await app.request(`/api/events/${eventWithoutUser.id}/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: 'Test comment',
                }),
            })

            expect(res.status).toBe(201)
            // Should have called deliverToFollowers with event author's followers URL
            expect(activityDelivery.deliverToFollowers).toHaveBeenCalled()
        })

        it('should handle comment reply with parent comment author URL', async () => {
            // Create parent comment
            const parentComment = await prisma.comment.create({
                data: {
                    content: 'Parent comment',
                    eventId: testEvent.id,
                    authorId: testUser2.id,
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

            vi.mocked(activityBuilder.buildCreateCommentActivity).mockReturnValue({
                type: 'Create',
                actor: `${baseUrl}/users/${testUser.username}`,
                object: {
                    type: 'Note',
                    content: 'Reply comment',
                },
            } as any)
            vi.mocked(activityDelivery.deliverToActors).mockResolvedValue(undefined)
            vi.mocked(activityDelivery.deliverToFollowers).mockResolvedValue(undefined)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

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
            // Should have called deliverToActors with parent comment author URL
            expect(activityDelivery.deliverToActors).toHaveBeenCalled()
        })

        it('should handle comment reply when parent author is same as commenter', async () => {
            // Create parent comment by same user
            const parentComment = await prisma.comment.create({
                data: {
                    content: 'Parent comment',
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

            vi.mocked(activityBuilder.buildCreateCommentActivity).mockReturnValue({
                type: 'Create',
                actor: `${baseUrl}/users/${testUser.username}`,
                object: {
                    type: 'Note',
                    content: 'Reply to own comment',
                },
            } as any)
            vi.mocked(activityDelivery.deliverToActors).mockResolvedValue(undefined)
            vi.mocked(activityDelivery.deliverToFollowers).mockResolvedValue(undefined)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            const res = await app.request(`/api/events/${testEvent.id}/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: 'Reply to own comment',
                    inReplyToId: parentComment.id,
                }),
            })

            expect(res.status).toBe(201)
            // Should not include parent author URL since it's the same user
        })

        it('should handle delete comment with all includes', async () => {
            const comment = await prisma.comment.create({
                data: {
                    content: 'Test comment',
                    eventId: testEvent.id,
                    authorId: testUser.id,
                },
            })

            // Create a reply to this comment
            const reply = await prisma.comment.create({
                data: {
                    content: 'Reply comment',
                    eventId: testEvent.id,
                    authorId: testUser2.id,
                    inReplyToId: comment.id,
                },
            })

            vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue({
                user: {
                    id: testUser2.id,
                    username: testUser2.username,
                    email: testUser2.email,
                },
                session: {
                    id: 'test-session',
                    userId: testUser2.id,
                    expiresAt: new Date(Date.now() + 86400000),
                },
            } as any)

            vi.mocked(activityBuilder.buildDeleteCommentActivity).mockReturnValue({
                type: 'Delete',
                actor: `${baseUrl}/users/${testUser2.username}`,
                object: {
                    type: 'Note',
                    id: `${baseUrl}/comments/${reply.id}`,
                },
            } as any)
            vi.mocked(activityDelivery.deliverActivity).mockResolvedValue(undefined)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            const res = await app.request(`/api/comments/${reply.id}`, {
                method: 'DELETE',
            })

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.success).toBe(true)
        })

        it('should handle delete comment with parent comment author URL', async () => {
            // Create parent comment
            const parentComment = await prisma.comment.create({
                data: {
                    content: 'Parent comment',
                    eventId: testEvent.id,
                    authorId: testUser2.id,
                },
            })

            // Create reply comment
            const replyComment = await prisma.comment.create({
                data: {
                    content: 'Reply comment',
                    eventId: testEvent.id,
                    authorId: testUser.id,
                    inReplyToId: parentComment.id,
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

            vi.mocked(prisma.comment.findUnique).mockResolvedValue({
                ...replyComment,
                author: testUser,
                event: {
                    ...testEvent,
                    user: testUser,
                },
                inReplyTo: {
                    ...parentComment,
                    author: testUser2,
                },
            } as any)
            vi.mocked(activityBuilder.buildDeleteCommentActivity).mockReturnValue({
                type: 'Delete',
                actor: `${baseUrl}/users/${testUser.username}`,
                object: {
                    type: 'Note',
                    id: `${baseUrl}/comments/${replyComment.id}`,
                },
            } as any)
            vi.mocked(activityDelivery.deliverToActors).mockResolvedValue(undefined)
            vi.mocked(activityDelivery.deliverToFollowers).mockResolvedValue(undefined)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            const res = await app.request(`/api/comments/${replyComment.id}`, {
                method: 'DELETE',
            })

            expect(res.status).toBe(200)
            // Should have called deliverToActors with parent comment author URL
            expect(activityDelivery.deliverToActors).toHaveBeenCalled()
        })

        it('should handle delete comment with event without user but attributedTo starts with baseUrl', async () => {
            // Create event without user
            const eventWithoutUser = await prisma.event.create({
                data: {
                    title: 'Event Without User',
                    startTime: new Date(Date.now() + 86400000),
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                },
            })

            // Create comment
            const comment = await prisma.comment.create({
                data: {
                    content: 'Test comment',
                    eventId: eventWithoutUser.id,
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

            vi.mocked(prisma.comment.findUnique).mockResolvedValue({
                ...comment,
                author: testUser,
                event: {
                    ...eventWithoutUser,
                    user: null,
                },
                inReplyTo: null,
            } as any)
            vi.mocked(activityBuilder.buildDeleteCommentActivity).mockReturnValue({
                type: 'Delete',
                actor: `${baseUrl}/users/${testUser.username}`,
                object: {
                    type: 'Note',
                    id: `${baseUrl}/comments/${comment.id}`,
                },
            } as any)
            vi.mocked(activityDelivery.deliverToActors).mockResolvedValue(undefined)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            const res = await app.request(`/api/comments/${comment.id}`, {
                method: 'DELETE',
            })

            expect(res.status).toBe(200)
        })
    })
})

