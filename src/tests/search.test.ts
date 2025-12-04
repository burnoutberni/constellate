import { describe, it, expect, beforeEach } from 'vitest'
import { config } from 'dotenv'
config()
import { app } from '../server.js'
import { prisma } from '../lib/prisma.js'

describe('Search API - Tag Filtering', () => {
    let testUser: any
    const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000'

    beforeEach(async () => {
        await prisma.eventTag.deleteMany({})
        await prisma.eventAttendance.deleteMany({})
        await prisma.eventLike.deleteMany({})
        await prisma.comment.deleteMany({})
        await prisma.event.deleteMany({})
        await prisma.user.deleteMany({})

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
    })

    it('should filter events by single tag', async () => {
        const event1 = await prisma.event.create({
            data: {
                title: 'Music Event',
                startTime: new Date(Date.now() + 86400000),
                userId: testUser.id,
                attributedTo: `${baseUrl}/users/${testUser.username}`,
                tags: {
                    create: [{ tag: 'music' }],
                },
            },
        })

        const event2 = await prisma.event.create({
            data: {
                title: 'Sports Event',
                startTime: new Date(Date.now() + 172800000),
                userId: testUser.id,
                attributedTo: `${baseUrl}/users/${testUser.username}`,
                tags: {
                    create: [{ tag: 'sports' }],
                },
            },
        })

        const res = await app.request('/api/search?tags=music')
        expect(res.status).toBe(200)
        const body = await res.json() as any
        expect(body.events).toBeDefined()
        expect(Array.isArray(body.events)).toBe(true)
        const eventIds = body.events.map((e: { id: string }) => e.id)
        expect(eventIds).toContain(event1.id)
        expect(eventIds).not.toContain(event2.id)
    })

    it('should filter events by multiple tags (comma-separated)', async () => {
        const event1 = await prisma.event.create({
            data: {
                title: 'Music Concert',
                startTime: new Date(Date.now() + 86400000),
                userId: testUser.id,
                attributedTo: `${baseUrl}/users/${testUser.username}`,
                tags: {
                    create: [{ tag: 'music' }, { tag: 'concert' }],
                },
            },
        })

        const event2 = await prisma.event.create({
            data: {
                title: 'Sports Game',
                startTime: new Date(Date.now() + 172800000),
                userId: testUser.id,
                attributedTo: `${baseUrl}/users/${testUser.username}`,
                tags: {
                    create: [{ tag: 'sports' }],
                },
            },
        })

        const res = await app.request('/api/search?tags=music,concert')
        expect(res.status).toBe(200)
        const body = await res.json() as any
        const eventIds = body.events.map((e: { id: string }) => e.id)
        expect(eventIds).toContain(event1.id)
        expect(eventIds).not.toContain(event2.id)
    })

    it('should normalize tag filter to lowercase', async () => {
        const event = await prisma.event.create({
            data: {
                title: 'Music Event',
                startTime: new Date(Date.now() + 86400000),
                userId: testUser.id,
                attributedTo: `${baseUrl}/users/${testUser.username}`,
                tags: {
                    create: [{ tag: 'music' }],
                },
            },
        })

        const res = await app.request('/api/search?tags=MUSIC')
        expect(res.status).toBe(200)
        const body = await res.json() as any
        const eventIds = body.events.map((e: { id: string }) => e.id)
        expect(eventIds).toContain(event.id)
    })

    it('should include tags in search results', async () => {
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

        const res = await app.request('/api/search?tags=music')
        expect(res.status).toBe(200)
        const body = await res.json() as any
        const foundEvent = body.events.find((e: { id: string }) => e.id === event.id)
        expect(foundEvent).toBeDefined()
        expect(foundEvent.tags).toBeDefined()
        expect(Array.isArray(foundEvent.tags)).toBe(true)
        expect(foundEvent.tags.length).toBe(2)
    })

    it('should combine tag filter with other filters', async () => {
        const event1 = await prisma.event.create({
            data: {
                title: 'Music Event',
                location: 'New York',
                startTime: new Date(Date.now() + 86400000),
                userId: testUser.id,
                attributedTo: `${baseUrl}/users/${testUser.username}`,
                tags: {
                    create: [{ tag: 'music' }],
                },
            },
        })

        const event2 = await prisma.event.create({
            data: {
                title: 'Music Event',
                location: 'Los Angeles',
                startTime: new Date(Date.now() + 172800000),
                userId: testUser.id,
                attributedTo: `${baseUrl}/users/${testUser.username}`,
                tags: {
                    create: [{ tag: 'music' }],
                },
            },
        })

        const res = await app.request('/api/search?tags=music&location=New York')
        expect(res.status).toBe(200)
        const body = await res.json() as any
        const eventIds = body.events.map((e: { id: string }) => e.id)
        expect(eventIds).toContain(event1.id)
        expect(eventIds).not.toContain(event2.id)
    })

    it('should return empty results when no events match tag filter', async () => {
        await prisma.event.create({
            data: {
                title: 'Music Event',
                startTime: new Date(Date.now() + 86400000),
                userId: testUser.id,
                attributedTo: `${baseUrl}/users/${testUser.username}`,
                tags: {
                    create: [{ tag: 'music' }],
                },
            },
        })

        const res = await app.request('/api/search?tags=nonexistent')
        expect(res.status).toBe(200)
        const body = await res.json() as any
        expect(body.events).toBeDefined()
        expect(Array.isArray(body.events)).toBe(true)
        expect(body.events.length).toBe(0)
    })

    it('should handle tag filter with whitespace', async () => {
        const event = await prisma.event.create({
            data: {
                title: 'Music Event',
                startTime: new Date(Date.now() + 86400000),
                userId: testUser.id,
                attributedTo: `${baseUrl}/users/${testUser.username}`,
                tags: {
                    create: [{ tag: 'music' }],
                },
            },
        })

        const res = await app.request('/api/search?tags= music , concert ')
        expect(res.status).toBe(200)
        const body = await res.json() as any
        const eventIds = body.events.map((e: { id: string }) => e.id)
        expect(eventIds).toContain(event.id)
    })

    it('should include tags in filters response', async () => {
        await prisma.event.create({
            data: {
                title: 'Music Event',
                startTime: new Date(Date.now() + 86400000),
                userId: testUser.id,
                attributedTo: `${baseUrl}/users/${testUser.username}`,
                tags: {
                    create: [{ tag: 'music' }],
                },
            },
        })

        const res = await app.request('/api/search?tags=music')
        expect(res.status).toBe(200)
        const body = await res.json() as any
        expect(body.filters).toBeDefined()
        expect(body.filters.tags).toBe('music')
    })
})
