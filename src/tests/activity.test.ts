/**
 * Tests for Activity Feed
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { config } from 'dotenv'
config()
import { app } from '../server.js'
import { prisma } from '../lib/prisma.js'
import * as authModule from '../auth.js'

describe('Activity Feed API', () => {
    let testUser: any
    let testUser2: any
    let testUser3: any
    const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000'

    beforeEach(async () => {
        // Clean up
        await prisma.eventAttendance.deleteMany({})
        await prisma.eventLike.deleteMany({})
        await prisma.comment.deleteMany({})
        await prisma.event.deleteMany({})
        await prisma.following.deleteMany({})
        await prisma.follower.deleteMany({})
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

        testUser3 = await prisma.user.create({
            data: {
                username: `charlie_${suffix}`,
                email: `charlie_${suffix}@test.com`,
                name: 'Charlie Test',
                isRemote: false,
            },
        })

        // Reset mocks
        vi.clearAllMocks()
    })

    describe('GET /activity/feed', () => {
        it('should return empty feed when not authenticated', async () => {
            const res = await app.request('/api/activity/feed')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any as any as { activities: unknown[] }
            expect(body.activities).toEqual([])
        })

        it('should return empty feed when authenticated but not following anyone', async () => {
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

            const res = await app.request('/api/activity/feed')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any as any as { activities: unknown[] }
            expect(body.activities).toEqual([])
        })

        it('should return empty feed when following users but no activities', async () => {
            // Create following relationship
            await prisma.following.create({
                data: {
                    userId: testUser.id,
                    actorUrl: `${baseUrl}/users/${testUser2.username}`,
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

            const res = await app.request('/api/activity/feed')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any as any as { activities: unknown[] }
            expect(body.activities).toEqual([])
        })

        it('should include likes from followed users', async () => {
            // Create following relationship
            await prisma.following.create({
                data: {
                    userId: testUser.id,
                    actorUrl: `${baseUrl}/users/${testUser2.username}`,
                    username: testUser2.username,
                    inboxUrl: `${baseUrl}/users/${testUser2.username}/inbox`,
                    accepted: true,
                },
            })

            // Create event
            const event = await prisma.event.create({
                data: {
                    userId: testUser3.id,
                    title: 'Test Event',
                    startTime: new Date(),
                    attributedTo: `${baseUrl}/users/${testUser3.username}`,
                },
            })

            // Create like from followed user
            const like = await prisma.eventLike.create({
                data: {
                    eventId: event.id,
                    userId: testUser2.id,
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            name: true,
                            displayColor: true,
                            profileImage: true,
                        },
                    },
                    event: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true,
                                    name: true,
                                    displayColor: true,
                                },
                            },
                        },
                    },
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

            const res = await app.request('/api/activity/feed')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any as any
            expect(body.activities.length).toBeGreaterThan(0)
            
            const likeActivity = body.activities.find((a: any) => a.type === 'like')
            expect(likeActivity).toBeDefined()
            expect(likeActivity.id).toBe(`like-${like.id}`)
            expect(likeActivity.user.username).toBe(testUser2.username)
            expect(likeActivity.event.id).toBe(event.id)
        })

        it('should include RSVPs from followed users', async () => {
            // Create following relationship
            await prisma.following.create({
                data: {
                    userId: testUser.id,
                    actorUrl: `${baseUrl}/users/${testUser2.username}`,
                    username: testUser2.username,
                    inboxUrl: `${baseUrl}/users/${testUser2.username}/inbox`,
                    accepted: true,
                },
            })

            // Create event
            const event = await prisma.event.create({
                data: {
                    userId: testUser3.id,
                    title: 'Test Event',
                    startTime: new Date(),
                    attributedTo: `${baseUrl}/users/${testUser3.username}`,
                },
            })

            // Create RSVP from followed user
            const rsvp = await prisma.eventAttendance.create({
                data: {
                    eventId: event.id,
                    userId: testUser2.id,
                    status: 'attending',
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

            const res = await app.request('/api/activity/feed')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any as any
            expect(body.activities.length).toBeGreaterThan(0)
            
            const rsvpActivity = body.activities.find((a: any) => a.type === 'rsvp')
            expect(rsvpActivity).toBeDefined()
            expect(rsvpActivity.id).toBe(`rsvp-${rsvp.id}`)
            expect(rsvpActivity.user.username).toBe(testUser2.username)
            expect(rsvpActivity.data.status).toBe('attending')
        })

        it('should include comments from followed users', async () => {
            // Create following relationship
            await prisma.following.create({
                data: {
                    userId: testUser.id,
                    actorUrl: `${baseUrl}/users/${testUser2.username}`,
                    username: testUser2.username,
                    inboxUrl: `${baseUrl}/users/${testUser2.username}/inbox`,
                    accepted: true,
                },
            })

            // Create event
            const event = await prisma.event.create({
                data: {
                    userId: testUser3.id,
                    title: 'Test Event',
                    startTime: new Date(),
                    attributedTo: `${baseUrl}/users/${testUser3.username}`,
                },
            })

            // Create comment from followed user
            const comment = await prisma.comment.create({
                data: {
                    eventId: event.id,
                    authorId: testUser2.id,
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

            const res = await app.request('/api/activity/feed')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any as any
            expect(body.activities.length).toBeGreaterThan(0)
            
            const commentActivity = body.activities.find((a: any) => a.type === 'comment')
            expect(commentActivity).toBeDefined()
            expect(commentActivity.id).toBe(`comment-${comment.id}`)
            expect(commentActivity.user.username).toBe(testUser2.username)
            expect(commentActivity.data.commentContent).toBe('Test comment')
        })

        it('should include event creations from followed users', async () => {
            // Create following relationship
            await prisma.following.create({
                data: {
                    userId: testUser.id,
                    actorUrl: `${baseUrl}/users/${testUser2.username}`,
                    username: testUser2.username,
                    inboxUrl: `${baseUrl}/users/${testUser2.username}/inbox`,
                    accepted: true,
                },
            })

            // Create event from followed user
            const event = await prisma.event.create({
                data: {
                    userId: testUser2.id,
                    title: 'New Event',
                    startTime: new Date(),
                    attributedTo: `${baseUrl}/users/${testUser2.username}`,
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

            const res = await app.request('/api/activity/feed')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any as any
            expect(body.activities.length).toBeGreaterThan(0)
            
            const eventActivity = body.activities.find((a: any) => a.type === 'event_created')
            expect(eventActivity).toBeDefined()
            expect(eventActivity.id).toBe(`event-${event.id}`)
            expect(eventActivity.user.username).toBe(testUser2.username)
            expect(eventActivity.event.title).toBe('New Event')
        })

        it('should sort activities by creation date (most recent first)', async () => {
            // Create following relationship
            await prisma.following.create({
                data: {
                    userId: testUser.id,
                    actorUrl: `${baseUrl}/users/${testUser2.username}`,
                    username: testUser2.username,
                    inboxUrl: `${baseUrl}/users/${testUser2.username}/inbox`,
                    accepted: true,
                },
            })

            // Create event
            const event = await prisma.event.create({
                data: {
                    userId: testUser3.id,
                    title: 'Test Event',
                    startTime: new Date(),
                    attributedTo: `${baseUrl}/users/${testUser3.username}`,
                },
            })

            // Create activities with different timestamps
            const oldLike = await prisma.eventLike.create({
                data: {
                    eventId: event.id,
                    userId: testUser2.id,
                    createdAt: new Date(Date.now() - 10000), // 10 seconds ago
                },
            })

            const newComment = await prisma.comment.create({
                data: {
                    eventId: event.id,
                    authorId: testUser2.id,
                    content: 'New comment',
                    createdAt: new Date(), // Now
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

            const res = await app.request('/api/activity/feed')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any as any
            expect(body.activities.length).toBeGreaterThanOrEqual(2)
            
            // Most recent should be first
            const firstActivity = body.activities[0]
            expect(firstActivity.type).toBe('comment')
            expect(firstActivity.id).toBe(`comment-${newComment.id}`)
        })

        it('should limit activities to 50 most recent', async () => {
            // Create following relationship
            await prisma.following.create({
                data: {
                    userId: testUser.id,
                    actorUrl: `${baseUrl}/users/${testUser2.username}`,
                    username: testUser2.username,
                    inboxUrl: `${baseUrl}/users/${testUser2.username}/inbox`,
                    accepted: true,
                },
            })

            // Create event
            const event = await prisma.event.create({
                data: {
                    userId: testUser3.id,
                    title: 'Test Event',
                    startTime: new Date(),
                    attributedTo: `${baseUrl}/users/${testUser3.username}`,
                },
            })

            // Create more than 50 activities
            const activities = []
            for (let i = 0; i < 60; i++) {
                const like = await prisma.eventLike.create({
                    data: {
                        eventId: event.id,
                        userId: testUser2.id,
                        createdAt: new Date(Date.now() - i * 1000), // Stagger timestamps
                    },
                })
                activities.push(like)
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

            const res = await app.request('/api/activity/feed')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any as any
            expect(body.activities.length).toBeLessThanOrEqual(50)
        })

        it('should only include activities from accepted follows', async () => {
            // Create unaccepted following relationship
            await prisma.following.create({
                data: {
                    userId: testUser.id,
                    actorUrl: `${baseUrl}/users/${testUser2.username}`,
                    username: testUser2.username,
                    inboxUrl: `${baseUrl}/users/${testUser2.username}/inbox`,
                    accepted: false, // Not accepted
                },
            })

            // Create event
            const event = await prisma.event.create({
                data: {
                    userId: testUser3.id,
                    title: 'Test Event',
                    startTime: new Date(),
                    attributedTo: `${baseUrl}/users/${testUser3.username}`,
                },
            })

            // Create like from followed user (but follow not accepted)
            await prisma.eventLike.create({
                data: {
                    eventId: event.id,
                    userId: testUser2.id,
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

            const res = await app.request('/api/activity/feed')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any as any
            // Should not include activities from unaccepted follows
            expect(body.activities.length).toBe(0)
        })

        it('should handle remote users in following relationships', async () => {
            // Create remote user
            const remoteUser = await prisma.user.create({
                data: {
                    username: `remote_${Date.now()}`,
                    isRemote: true,
                    externalActorUrl: 'https://remote.example.com/users/remote',
                },
            })

            // Create following relationship with remote user
            await prisma.following.create({
                data: {
                    userId: testUser.id,
                    actorUrl: remoteUser.externalActorUrl!,
                    username: remoteUser.username,
                    inboxUrl: 'https://remote.example.com/users/remote/inbox',
                    accepted: true,
                },
            })

            // Create event
            const event = await prisma.event.create({
                data: {
                    userId: remoteUser.id,
                    title: 'Remote Event',
                    startTime: new Date(),
                    attributedTo: remoteUser.externalActorUrl!,
                },
            })

            // Create like from remote user
            await prisma.eventLike.create({
                data: {
                    eventId: event.id,
                    userId: remoteUser.id,
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

            const res = await app.request('/api/activity/feed')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any as any
            expect(body.activities.length).toBeGreaterThan(0)
        })

        it('should handle error gracefully', async () => {
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

            // Mock prisma to throw error
            const originalFindMany = prisma.following.findMany
            vi.spyOn(prisma.following, 'findMany').mockRejectedValueOnce(new Error('Database error'))

            const res = await app.request('/api/activity/feed')

            expect(res.status).toBe(500)
            const body = await res.json() as any as any as any
            expect(body.error).toBe('Internal server error')

            // Restore original
            prisma.following.findMany = originalFindMany
        })
    })

    describe('GET /activity/debug', () => {
        it('should return 401 when not authenticated', async () => {
            const res = await app.request('/api/activity/debug')

            expect(res.status).toBe(401)
            const body = await res.json() as any as any as any
            expect(body.error).toBe('Not authenticated')
        })

        it('should return following and followers data when authenticated', async () => {
            // Create following relationships
            await prisma.following.create({
                data: {
                    userId: testUser.id,
                    actorUrl: `${baseUrl}/users/${testUser2.username}`,
                    username: testUser2.username,
                    inboxUrl: `${baseUrl}/users/${testUser2.username}/inbox`,
                    accepted: true,
                },
            })

            await prisma.following.create({
                data: {
                    userId: testUser.id,
                    actorUrl: `${baseUrl}/users/${testUser3.username}`,
                    username: testUser3.username,
                    inboxUrl: `${baseUrl}/users/${testUser3.username}/inbox`,
                    accepted: false,
                },
            })

            // Create follower relationship
            await prisma.follower.create({
                data: {
                    userId: testUser.id,
                    actorUrl: `${baseUrl}/users/${testUser2.username}`,
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

            const res = await app.request('/api/activity/debug')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any as any
            expect(body.userId).toBe(testUser.id)
            expect(body.following).toHaveLength(2)
            expect(body.followers).toHaveLength(1)
            expect(body.acceptedFollowing).toHaveLength(1)
            expect(body.unacceptedFollowing).toHaveLength(1)
        })

        it('should handle error gracefully', async () => {
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

            // Mock prisma to throw error
            const originalFindMany = prisma.following.findMany
            vi.spyOn(prisma.following, 'findMany').mockRejectedValueOnce(new Error('Database error'))

            const res = await app.request('/api/activity/debug')

            expect(res.status).toBe(500)
            const body = await res.json() as any as any as any
            expect(body.error).toBe('Internal server error')

            // Restore original
            prisma.following.findMany = originalFindMany
        })

        it('should handle case when actorUrl does not start with baseUrl for remote users', async () => {
            const remoteUser = await prisma.user.create({
                data: {
                    username: `remote_${Date.now()}`,
                    isRemote: true,
                    externalActorUrl: 'https://remote.example.com/users/remote',
                },
            })

            await prisma.following.create({
                data: {
                    userId: testUser.id,
                    actorUrl: remoteUser.externalActorUrl!,
                    username: remoteUser.username,
                    inboxUrl: 'https://remote.example.com/users/remote/inbox',
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

            const res = await app.request('/api/activity/feed')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any as any
            // Should handle remote users correctly
            expect(body.activities).toBeDefined()
        })

        it('should handle case when username cannot be extracted from actorUrl', async () => {
            await prisma.following.create({
                data: {
                    userId: testUser.id,
                    actorUrl: `${baseUrl}/users/`, // Invalid URL without username
                    username: 'invalid',
                    inboxUrl: `${baseUrl}/users/invalid/inbox`,
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

            const res = await app.request('/api/activity/feed')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any as any
            // Should handle gracefully when username cannot be extracted
            expect(body.activities).toBeDefined()
        })

        it('should handle case when user is not found for actorUrl', async () => {
            await prisma.following.create({
                data: {
                    userId: testUser.id,
                    actorUrl: `${baseUrl}/users/nonexistent`,
                    username: 'nonexistent',
                    inboxUrl: `${baseUrl}/users/nonexistent/inbox`,
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

            const res = await app.request('/api/activity/feed')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any as any
            // Should return empty feed when user not found
            expect(body.activities).toEqual([])
        })

        it('should handle errors when fetching likes', async () => {
            await prisma.following.create({
                data: {
                    userId: testUser.id,
                    actorUrl: `${baseUrl}/users/${testUser2.username}`,
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

            const originalFindMany = prisma.eventLike.findMany
            vi.spyOn(prisma.eventLike, 'findMany').mockRejectedValueOnce(new Error('Database error'))

            const res = await app.request('/api/activity/feed')

            expect(res.status).toBe(500)
            const body = await res.json() as any as any as any
            expect(body.error).toBe('Internal server error')

            // Restore
            prisma.eventLike.findMany = originalFindMany
        })

        it('should handle errors when fetching RSVPs', async () => {
            await prisma.following.create({
                data: {
                    userId: testUser.id,
                    actorUrl: `${baseUrl}/users/${testUser2.username}`,
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

            const originalFindMany = prisma.eventAttendance.findMany
            vi.spyOn(prisma.eventAttendance, 'findMany').mockRejectedValueOnce(new Error('Database error'))

            const res = await app.request('/api/activity/feed')

            expect(res.status).toBe(500)
            const body = await res.json() as any as any as any
            expect(body.error).toBe('Internal server error')

            // Restore
            prisma.eventAttendance.findMany = originalFindMany
        })

        it('should handle errors when fetching comments', async () => {
            await prisma.following.create({
                data: {
                    userId: testUser.id,
                    actorUrl: `${baseUrl}/users/${testUser2.username}`,
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

            const originalFindMany = prisma.comment.findMany
            vi.spyOn(prisma.comment, 'findMany').mockRejectedValueOnce(new Error('Database error'))

            const res = await app.request('/api/activity/feed')

            expect(res.status).toBe(500)
            const body = await res.json() as any as any as any
            expect(body.error).toBe('Internal server error')

            // Restore
            prisma.comment.findMany = originalFindMany
        })

        it('should handle errors when fetching events', async () => {
            await prisma.following.create({
                data: {
                    userId: testUser.id,
                    actorUrl: `${baseUrl}/users/${testUser2.username}`,
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

            const originalFindMany = prisma.event.findMany
            vi.spyOn(prisma.event, 'findMany').mockRejectedValueOnce(new Error('Database error'))

            const res = await app.request('/api/activity/feed')

            expect(res.status).toBe(500)
            const body = await res.json() as any as any as any
            expect(body.error).toBe('Internal server error')

            // Restore
            prisma.event.findMany = originalFindMany
        })

        it('should handle case when user is not found for actorUrl', async () => {
            await prisma.following.create({
                data: {
                    userId: testUser.id,
                    actorUrl: `${baseUrl}/users/nonexistent`,
                    username: 'nonexistent',
                    inboxUrl: `${baseUrl}/users/nonexistent/inbox`,
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

            const res = await app.request('/api/activity/feed')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any as any
            // Should return empty feed when user not found
            expect(body.activities).toEqual([])
        })

        it('should handle case when username cannot be extracted from actorUrl', async () => {
            await prisma.following.create({
                data: {
                    userId: testUser.id,
                    actorUrl: `${baseUrl}/users/`, // Invalid URL without username
                    username: 'invalid',
                    inboxUrl: `${baseUrl}/users/invalid/inbox`,
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

            const res = await app.request('/api/activity/feed')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any as any
            // Should handle gracefully when username cannot be extracted
            expect(body.activities).toBeDefined()
        })
    })
})

