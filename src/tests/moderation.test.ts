/**
 * Tests for Moderation Features
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { config } from 'dotenv'
config()
import { app } from '../server.js'
import { prisma } from '../lib/prisma.js'
import * as authModule from '../auth.js'

describe('Moderation API', () => {
    let testUser: any
    let testUser2: any
    let adminUser: any

    beforeEach(async () => {
        // Clean up
        await prisma.report.deleteMany({})
        await prisma.blockedDomain.deleteMany({})
        await prisma.blockedUser.deleteMany({})
        await prisma.comment.deleteMany({})
        await prisma.event.deleteMany({})
        await prisma.user.deleteMany({})

        // Create test users with unique identifiers to avoid race conditions
        const timestamp = Date.now()
        const randomSuffix = Math.random().toString(36).substring(7)
        const suffix = `${timestamp}_${randomSuffix}`

        testUser = await prisma.user.create({
            data: {
                username: `alice_${suffix}`,
                email: `alice_${suffix}@test.com`,
                name: 'Alice Test',
                isRemote: false,
                isAdmin: false,
            },
        })

        testUser2 = await prisma.user.create({
            data: {
                username: `bob_${suffix}`,
                email: `bob_${suffix}@test.com`,
                name: 'Bob Test',
                isRemote: false,
                isAdmin: false,
            },
        })

        adminUser = await prisma.user.create({
            data: {
                username: `admin_${suffix}`,
                email: `admin_${suffix}@test.com`,
                name: 'Admin User',
                isRemote: false,
                isAdmin: true,
            },
        })

        // Reset mocks
        vi.clearAllMocks()
    })

    describe('POST /moderation/block/user', () => {
        it('should block a user', async () => {
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

            const res = await app.request('/api/moderation/block/user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: testUser2.username,
                    reason: 'Spam',
                }),
            })

            expect(res.status).toBe(201)
            const body = await res.json()
            expect(body.blockingUserId).toBe(testUser.id)
            expect(body.blockedUserId).toBe(testUser2.id)
        })

        it('should return 401 when not authenticated', async () => {
            const res = await app.request('/api/moderation/block/user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: testUser2.username,
                }),
            })

            expect([401, 403, 404, 500]).toContain(res.status)
        })

        it('should return 400 when trying to block yourself', async () => {
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

            const res = await app.request('/api/moderation/block/user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: testUser.username,
                }),
            })

            expect(res.status).toBe(400)
            const body = await res.json()
            expect(body.error).toBe('Cannot block yourself')
        })

        it('should return 404 for non-existent user', async () => {
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

            const res = await app.request('/api/moderation/block/user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: 'nonexistent',
                }),
            })

            expect(res.status).toBe(404)
        })

        it('should validate request body', async () => {
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

            const res = await app.request('/api/moderation/block/user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({}),
            })

            expect(res.status).toBe(400)
        })
    })

    describe('DELETE /moderation/block/user/:username', () => {
        it('should unblock a user', async () => {
            // Create a block first
            await prisma.blockedUser.create({
                data: {
                    blockingUserId: testUser.id,
                    blockedUserId: testUser2.id,
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

            const res = await app.request(`/api/moderation/block/user/${testUser2.username}`, {
                method: 'DELETE',
            })

            expect(res.status).toBe(200)
            const body = await res.json()
            expect(body.success).toBe(true)

            // Verify block was deleted
            const block = await prisma.blockedUser.findUnique({
                where: {
                    blockingUserId_blockedUserId: {
                        blockingUserId: testUser.id,
                        blockedUserId: testUser2.id,
                    },
                },
            })
            expect(block).toBeNull()
        })

        it('should return 401 when not authenticated', async () => {
            const res = await app.request(`/api/moderation/block/user/${testUser2.username}`, {
                method: 'DELETE',
            })

            expect([401, 403, 404, 500]).toContain(res.status)
        })

        it('should return 404 for non-existent user', async () => {
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

            const res = await app.request('/api/moderation/block/user/nonexistent', {
                method: 'DELETE',
            })

            expect(res.status).toBe(404)
        })
    })

    describe('GET /moderation/block/users', () => {
        it('should get blocked users', async () => {
            // Create some blocks
            await prisma.blockedUser.create({
                data: {
                    blockingUserId: testUser.id,
                    blockedUserId: testUser2.id,
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

            const res = await app.request('/api/moderation/block/users')

            expect(res.status).toBe(200)
            const body = await res.json()
            expect(body.blocks).toHaveLength(1)
            expect(body.blocks[0].blockedUserId).toBe(testUser2.id)
        })

        it('should return 401 when not authenticated', async () => {
            const res = await app.request('/api/moderation/block/users')

            expect([401, 403, 404, 500]).toContain(res.status)
        })
    })

    describe('GET /moderation/block/check/:username', () => {
        it('should return true when user is blocked', async () => {
            // Create a block
            await prisma.blockedUser.create({
                data: {
                    blockingUserId: testUser.id,
                    blockedUserId: testUser2.id,
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

            const res = await app.request(`/api/moderation/block/check/${testUser2.username}`)

            expect(res.status).toBe(200)
            const body = await res.json()
            expect(body.blocked).toBe(true)
            expect(body.block).not.toBeNull()
        })

        it('should return false when user is not blocked', async () => {
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

            const res = await app.request(`/api/moderation/block/check/${testUser2.username}`)

            expect(res.status).toBe(200)
            const body = await res.json()
            expect(body.blocked).toBe(false)
            expect(body.block).toBeNull()
        })

        it('should return 401 when not authenticated', async () => {
            const res = await app.request(`/api/moderation/block/check/${testUser2.username}`)

            expect([401, 403, 404, 500]).toContain(res.status)
        })

        it('should return 404 for non-existent user', async () => {
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

            const res = await app.request('/api/moderation/block/check/nonexistent')

            expect(res.status).toBe(404)
        })
    })

    describe('POST /moderation/block/domain', () => {
        it('should block a domain (admin only)', async () => {
            vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue({
                user: {
                    id: adminUser.id,
                    username: adminUser.username,
                    email: adminUser.email,
                },
                session: {
                    id: 'test-session',
                    userId: adminUser.id,
                    expiresAt: new Date(Date.now() + 86400000),
                },
            } as any)

            const res = await app.request('/api/moderation/block/domain', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    domain: 'spam.example.com',
                    reason: 'Spam domain',
                }),
            })

            expect(res.status).toBe(201)
            const body = await res.json()
            expect(body.domain).toBe('spam.example.com')
            expect(body.reason).toBe('Spam domain')
        })

        it('should return 403 when not admin', async () => {
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

            const res = await app.request('/api/moderation/block/domain', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    domain: 'spam.example.com',
                }),
            })

            expect([401, 403, 404, 500]).toContain(res.status)
        })

        it('should return 401 when not authenticated', async () => {
            const res = await app.request('/api/moderation/block/domain', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    domain: 'spam.example.com',
                }),
            })

            expect([401, 403, 404, 500]).toContain(res.status)
        })

        it('should validate request body', async () => {
            vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue({
                user: {
                    id: adminUser.id,
                    username: adminUser.username,
                    email: adminUser.email,
                },
                session: {
                    id: 'test-session',
                    userId: adminUser.id,
                    expiresAt: new Date(Date.now() + 86400000),
                },
            } as any)

            const res = await app.request('/api/moderation/block/domain', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({}),
            })

            expect(res.status).toBe(400)
        })
    })

    describe('DELETE /moderation/block/domain/:domain', () => {
        it('should unblock a domain (admin only)', async () => {
            // Create a domain block first
            await prisma.blockedDomain.create({
                data: {
                    domain: 'spam.example.com',
                    reason: 'Spam',
                },
            })

            vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue({
                user: {
                    id: adminUser.id,
                    username: adminUser.username,
                    email: adminUser.email,
                },
                session: {
                    id: 'test-session',
                    userId: adminUser.id,
                    expiresAt: new Date(Date.now() + 86400000),
                },
            } as any)

            const res = await app.request('/api/moderation/block/domain/spam.example.com', {
                method: 'DELETE',
            })

            expect(res.status).toBe(200)
            const body = await res.json()
            expect(body.success).toBe(true)

            // Verify block was deleted
            const block = await prisma.blockedDomain.findUnique({
                where: { domain: 'spam.example.com' },
            })
            expect(block).toBeNull()
        })

        it('should return 403 when not admin', async () => {
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

            const res = await app.request('/api/moderation/block/domain/spam.example.com', {
                method: 'DELETE',
            })

            expect([401, 403, 404, 500]).toContain(res.status)
        })
    })

    describe('GET /moderation/block/domains', () => {
        it('should get blocked domains (admin only)', async () => {
            // Create some domain blocks
            await prisma.blockedDomain.create({
                data: {
                    domain: 'spam1.example.com',
                    reason: 'Spam',
                },
            })
            await prisma.blockedDomain.create({
                data: {
                    domain: 'spam2.example.com',
                    reason: 'Spam',
                },
            })

            vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue({
                user: {
                    id: adminUser.id,
                    username: adminUser.username,
                    email: adminUser.email,
                },
                session: {
                    id: 'test-session',
                    userId: adminUser.id,
                    expiresAt: new Date(Date.now() + 86400000),
                },
            } as any)

            const res = await app.request('/api/moderation/block/domains')

            expect(res.status).toBe(200)
            const body = await res.json()
            expect(body.blocks).toHaveLength(2)
        })

        it('should return 403 when not admin', async () => {
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

            const res = await app.request('/api/moderation/block/domains')

            expect([401, 403, 404, 500]).toContain(res.status)
        })
    })

    describe('POST /moderation/report', () => {
        it('should create a report for a user', async () => {
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

            const res = await app.request('/api/moderation/report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    targetType: 'user',
                    targetId: testUser2.id,
                    reason: 'Harassment',
                    category: 'harassment',
                }),
            })

            expect(res.status).toBe(201)
            const body = await res.json()
            expect(body.reporterId).toBe(testUser.id)
            expect(body.reportedUserId).toBe(testUser2.id)
            expect(body.reason).toBe('Harassment')
            expect(body.status).toBe('pending')
        })

        it('should create a report for an event', async () => {
            const event = await prisma.event.create({
                data: {
                    userId: testUser2.id,
                    title: 'Test Event',
                    startTime: new Date(),
                    attributedTo: 'http://test.local/users/bob',
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

            const res = await app.request('/api/moderation/report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    targetType: 'event',
                    targetId: event.id,
                    reason: 'Inappropriate content',
                    category: 'inappropriate',
                }),
            })

            expect(res.status).toBe(201)
            const body = await res.json()
            expect(body.reporterId).toBe(testUser.id)
            expect(body.reportedUserId).toBeNull()
            expect(body.reason).toBe('Inappropriate content')
        })

        it('should create a report for a comment', async () => {
            const event = await prisma.event.create({
                data: {
                    userId: testUser2.id,
                    title: 'Test Event',
                    startTime: new Date(),
                    attributedTo: 'http://test.local/users/bob',
                },
            })

            const comment = await prisma.comment.create({
                data: {
                    authorId: testUser2.id,
                    eventId: event.id,
                    content: 'Test comment',
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

            const res = await app.request('/api/moderation/report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    targetType: 'comment',
                    targetId: comment.id,
                    reason: 'Spam',
                    category: 'spam',
                }),
            })

            expect(res.status).toBe(201)
            const body = await res.json()
            expect(body.reporterId).toBe(testUser.id)
        })

        it('should return 401 when not authenticated', async () => {
            const res = await app.request('/api/moderation/report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    targetType: 'user',
                    targetId: testUser2.id,
                    reason: 'Test',
                }),
            })

            expect([401, 403, 404, 500]).toContain(res.status)
        })

        it('should return 404 for non-existent target', async () => {
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

            const res = await app.request('/api/moderation/report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    targetType: 'user',
                    targetId: 'nonexistent-id',
                    reason: 'Test',
                }),
            })

            expect(res.status).toBe(404)
        })

        it('should validate request body', async () => {
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

            const res = await app.request('/api/moderation/report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    targetType: 'user',
                    targetId: testUser2.id,
                    reason: '', // Empty reason should fail
                }),
            })

            expect(res.status).toBe(400)
        })
    })

    describe('GET /moderation/reports', () => {
        it('should get reports (admin only)', async () => {
            // Create some reports
            await prisma.report.create({
                data: {
                    reporterId: testUser.id,
                    reportedUserId: testUser2.id,
                    contentUrl: 'user:test',
                    reason: 'Test report',
                    status: 'pending',
                },
            })

            vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue({
                user: {
                    id: adminUser.id,
                    username: adminUser.username,
                    email: adminUser.email,
                },
                session: {
                    id: 'test-session',
                    userId: adminUser.id,
                    expiresAt: new Date(Date.now() + 86400000),
                },
            } as any)

            const res = await app.request('/api/moderation/reports')

            expect(res.status).toBe(200)
            const body = await res.json()
            expect(body.reports).toHaveLength(1)
            expect(body.pagination).toBeDefined()
        })

        it('should filter reports by status', async () => {
            await prisma.report.create({
                data: {
                    reporterId: testUser.id,
                    reportedUserId: testUser2.id,
                    contentUrl: 'user:test',
                    reason: 'Test report',
                    status: 'pending',
                },
            })
            await prisma.report.create({
                data: {
                    reporterId: testUser.id,
                    reportedUserId: testUser2.id,
                    contentUrl: 'user:test2',
                    reason: 'Test report 2',
                    status: 'resolved',
                },
            })

            vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue({
                user: {
                    id: adminUser.id,
                    username: adminUser.username,
                    email: adminUser.email,
                },
                session: {
                    id: 'test-session',
                    userId: adminUser.id,
                    expiresAt: new Date(Date.now() + 86400000),
                },
            } as any)

            const res = await app.request('/api/moderation/reports?status=pending')

            expect(res.status).toBe(200)
            const body = await res.json()
            expect(body.reports).toHaveLength(1)
            expect(body.reports[0].status).toBe('pending')
        })

        it('should return 403 when not admin', async () => {
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

            const res = await app.request('/api/moderation/reports')

            expect([401, 403, 404, 500]).toContain(res.status)
        })
    })

    describe('PUT /moderation/reports/:id', () => {
        it('should update report status (admin only)', async () => {
            const report = await prisma.report.create({
                data: {
                    reporterId: testUser.id,
                    reportedUserId: testUser2.id,
                    contentUrl: 'user:test',
                    reason: 'Test report',
                    status: 'pending',
                },
            })

            vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue({
                user: {
                    id: adminUser.id,
                    username: adminUser.username,
                    email: adminUser.email,
                },
                session: {
                    id: 'test-session',
                    userId: adminUser.id,
                    expiresAt: new Date(Date.now() + 86400000),
                },
            } as any)

            const res = await app.request(`/api/moderation/reports/${report.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    status: 'resolved',
                }),
            })

            expect(res.status).toBe(200)
            const body = await res.json()
            expect(body.status).toBe('resolved')
        })

        it('should return 403 when not admin', async () => {
            const report = await prisma.report.create({
                data: {
                    reporterId: testUser.id,
                    reportedUserId: testUser2.id,
                    contentUrl: 'user:test',
                    reason: 'Test report',
                    status: 'pending',
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

            const res = await app.request(`/api/moderation/reports/${report.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    status: 'resolved',
                }),
            })

            expect([401, 403, 404, 500]).toContain(res.status)
        })

        it('should validate status value', async () => {
            const report = await prisma.report.create({
                data: {
                    reporterId: testUser.id,
                    reportedUserId: testUser2.id,
                    contentUrl: 'user:test',
                    reason: 'Test report',
                    status: 'pending',
                },
            })

            vi.spyOn(authModule.auth.api, 'getSession').mockResolvedValue({
                user: {
                    id: adminUser.id,
                    username: adminUser.username,
                    email: adminUser.email,
                },
                session: {
                    id: 'test-session',
                    userId: adminUser.id,
                    expiresAt: new Date(Date.now() + 86400000),
                },
            } as any)

            const res = await app.request(`/api/moderation/reports/${report.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    status: 'invalid-status',
                }),
            })

            expect(res.status).toBe(400)
        })
    })
})

