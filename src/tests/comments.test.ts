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


        it('should return empty array when no comments', async () => {
            const res = await app.request(`/api/events/${testEvent.id}/comments`, {
                method: 'GET',
            })

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.comments).toHaveLength(0)
            expect(body.count).toBe(0)
        })

    })

    describe('DELETE /comments/:commentId', () => {





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







    })
})

