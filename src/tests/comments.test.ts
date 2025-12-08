/**
 * Tests for Comments API
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
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
        await prisma.commentMention.deleteMany({})
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

        it('should record mentions and notify mentioned user', async () => {
            const broadcastMock = realtime.broadcast as unknown as Mock

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
                    content: `Hello @${testUser2.username}, excited to see you there!`,
                }),
            })

            expect(res.status).toBe(201)
            const body = await res.json() as any
            expect(body.mentions).toHaveLength(1)
            expect(body.mentions[0].mentionedUser.username).toBe(testUser2.username)

            const mentionRecords = await prisma.commentMention.findMany({
                where: { commentId: body.id },
            })
            expect(mentionRecords).toHaveLength(1)
            expect(mentionRecords[0].mentionedUserId).toBe(testUser2.id)

            const mentionBroadcastCall = broadcastMock.mock.calls.find(
                (call: any[]) => call[0]?.type === 'mention:received'
            )
            expect(mentionBroadcastCall).toBeTruthy()
            expect(mentionBroadcastCall?.[0]).toMatchObject({
                targetUserId: testUser2.id,
                data: expect.objectContaining({
                    commentId: body.id,
                    eventId: testEvent.id,
                }),
            })
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

    describe('POST /:id/comments - edge cases', () => {
        it('should handle event with null user but external URL', async () => {
            // Create event with null user (external/federated event)
            const externalEvent = await prisma.event.create({
                data: {
                    title: 'External Event',
                    summary: 'External event description',
                    startTime: new Date(Date.now() + 86400000),
                    endTime: new Date(Date.now() + 86400000 + 3600000),
                    userId: null,
                    attributedTo: `${baseUrl}/users/external_user`,
                    visibility: 'PUBLIC',
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

            const res = await app.request(`/api/events/${externalEvent.id}/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: 'Comment on external event',
                }),
            })

            expect(res.status).toBe(201)
        })

        it('should not set parentCommentAuthorUrl when replying to own comment', async () => {
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

            // Create parent comment by same user
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
                    content: 'Reply to own comment',
                    inReplyToId: parentComment.id,
                }),
            })

            expect(res.status).toBe(201)
            const body = await res.json() as any
            expect(body.content).toBe('Reply to own comment')
        })

        it('should handle event with FOLLOWERS visibility', async () => {
            const followersEvent = await prisma.event.create({
                data: {
                    title: 'Followers Event',
                    summary: 'Followers only event',
                    startTime: new Date(Date.now() + 86400000),
                    endTime: new Date(Date.now() + 86400000 + 3600000),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                    visibility: 'FOLLOWERS',
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

            const res = await app.request(`/api/events/${followersEvent.id}/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: 'Comment on followers event',
                }),
            })

            expect(res.status).toBe(201)
        })

        it('should return 404 when user not found after authentication', async () => {
            // Create a user ID that doesn't exist in the database
            const fakeUserId = 'non-existent-user-id'

            vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue({
                user: {
                    id: fakeUserId,
                    username: 'fakeuser',
                    email: 'fake@example.com',
                },
                session: {
                    id: 'test-session',
                    userId: fakeUserId,
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
            const body = await res.json() as any
            expect(body.error).toBe('User not found')
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







        it('should handle delete comment with inReplyTo and different author', async () => {
            // Create parent comment by testUser2
            const parentComment = await prisma.comment.create({
                data: {
                    content: 'Parent comment',
                    eventId: testEvent.id,
                    authorId: testUser2.id,
                },
            })

            // Create reply by testUser
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

            const res = await app.request(`/api/events/comments/${replyComment.id}`, {
                method: 'DELETE',
            })

            expect(res.status).toBe(200)
        })

        it('should handle delete comment with event that has null user', async () => {
            // Create event with null user
            const externalEvent = await prisma.event.create({
                data: {
                    title: 'External Event',
                    summary: 'External event description',
                    startTime: new Date(Date.now() + 86400000),
                    endTime: new Date(Date.now() + 86400000 + 3600000),
                    userId: null,
                    attributedTo: `${baseUrl}/users/external_user`,
                    visibility: 'PUBLIC',
                },
            })

            const comment = await prisma.comment.create({
                data: {
                    content: 'Comment on external event',
                    eventId: externalEvent.id,
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
        })
    })
})

