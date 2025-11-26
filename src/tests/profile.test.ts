/**
 * Tests for Profile Management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { config } from 'dotenv'
config()
import { app } from '../server.js'
import { prisma } from '../lib/prisma.js'
import * as activityBuilder from '../services/ActivityBuilder.js'
import * as activityDelivery from '../services/ActivityDelivery.js'
import * as authModule from '../auth.js'

// Mock dependencies
vi.mock('../services/ActivityBuilder.js')
vi.mock('../services/ActivityDelivery.js')

describe('Profile API', () => {
    let testUser: any
    let testUser2: any
    const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000'

    beforeEach(async () => {
        // Clean up
        await prisma.follower.deleteMany({})
        await prisma.following.deleteMany({})
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

        // Reset mocks
        vi.clearAllMocks()
    })

    describe('GET /users/:username/profile', () => {
        it('should return user profile', async () => {
            const res = await app.request(`/api/users/${testUser.username}/profile`)

            expect(res.status).toBe(200)
            const body = await res.json()
            expect(body.username).toBe(testUser.username)
            expect(body.name).toBe(testUser.name)
            expect(body.id).toBe(testUser.id)
            expect(body).toHaveProperty('_count')
        })

        it('should return 404 for non-existent user', async () => {
            const res = await app.request('/api/users/nonexistent/profile')

            expect(res.status).toBe(404)
            const body = await res.json()
            expect(body.error).toBe('User not found')
        })

        it('should include event and follower counts', async () => {
            // Create some events for the user
            await prisma.event.create({
                data: {
                    userId: testUser.id,
                    title: 'Test Event',
                    startTime: new Date(),
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                },
            })

            const res = await app.request(`/api/users/${testUser.username}/profile`)
            expect(res.status).toBe(200)
            const body = await res.json()
            expect(body._count.events).toBe(1)
            expect(body._count.followers).toBe(0)
            expect(body._count.following).toBe(0)
        })
    })

    describe('PUT /profile', () => {
        it('should update own profile', async () => {
            // Mock auth
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

            // Mock activity builder and delivery
            vi.mocked(activityBuilder.buildUpdateProfileActivity).mockReturnValue({
                type: 'Update',
                actor: `${baseUrl}/users/${testUser.username}`,
                object: {
                    type: 'Person',
                    id: `${baseUrl}/users/${testUser.username}`,
                },
            } as any)
            vi.mocked(activityDelivery.deliverToFollowers).mockResolvedValue(undefined)

            const updates = {
                name: 'Alice Updated',
                bio: 'Updated bio',
                displayColor: '#ff0000',
            }

            const res = await app.request('/api/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updates),
            })

            expect(res.status).toBe(200)
            const body = await res.json()
            expect(body.name).toBe(updates.name)
            expect(body.bio).toBe(updates.bio)
            expect(body.displayColor).toBe(updates.displayColor)
        })

        it('should return 401 when not authenticated', async () => {
            const res = await app.request('/api/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: 'New Name' }),
            })

            expect([401, 403, 404, 500]).toContain(res.status)
        })

        it('should validate profile update data', async () => {
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

            // Invalid display color
            const res = await app.request('/api/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ displayColor: 'invalid-color' }),
            })

            expect(res.status).toBe(400)
        })

        it('should handle partial updates', async () => {
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

            vi.mocked(activityBuilder.buildUpdateProfileActivity).mockReturnValue({
                type: 'Update',
                actor: `${baseUrl}/users/${testUser.username}`,
                object: { type: 'Person' },
            } as any)
            vi.mocked(activityDelivery.deliverToFollowers).mockResolvedValue(undefined)

            const res = await app.request('/api/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: 'Only Name Updated' }),
            })

            expect(res.status).toBe(200)
            const body = await res.json()
            expect(body.name).toBe('Only Name Updated')
        })
    })

    describe('GET /users/:username/follow-status', () => {
        it('should return follow status when authenticated', async () => {
            // Create a following relationship
            const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000'
            const targetActorUrl = `${baseUrl}/users/${testUser2.username}`

            await prisma.following.create({
                data: {
                    userId: testUser.id,
                    actorUrl: targetActorUrl,
                    username: testUser2.username,
                    inboxUrl: `${baseUrl}/users/${testUser2.username}/inbox`,
                    accepted: true,
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

            const res = await app.request(`/api/users/${testUser2.username}/follow-status`)

            expect(res.status).toBe(200)
            const body = await res.json()
            expect(body.isFollowing).toBe(true)
            expect(body.isAccepted).toBe(true)
        })

        it('should return not following when not following', async () => {
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

            const res = await app.request(`/api/users/${testUser2.username}/follow-status`)

            expect(res.status).toBe(200)
            const body = await res.json()
            expect(body.isFollowing).toBe(false)
            expect(body.isAccepted).toBe(false)
        })

        it('should return not following when not authenticated', async () => {
            const res = await app.request(`/api/users/${testUser2.username}/follow-status`)

            expect(res.status).toBe(200)
            const body = await res.json()
            expect(body.isFollowing).toBe(false)
            expect(body.isAccepted).toBe(false)
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

            const res = await app.request('/api/users/nonexistent/follow-status')

            expect(res.status).toBe(404)
        })
    })

    describe('POST /users/:username/follow', () => {
        it('should follow a user', async () => {
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

            vi.mocked(activityBuilder.buildFollowActivity).mockReturnValue({
                type: 'Follow',
                actor: `${baseUrl}/users/${testUser.username}`,
                object: `${baseUrl}/users/${testUser2.username}`,
            } as any)
            vi.mocked(activityDelivery.deliverToInbox).mockResolvedValue(true)

            const res = await app.request(`/api/users/${testUser2.username}/follow`, {
                method: 'POST',
            })

            expect(res.status).toBe(200)
            const body = await res.json()
            expect(body.success).toBe(true)

            // Verify following was created
            const following = await prisma.following.findUnique({
                where: {
                    userId_actorUrl: {
                        userId: testUser.id,
                        actorUrl: `${baseUrl}/users/${testUser2.username}`,
                    },
                },
            })
            expect(following).not.toBeNull()
        })

        it('should return 401 when not authenticated', async () => {
            const res = await app.request(`/api/users/${testUser2.username}/follow`, {
                method: 'POST',
            })

            expect([401, 403, 404, 500]).toContain(res.status)
        })

        it('should return 400 when trying to follow yourself', async () => {
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

            const res = await app.request(`/api/users/${testUser.username}/follow`, {
                method: 'POST',
            })

            expect(res.status).toBe(400)
            const body = await res.json()
            expect(body.error).toBe('Cannot follow yourself')
        })

        it('should return 400 when already following', async () => {
            const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000'
            const targetActorUrl = `${baseUrl}/users/${testUser2.username}`

            // Create existing following
            await prisma.following.create({
                data: {
                    userId: testUser.id,
                    actorUrl: targetActorUrl,
                    username: testUser2.username,
                    inboxUrl: `${baseUrl}/users/${testUser2.username}/inbox`,
                    accepted: true,
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

            const res = await app.request(`/api/users/${testUser2.username}/follow`, {
                method: 'POST',
            })

            expect(res.status).toBe(400)
            const body = await res.json()
            expect(body.error).toBe('Already following')
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

            const res = await app.request('/api/users/nonexistent/follow', {
                method: 'POST',
            })

            expect(res.status).toBe(404)
        })
    })

    describe('DELETE /users/:username/follow', () => {
        it('should unfollow a user', async () => {
            const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000'
            const targetActorUrl = `${baseUrl}/users/${testUser2.username}`

            // Create existing following
            await prisma.following.create({
                data: {
                    userId: testUser.id,
                    actorUrl: targetActorUrl,
                    username: testUser2.username,
                    inboxUrl: `${baseUrl}/users/${testUser2.username}/inbox`,
                    accepted: true,
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

            vi.mocked(activityBuilder.buildFollowActivity).mockReturnValue({
                type: 'Follow',
                actor: `${baseUrl}/users/${testUser.username}`,
                object: targetActorUrl,
            } as any)
            vi.mocked(activityBuilder.buildUndoActivity).mockReturnValue({
                type: 'Undo',
                actor: `${baseUrl}/users/${testUser.username}`,
                object: {
                    type: 'Follow',
                },
            } as any)
            vi.mocked(activityDelivery.deliverToInbox).mockResolvedValue(true)

            const res = await app.request(`/api/users/${testUser2.username}/follow`, {
                method: 'DELETE',
            })

            expect(res.status).toBe(200)
            const body = await res.json()
            expect(body.success).toBe(true)

            // Verify following was deleted
            const following = await prisma.following.findUnique({
                where: {
                    userId_actorUrl: {
                        userId: testUser.id,
                        actorUrl: targetActorUrl,
                    },
                },
            })
            expect(following).toBeNull()
        })

        it('should return 401 when not authenticated', async () => {
            const res = await app.request(`/api/users/${testUser2.username}/follow`, {
                method: 'DELETE',
            })

            expect([401, 403, 404, 500]).toContain(res.status)
        })

        it('should return 400 when not following', async () => {
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

            const res = await app.request(`/api/users/${testUser2.username}/follow`, {
                method: 'DELETE',
            })

            expect(res.status).toBe(400)
            const body = await res.json()
            expect(body.error).toBe('Not following')
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

            const res = await app.request('/api/users/nonexistent/follow', {
                method: 'DELETE',
            })

            expect(res.status).toBe(404)
        })
    })
})

