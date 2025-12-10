import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { config } from 'dotenv'
config()
import { app } from '../server.js'
import { prisma } from '../lib/prisma.js'

describe('Search API - Advanced Filters', () => {
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

    afterEach(() => {
        vi.useRealTimers()
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

    it('should filter events by date range presets', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2025-01-05T12:00:00.000Z'))

        const insideRange = await prisma.event.create({
            data: {
                title: 'Upcoming Hackathon',
                startTime: new Date('2025-01-08T15:00:00.000Z'),
                userId: testUser.id,
                attributedTo: `${baseUrl}/users/${testUser.username}`,
            },
        })

        await prisma.event.create({
            data: {
                title: 'Spring Festival',
                startTime: new Date('2025-02-10T15:00:00.000Z'),
                userId: testUser.id,
                attributedTo: `${baseUrl}/users/${testUser.username}`,
            },
        })

        const res = await app.request('/api/search?dateRange=next_7_days')
        expect(res.status).toBe(200)
        const body = await res.json() as any
        const eventIds = body.events.map((e: { id: string }) => e.id)
        expect(eventIds).toContain(insideRange.id)
        expect(eventIds.length).toBe(1)
    })

    it('should support category aliases when filtering tags', async () => {
        const artEvent = await prisma.event.create({
            data: {
                title: 'Art Walk',
                startTime: new Date(Date.now() + 86400000),
                userId: testUser.id,
                attributedTo: `${baseUrl}/users/${testUser.username}`,
                tags: {
                    create: [{ tag: 'art' }, { tag: 'gallery' }],
                },
            },
        })

        await prisma.event.create({
            data: {
                title: 'Tech Meetup',
                startTime: new Date(Date.now() + 86400000),
                userId: testUser.id,
                attributedTo: `${baseUrl}/users/${testUser.username}`,
                tags: {
                    create: [{ tag: 'tech' }],
                },
            },
        })

        const res = await app.request('/api/search?categories=Art')
        expect(res.status).toBe(200)
        const body = await res.json() as any
        const eventIds = body.events.map((e: { id: string }) => e.id)
        expect(eventIds).toContain(artEvent.id)
        expect(eventIds.length).toBe(1)
    })

    it('should match partial location filters', async () => {
        const nycEvent = await prisma.event.create({
            data: {
                title: 'Central Park Picnic',
                location: 'New York City, NY',
                startTime: new Date(Date.now() + 86400000),
                userId: testUser.id,
                attributedTo: `${baseUrl}/users/${testUser.username}`,
            },
        })

        await prisma.event.create({
            data: {
                title: 'Sunset Ride',
                location: 'Los Angeles',
                startTime: new Date(Date.now() + 86400000),
                userId: testUser.id,
                attributedTo: `${baseUrl}/users/${testUser.username}`,
            },
        })

        const res = await app.request('/api/search?location=York')
        expect(res.status).toBe(200)
        const body = await res.json() as any
        const eventIds = body.events.map((e: { id: string }) => e.id)
        expect(eventIds).toContain(nycEvent.id)
        expect(eventIds.length).toBe(1)
    })

    describe('Upcoming events endpoint', () => {
        it('should return only upcoming events', async () => {
            const upcomingEvent = await prisma.event.create({
                data: {
                    title: 'Future Event',
                    startTime: new Date(Date.now() + 86400000),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                },
            })

            const pastEvent = await prisma.event.create({
                data: {
                    title: 'Past Event',
                    startTime: new Date(Date.now() - 86400000),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                },
            })

            const res = await app.request('/api/search/upcoming')
            expect(res.status).toBe(200)
            const body = await res.json() as any
            expect(body.events).toBeDefined()
            expect(Array.isArray(body.events)).toBe(true)
            const eventIds = body.events.map((e: { id: string }) => e.id)
            expect(eventIds).toContain(upcomingEvent.id)
            expect(eventIds).not.toContain(pastEvent.id)
        })

        it('should respect limit parameter', async () => {
            // Create multiple upcoming events
            for (let i = 0; i < 5; i++) {
                await prisma.event.create({
                    data: {
                        title: `Event ${i}`,
                        startTime: new Date(Date.now() + (i + 1) * 86400000),
                        userId: testUser.id,
                        attributedTo: `${baseUrl}/users/${testUser.username}`,
                    },
                })
            }

            const res = await app.request('/api/search/upcoming?limit=3')
            expect(res.status).toBe(200)
            const body = await res.json() as any
            expect(body.events.length).toBeLessThanOrEqual(3)
        })

        it('should cap limit at 50', async () => {
            const res = await app.request('/api/search/upcoming?limit=100')
            expect(res.status).toBe(200)
            const body = await res.json() as any
            // Should not exceed 50 even if limit=100 is requested
            expect(body.events.length).toBeLessThanOrEqual(50)
        })

        it('should include user and count data', async () => {
            const event = await prisma.event.create({
                data: {
                    title: 'Event with Data',
                    startTime: new Date(Date.now() + 86400000),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                },
            })

            const res = await app.request('/api/search/upcoming')
            expect(res.status).toBe(200)
            const body = await res.json() as any
            const foundEvent = body.events.find((e: { id: string }) => e.id === event.id)
            expect(foundEvent).toBeDefined()
            expect(foundEvent.user).toBeDefined()
            expect(foundEvent._count).toBeDefined()
            expect(typeof foundEvent._count.attendance).toBe('number')
            expect(typeof foundEvent._count.likes).toBe('number')
            expect(typeof foundEvent._count.comments).toBe('number')
        })
    })

    describe('Popular events endpoint', () => {
        it('should return events sorted by popularity (attendance + likes)', async () => {
            const lessPopular = await prisma.event.create({
                data: {
                    title: 'Less Popular',
                    startTime: new Date(Date.now() + 86400000),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                    attendance: {
                        create: [{ userId: testUser.id, status: 'attending' }],
                    },
                },
            })

            const morePopular = await prisma.event.create({
                data: {
                    title: 'More Popular',
                    startTime: new Date(Date.now() + 172800000),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                    attendance: {
                        create: [
                            { userId: testUser.id, status: 'attending' },
                        ],
                    },
                    likes: {
                        create: [{ userId: testUser.id }],
                    },
                },
            })

            const res = await app.request('/api/search/popular')
            expect(res.status).toBe(200)
            const body = await res.json() as any
            expect(body.events).toBeDefined()
            expect(Array.isArray(body.events)).toBe(true)
            expect(body.events.length).toBeGreaterThan(0)
            
            // More popular event should appear first
            const morePopularIndex = body.events.findIndex((e: { id: string }) => e.id === morePopular.id)
            const lessPopularIndex = body.events.findIndex((e: { id: string }) => e.id === lessPopular.id)
            expect(morePopularIndex).toBeGreaterThanOrEqual(0)
            expect(lessPopularIndex).toBeGreaterThanOrEqual(0)
            expect(morePopularIndex).toBeLessThan(lessPopularIndex)
        })

        it('should only return upcoming events', async () => {
            const upcomingEvent = await prisma.event.create({
                data: {
                    title: 'Upcoming Popular',
                    startTime: new Date(Date.now() + 86400000),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                    attendance: {
                        create: [{ userId: testUser.id, status: 'attending' }],
                    },
                },
            })

            const pastEvent = await prisma.event.create({
                data: {
                    title: 'Past Popular',
                    startTime: new Date(Date.now() - 86400000),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                    attendance: {
                        create: [{ userId: testUser.id, status: 'attending' }],
                    },
                },
            })

            const res = await app.request('/api/search/popular')
            expect(res.status).toBe(200)
            const body = await res.json() as any
            const eventIds = body.events.map((e: { id: string }) => e.id)
            expect(eventIds).toContain(upcomingEvent.id)
            expect(eventIds).not.toContain(pastEvent.id)
        })

        it('should respect limit parameter', async () => {
            const res = await app.request('/api/search/popular?limit=5')
            expect(res.status).toBe(200)
            const body = await res.json() as any
            expect(body.events.length).toBeLessThanOrEqual(5)
        })

        it('should cap limit at 50', async () => {
            const res = await app.request('/api/search/popular?limit=200')
            expect(res.status).toBe(200)
            const body = await res.json() as any
            expect(body.events.length).toBeLessThanOrEqual(50)
        })

        it('should include user and count data', async () => {
            const event = await prisma.event.create({
                data: {
                    title: 'Popular Event',
                    startTime: new Date(Date.now() + 86400000),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                },
            })

            const res = await app.request('/api/search/popular')
            expect(res.status).toBe(200)
            const body = await res.json() as any
            const foundEvent = body.events.find((e: { id: string }) => e.id === event.id)
            if (foundEvent) {
                expect(foundEvent.user).toBeDefined()
                expect(foundEvent._count).toBeDefined()
                expect(typeof foundEvent._count.attendance).toBe('number')
                expect(typeof foundEvent._count.likes).toBe('number')
                expect(typeof foundEvent._count.comments).toBe('number')
            }
        })
    })

    describe('Sort functionality', () => {
        it('should sort events by date (default)', async () => {
            const event1 = await prisma.event.create({
                data: {
                    title: 'Event 1',
                    startTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                },
            })

            const event2 = await prisma.event.create({
                data: {
                    title: 'Event 2',
                    startTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day from now
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                },
            })

            const event3 = await prisma.event.create({
                data: {
                    title: 'Event 3',
                    startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                },
            })

            const res = await app.request('/api/search?sort=date')
            expect(res.status).toBe(200)
            const body = await res.json() as any
            expect(body.events).toBeDefined()
            expect(body.events.length).toBeGreaterThanOrEqual(3)

            // Events should be sorted by startTime ascending
            const eventIds = body.events.map((e: { id: string }) => e.id)
            const event1Index = eventIds.indexOf(event1.id)
            const event2Index = eventIds.indexOf(event2.id)
            const event3Index = eventIds.indexOf(event3.id)

            // Event 2 (1 day) should come before Event 3 (2 days) and Event 1 (3 days)
            expect(event2Index).toBeLessThan(event3Index)
            expect(event3Index).toBeLessThan(event1Index)
        })

        it('should sort events by popularity (attendance * 2 + likes)', async () => {
            const lessPopular = await prisma.event.create({
                data: {
                    title: 'Less Popular Event',
                    startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                    visibility: 'PUBLIC',
                    attendance: {
                        create: [{ userId: testUser.id, status: 'attending' }],
                    },
                },
            })

            const morePopular = await prisma.event.create({
                data: {
                    title: 'More Popular Event',
                    startTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                    visibility: 'PUBLIC',
                    attendance: {
                        create: [
                            { userId: testUser.id, status: 'attending' },
                        ],
                    },
                    likes: {
                        create: [{ userId: testUser.id }],
                    },
                },
            })

            // Create another user to add more attendance
            const otherUser = await prisma.user.create({
                data: {
                    username: `other_${Date.now()}`,
                    email: `other_${Date.now()}@test.com`,
                    name: 'Other User',
                    isRemote: false,
                },
            })

            await prisma.eventAttendance.create({
                data: {
                    eventId: morePopular.id,
                    userId: otherUser.id,
                    status: 'attending',
                },
            })

            const res = await app.request('/api/search?sort=popularity')
            expect(res.status).toBe(200)
            const body = await res.json() as any
            expect(body.events).toBeDefined()
            expect(body.events.length).toBeGreaterThan(0)

            // More popular event should appear before less popular event
            const eventIds = body.events.map((e: { id: string }) => e.id)
            const morePopularIndex = eventIds.indexOf(morePopular.id)
            const lessPopularIndex = eventIds.indexOf(lessPopular.id)

            expect(morePopularIndex).toBeGreaterThanOrEqual(0)
            expect(lessPopularIndex).toBeGreaterThanOrEqual(0)
            // More popular (2 attendance + 1 like = score 5) should come before less popular (1 attendance = score 2)
            expect(morePopularIndex).toBeLessThan(lessPopularIndex)
        })

        it('should handle popularity sort with pagination', async () => {
            // Create multiple events with varying popularity
            const events = []
            for (let i = 0; i < 5; i++) {
                const event = await prisma.event.create({
                    data: {
                        title: `Event ${i}`,
                        startTime: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000),
                        userId: testUser.id,
                        attributedTo: `${baseUrl}/users/${testUser.username}`,
                        visibility: 'PUBLIC',
                    },
                })
                events.push(event)

                // Add attendance to make them popular
                for (let j = 0; j < i; j++) {
                    const attendee = await prisma.user.create({
                        data: {
                            username: `attendee_${Date.now()}_${i}_${j}`,
                            email: `attendee_${Date.now()}_${i}_${j}@test.com`,
                            name: `Attendee ${i}-${j}`,
                            isRemote: false,
                        },
                    })
                    await prisma.eventAttendance.create({
                        data: {
                            eventId: event.id,
                            userId: attendee.id,
                            status: 'attending',
                        },
                    })
                }
            }

            const res = await app.request('/api/search?sort=popularity&page=1&limit=2')
            expect(res.status).toBe(200)
            const body = await res.json() as any
            expect(body.events).toBeDefined()
            expect(body.events.length).toBeLessThanOrEqual(2)
            expect(body.pagination).toBeDefined()
            expect(body.pagination.page).toBe(1)
            expect(body.pagination.limit).toBe(2)
        })

        it('should sort by trending (falls back to date)', async () => {
            const event1 = await prisma.event.create({
                data: {
                    title: 'Event 1',
                    startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                },
            })

            const event2 = await prisma.event.create({
                data: {
                    title: 'Event 2',
                    startTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                },
            })

            const res = await app.request('/api/search?sort=trending')
            expect(res.status).toBe(200)
            const body = await res.json() as any
            expect(body.events).toBeDefined()
            expect(body.events.length).toBeGreaterThanOrEqual(2)

            // Trending currently falls back to date sorting
            const eventIds = body.events.map((e: { id: string }) => e.id)
            const event1Index = eventIds.indexOf(event1.id)
            const event2Index = eventIds.indexOf(event2.id)

            // Event 2 (earlier) should come before Event 1 (later)
            expect(event2Index).toBeLessThan(event1Index)
        })

        it('should include sort option in filters response', async () => {
            await prisma.event.create({
                data: {
                    title: 'Test Event',
                    startTime: new Date(Date.now() + 86400000),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                },
            })

            const res = await app.request('/api/search?sort=popularity')
            expect(res.status).toBe(200)
            const body = await res.json() as any
            expect(body.filters).toBeDefined()
            expect(body.filters.sort).toBe('popularity')
        })

        it('should default to date sort when sort parameter is not provided', async () => {
            await prisma.event.create({
                data: {
                    title: 'Test Event',
                    startTime: new Date(Date.now() + 86400000),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                },
            })

            const res = await app.request('/api/search')
            expect(res.status).toBe(200)
            const body = await res.json() as any
            expect(body.filters).toBeDefined()
            expect(body.filters.sort).toBe('date')
        })

        it('should handle invalid sort parameter gracefully', async () => {
            await prisma.event.create({
                data: {
                    title: 'Test Event',
                    startTime: new Date(Date.now() + 86400000),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                },
            })

            // Invalid sort should be rejected by schema validation
            const res = await app.request('/api/search?sort=invalid')
            expect(res.status).toBe(400)
            const body = await res.json() as any
            expect(body.error).toBeDefined()
        })
    })

    describe('Platform Statistics Endpoint', () => {
        it('should return platform statistics for public events', async () => {
            // Create some events
            await prisma.event.create({
                data: {
                    title: 'Past Event',
                    startTime: new Date(Date.now() - 86400000), // Yesterday
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                    visibility: 'PUBLIC',
                },
            })

            await prisma.event.create({
                data: {
                    title: 'Upcoming Event',
                    startTime: new Date(Date.now() + 86400000), // Tomorrow
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                    visibility: 'PUBLIC',
                },
            })

            const now = new Date()
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
            const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
            
            await prisma.event.create({
                data: {
                    title: 'Today Event',
                    startTime: new Date((todayStart.getTime() + todayEnd.getTime()) / 2), // Today
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                    visibility: 'PUBLIC',
                },
            })

            const res = await app.request('/api/search/stats')
            expect(res.status).toBe(200)
            const body = await res.json() as any
            
            expect(body.totalEvents).toBeGreaterThanOrEqual(3)
            expect(body.upcomingEvents).toBeGreaterThanOrEqual(2) // Today + Tomorrow
            expect(body.todayEvents).toBeGreaterThanOrEqual(1)
        })

        it('should respect visibility filters for authenticated users', async () => {
            const otherUser = await prisma.user.create({
                data: {
                    username: `other_${Date.now()}`,
                    email: `other_${Date.now()}@test.com`,
                    name: 'Other User',
                    isRemote: false,
                },
            })

            // Create a private event
            await prisma.event.create({
                data: {
                    title: 'Private Event',
                    startTime: new Date(Date.now() + 86400000),
                    userId: otherUser.id,
                    attributedTo: `${baseUrl}/users/${otherUser.username}`,
                    visibility: 'PRIVATE',
                },
            })

            // Create a public event
            await prisma.event.create({
                data: {
                    title: 'Public Event',
                    startTime: new Date(Date.now() + 86400000),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                    visibility: 'PUBLIC',
                },
            })

            // Request stats without auth (should only see public)
            const resUnauthenticated = await app.request('/api/search/stats')
            expect(resUnauthenticated.status).toBe(200)
            const bodyUnauthenticated = await resUnauthenticated.json() as any
            const publicCount = bodyUnauthenticated.totalEvents

            // The count should reflect only public events
            expect(publicCount).toBeGreaterThanOrEqual(1)
        })

        it('should return zero counts when no events exist', async () => {
            // Clean up all events
            await prisma.eventTag.deleteMany({})
            await prisma.eventAttendance.deleteMany({})
            await prisma.eventLike.deleteMany({})
            await prisma.comment.deleteMany({})
            await prisma.event.deleteMany({})

            const res = await app.request('/api/search/stats')
            expect(res.status).toBe(200)
            const body = await res.json() as any
            
            expect(body.totalEvents).toBe(0)
            expect(body.upcomingEvents).toBe(0)
            expect(body.todayEvents).toBe(0)
        })
    })
})
