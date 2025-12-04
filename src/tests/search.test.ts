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

    it('should include events with no tags in search results when not filtering by tags', async () => {
        const eventWithTags = await prisma.event.create({
            data: {
                title: 'Tagged Event',
                startTime: new Date(Date.now() + 86400000),
                userId: testUser.id,
                attributedTo: `${baseUrl}/users/${testUser.username}`,
                tags: {
                    create: [{ tag: 'music' }],
                },
            },
        })

        const eventWithoutTags = await prisma.event.create({
            data: {
                title: 'Untagged Event',
                startTime: new Date(Date.now() + 172800000),
                userId: testUser.id,
                attributedTo: `${baseUrl}/users/${testUser.username}`,
            },
        })

        const res = await app.request('/api/search')
        expect(res.status).toBe(200)
        const body = await res.json() as any
        const eventIds = body.events.map((e: { id: string }) => e.id)
        expect(eventIds).toContain(eventWithTags.id)
        expect(eventIds).toContain(eventWithoutTags.id)

        // Verify untagged event has empty tags array
        const foundUntaggedEvent = body.events.find((e: { id: string }) => e.id === eventWithoutTags.id)
        expect(foundUntaggedEvent.tags).toBeDefined()
        expect(Array.isArray(foundUntaggedEvent.tags)).toBe(true)
        expect(foundUntaggedEvent.tags.length).toBe(0)
    })

    it('should exclude events with no tags when filtering by tags', async () => {
        const eventWithTags = await prisma.event.create({
            data: {
                title: 'Tagged Event',
                startTime: new Date(Date.now() + 86400000),
                userId: testUser.id,
                attributedTo: `${baseUrl}/users/${testUser.username}`,
                tags: {
                    create: [{ tag: 'music' }],
                },
            },
        })

        const eventWithoutTags = await prisma.event.create({
            data: {
                title: 'Untagged Event',
                startTime: new Date(Date.now() + 172800000),
                userId: testUser.id,
                attributedTo: `${baseUrl}/users/${testUser.username}`,
            },
        })

        const res = await app.request('/api/search?tags=music')
        expect(res.status).toBe(200)
        const body = await res.json() as any
        const eventIds = body.events.map((e: { id: string }) => e.id)
        expect(eventIds).toContain(eventWithTags.id)
        expect(eventIds).not.toContain(eventWithoutTags.id)
    })

    it('should handle tag filter with special characters', async () => {
        const event = await prisma.event.create({
            data: {
                title: 'Special Tag Event',
                startTime: new Date(Date.now() + 86400000),
                userId: testUser.id,
                attributedTo: `${baseUrl}/users/${testUser.username}`,
                tags: {
                    create: [{ tag: 'music-2024' }, { tag: 'concert_live' }],
                },
            },
        })

        const res = await app.request('/api/search?tags=music-2024')
        expect(res.status).toBe(200)
        const body = await res.json() as any
        const eventIds = body.events.map((e: { id: string }) => e.id)
        expect(eventIds).toContain(event.id)
    })

    it('should handle tag filter with unicode characters', async () => {
        const event = await prisma.event.create({
            data: {
                title: 'Unicode Tag Event',
                startTime: new Date(Date.now() + 86400000),
                userId: testUser.id,
                attributedTo: `${baseUrl}/users/${testUser.username}`,
                tags: {
                    create: [{ tag: 'música' }],
                },
            },
        })

        const res = await app.request('/api/search?tags=música')
        expect(res.status).toBe(200)
        const body = await res.json() as any
        const eventIds = body.events.map((e: { id: string }) => e.id)
        expect(eventIds).toContain(event.id)
    })

    it('should handle empty tag filter gracefully', async () => {
        await prisma.event.create({
            data: {
                title: 'Tagged Event',
                startTime: new Date(Date.now() + 86400000),
                userId: testUser.id,
                attributedTo: `${baseUrl}/users/${testUser.username}`,
                tags: {
                    create: [{ tag: 'music' }],
                },
            },
        })

        const res = await app.request('/api/search?tags=')
        expect(res.status).toBe(200)
        const body = await res.json() as any
        expect(body.events).toBeDefined()
        expect(Array.isArray(body.events)).toBe(true)
    })

    it('should handle multiple tag filters with duplicates', async () => {
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

        // Duplicate tags in filter should be normalized
        const res = await app.request('/api/search?tags=music,music,MUSIC')
        expect(res.status).toBe(200)
        const body = await res.json() as any
        const eventIds = body.events.map((e: { id: string }) => e.id)
        expect(eventIds).toContain(event.id)
    })
<<<<<<< HEAD

    it('should handle search with tags that become empty after normalization', async () => {
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

        // Tags that become empty after normalization should be ignored
        const res = await app.request('/api/search?tags=#,##,   ,\t')
        expect(res.status).toBe(200)
        const body = await res.json() as any
        expect(body.events).toBeDefined()
        expect(Array.isArray(body.events)).toBe(true)
        // Should return all events since no valid tags to filter by
        const eventIds = body.events.map((e: { id: string }) => e.id)
        expect(eventIds).toContain(event.id)
    })

    it('should handle search with mixed valid and invalid tags', async () => {
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

        // Mix of valid tags and tags that become empty
        const res = await app.request('/api/search?tags=music,#,##,   ')
        expect(res.status).toBe(200)
        const body = await res.json() as any
        const eventIds = body.events.map((e: { id: string }) => e.id)
        expect(eventIds).toContain(event.id)
    })

    it('should handle search when params.tags is not provided', async () => {
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

        // No tags parameter - should return all events
        const res = await app.request('/api/search')
        expect(res.status).toBe(200)
        const body = await res.json() as any
        const eventIds = body.events.map((e: { id: string }) => e.id)
        expect(eventIds).toContain(event.id)
    })

    it('should handle search when tagList becomes empty after normalization', async () => {
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

        // Tags that all become empty - tagList.length === 0
        const res = await app.request('/api/search?tags=#,##,###')
        expect(res.status).toBe(200)
        const body = await res.json() as any
        // Should return all events since no valid tags to filter by
        const eventIds = body.events.map((e: { id: string }) => e.id)
        expect(eventIds).toContain(event.id)
    })
=======
>>>>>>> 48463a3 (Checkpoint before follow-up message)
})
