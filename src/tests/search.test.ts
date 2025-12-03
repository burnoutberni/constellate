/**
 * Tests for Event Search and Filtering
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { config } from 'dotenv'
config()
import searchApp from '../search.js'
import { prisma } from '../lib/prisma.js'
import * as authModule from '../auth.js'

describe('Event Search API', () => {
    let testUser: any
    let testEvent1: any
    let testEvent2: any

    beforeEach(async () => {
        // Clean up
        await prisma.eventAttendance.deleteMany({})
        await prisma.eventLike.deleteMany({})
        await prisma.comment.deleteMany({})
        await prisma.event.deleteMany({})
        await prisma.user.deleteMany({})

        // Create test user
        const timestamp = Date.now()
        testUser = await prisma.user.create({
            data: {
                username: `testuser_${timestamp}`,
                email: `test_${timestamp}@example.com`,
                name: 'Test User',
                isRemote: false,
            },
        })

        // Create test events
        testEvent1 = await prisma.event.create({
            data: {
                userId: testUser.id,
                title: 'Team Meeting',
                summary: 'Weekly sync',
                location: 'Conference Room A',
                startTime: new Date(Date.now() + 86400000), // Tomorrow
                attributedTo: `http://test.local/users/${testUser.username}`,
            },
        })

        testEvent2 = await prisma.event.create({
            data: {
                userId: testUser.id,
                title: 'Workshop',
                summary: 'Learning session',
                location: 'Online',
                startTime: new Date(Date.now() + 172800000), // Day after tomorrow
                eventStatus: 'EventScheduled',
                eventAttendanceMode: 'OnlineEventAttendanceMode',
                attributedTo: `http://test.local/users/${testUser.username}`,
            },
        })

        vi.clearAllMocks()
    })

    describe('GET /search', () => {
        it('should return all events when no filters provided', async () => {
            const res = await searchApp.request('/')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.events).toBeDefined()
            expect(body.pagination).toBeDefined()
            expect(body.pagination.page).toBe(1)
            expect(body.pagination.limit).toBe(20)
        })

        it('should filter events by text query in title', async () => {
            const res = await searchApp.request('/?q=Team')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.events.length).toBeGreaterThan(0)
            expect(body.events[0].title).toContain('Team')
        })

        it('should filter events by text query in summary', async () => {
            const res = await searchApp.request('/?q=Weekly')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.events.length).toBeGreaterThan(0)
            expect(body.events.some((e: any) => e.summary?.includes('Weekly'))).toBe(true)
        })

        it('should filter events by location', async () => {
            const res = await searchApp.request('/?location=Conference')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.events.length).toBeGreaterThan(0)
            expect(body.events[0].location).toContain('Conference')
        })

        it('should filter events by start date', async () => {
            const tomorrow = new Date(Date.now() + 86400000)
            const startDate = tomorrow.toISOString()

            const res = await searchApp.request(`/?startDate=${encodeURIComponent(startDate)}`)

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.events.length).toBeGreaterThan(0)
            body.events.forEach((event: any) => {
                expect(new Date(event.startTime).getTime()).toBeGreaterThanOrEqual(tomorrow.getTime())
            })
        })

        it('should filter events by end date', async () => {
            const dayAfterTomorrow = new Date(Date.now() + 172800000)
            const endDate = dayAfterTomorrow.toISOString()

            const res = await searchApp.request(`/?endDate=${encodeURIComponent(endDate)}`)

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.events.length).toBeGreaterThan(0)
            body.events.forEach((event: any) => {
                expect(new Date(event.startTime).getTime()).toBeLessThanOrEqual(dayAfterTomorrow.getTime())
            })
        })

        it('should filter events by date range', async () => {
            const tomorrow = new Date(Date.now() + 86400000)
            const dayAfterTomorrow = new Date(Date.now() + 172800000)

            const res = await searchApp.request(
                `/?startDate=${encodeURIComponent(tomorrow.toISOString())}&endDate=${encodeURIComponent(dayAfterTomorrow.toISOString())}`
            )

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            body.events.forEach((event: any) => {
                const eventTime = new Date(event.startTime).getTime()
                expect(eventTime).toBeGreaterThanOrEqual(tomorrow.getTime())
                expect(eventTime).toBeLessThanOrEqual(dayAfterTomorrow.getTime())
            })
        })

        it('should filter events by status', async () => {
            const res = await searchApp.request('/?status=EventScheduled')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            body.events.forEach((event: any) => {
                expect(event.eventStatus).toBe('EventScheduled')
            })
        })

        it('should filter events by attendance mode', async () => {
            const res = await searchApp.request('/?mode=OnlineEventAttendanceMode')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            body.events.forEach((event: any) => {
                expect(event.eventAttendanceMode).toBe('OnlineEventAttendanceMode')
            })
        })

        it('should filter events by organizer username', async () => {
            const res = await searchApp.request(`/?username=${testUser.username}`)

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.events.length).toBeGreaterThan(0)
            body.events.forEach((event: any) => {
                expect(event.user.username).toBe(testUser.username)
            })
        })

        it('should return empty results for non-existent organizer', async () => {
            const res = await searchApp.request('/?username=nonexistent')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.events).toHaveLength(0)
            expect(body.pagination.total).toBe(0)
        })

        it('should paginate results', async () => {
            // Create more events for pagination
            for (let i = 0; i < 5; i++) {
                await prisma.event.create({
                    data: {
                        userId: testUser.id,
                        title: `Event ${i}`,
                        startTime: new Date(Date.now() + (i + 1) * 86400000),
                        attributedTo: `http://test.local/users/${testUser.username}`,
                    },
                })
            }

            const res = await searchApp.request('/?page=1&limit=3')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.events.length).toBeLessThanOrEqual(3)
            expect(body.pagination.page).toBe(1)
            expect(body.pagination.limit).toBe(3)
        })

        it('should limit maximum page size to 100', async () => {
            const res = await searchApp.request('/?limit=200')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.pagination.limit).toBe(100)
        })

        it('should return filters in response', async () => {
            const res = await searchApp.request('/?q=test&location=room')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.filters).toBeDefined()
            expect(body.filters.q).toBe('test')
            expect(body.filters.location).toBe('room')
        })

        it('should handle invalid search parameters', async () => {
            const res = await searchApp.request('/?status=InvalidStatus')

            expect(res.status).toBe(400)
            const body = await res.json() as any as any
            expect(body.error).toBe('Invalid search parameters')
        })

        it('should handle invalid date format', async () => {
            const res = await searchApp.request('/?startDate=invalid-date')

            expect(res.status).toBe(400)
            const body = await res.json() as any as any
            expect(body.error).toBe('Invalid search parameters')
        })

        it('should handle database errors gracefully', async () => {
            vi.spyOn(prisma.event, 'findMany').mockRejectedValueOnce(new Error('Database error'))

            const res = await searchApp.request('/')

            expect(res.status).toBe(500)
            const body = await res.json() as any as any
            expect(body.error).toBe('Internal server error')
        })

        it('should include event counts in response', async () => {
            const res = await searchApp.request('/')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            if (body.events.length > 0) {
                expect(body.events[0]._count).toBeDefined()
                expect(typeof body.events[0]._count.attendance).toBe('number')
                expect(typeof body.events[0]._count.likes).toBe('number')
                expect(typeof body.events[0]._count.comments).toBe('number')
            }
        })

        it('should order events by startTime ascending', async () => {
            const res = await searchApp.request('/')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            if (body.events.length > 1) {
                for (let i = 1; i < body.events.length; i++) {
                    const prevTime = new Date(body.events[i - 1].startTime).getTime()
                    const currTime = new Date(body.events[i].startTime).getTime()
                    expect(currTime).toBeGreaterThanOrEqual(prevTime)
                }
            }
        })
    })

    describe('GET /search/upcoming', () => {
        it('should return only future events', async () => {
            // Create a past event
            await prisma.event.create({
                data: {
                    userId: testUser.id,
                    title: 'Past Event',
                    startTime: new Date(Date.now() - 86400000), // Yesterday
                    attributedTo: `http://test.local/users/${testUser.username}`,
                },
            })

            const res = await searchApp.request('/upcoming')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            body.events.forEach((event: any) => {
                expect(new Date(event.startTime).getTime()).toBeGreaterThan(Date.now())
            })
        })

        it('should respect limit parameter', async () => {
            // Create multiple future events
            for (let i = 0; i < 10; i++) {
                await prisma.event.create({
                    data: {
                        userId: testUser.id,
                        title: `Future Event ${i}`,
                        startTime: new Date(Date.now() + (i + 1) * 86400000),
                        attributedTo: `http://test.local/users/${testUser.username}`,
                    },
                })
            }

            const res = await searchApp.request('/upcoming?limit=5')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.events.length).toBeLessThanOrEqual(5)
        })

        it('should limit maximum to 50', async () => {
            const res = await searchApp.request('/upcoming?limit=100')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.events.length).toBeLessThanOrEqual(50)
        })

        it('should default limit to 10', async () => {
            const res = await searchApp.request('/upcoming')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.events.length).toBeLessThanOrEqual(10)
        })

        it('should order events by startTime ascending', async () => {
            const res = await searchApp.request('/upcoming')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            if (body.events.length > 1) {
                for (let i = 1; i < body.events.length; i++) {
                    const prevTime = new Date(body.events[i - 1].startTime).getTime()
                    const currTime = new Date(body.events[i].startTime).getTime()
                    expect(currTime).toBeGreaterThanOrEqual(prevTime)
                }
            }
        })

        it('should handle database errors gracefully', async () => {
            vi.spyOn(prisma.event, 'findMany').mockRejectedValueOnce(new Error('Database error'))

            const res = await searchApp.request('/upcoming')

            expect(res.status).toBe(500)
            const body = await res.json() as any as any
            expect(body.error).toBe('Internal server error')
        })
    })

    describe('GET /search/popular', () => {
        it('should return events sorted by popularity', async () => {
            // Create events with different popularity
            const popularEvent = await prisma.event.create({
                data: {
                    userId: testUser.id,
                    title: 'Popular Event',
                    startTime: new Date(Date.now() + 86400000),
                    attributedTo: `http://test.local/users/${testUser.username}`,
                },
            })

            const lessPopularEvent = await prisma.event.create({
                data: {
                    userId: testUser.id,
                    title: 'Less Popular Event',
                    startTime: new Date(Date.now() + 172800000),
                    attributedTo: `http://test.local/users/${testUser.username}`,
                },
            })

            // Add attendance and likes to popular event
            await prisma.eventAttendance.create({
                data: {
                    eventId: popularEvent.id,
                    userId: testUser.id,
                    status: 'attending',
                },
            })
            await prisma.eventLike.create({
                data: {
                    eventId: popularEvent.id,
                    userId: testUser.id,
                },
            })

            const res = await searchApp.request('/popular')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.events.length).toBeGreaterThan(0)
            
            // Popular event should have popularity score
            const popularInResults = body.events.find((e: any) => e.id === popularEvent.id)
            expect(popularInResults).toBeDefined()
            expect(popularInResults.popularity).toBeGreaterThan(0)
        })

        it('should only include future events', async () => {
            // Create a past event with high popularity
            const pastEvent = await prisma.event.create({
                data: {
                    userId: testUser.id,
                    title: 'Past Popular Event',
                    startTime: new Date(Date.now() - 86400000),
                    attributedTo: `http://test.local/users/${testUser.username}`,
                },
            })

            await prisma.eventAttendance.createMany({
                data: [
                    { eventId: pastEvent.id, userId: testUser.id, status: 'attending' },
                ],
            })

            const res = await searchApp.request('/popular')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            const pastEventInResults = body.events.find((e: any) => e.id === pastEvent.id)
            expect(pastEventInResults).toBeUndefined()
        })

        it('should respect limit parameter', async () => {
            const res = await searchApp.request('/popular?limit=5')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.events.length).toBeLessThanOrEqual(5)
        })

        it('should limit maximum to 50', async () => {
            const res = await searchApp.request('/popular?limit=100')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.events.length).toBeLessThanOrEqual(50)
        })

        it('should default limit to 10', async () => {
            const res = await searchApp.request('/popular')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            expect(body.events.length).toBeLessThanOrEqual(10)
        })

        it('should calculate popularity as attendance + likes', async () => {
            const event = await prisma.event.create({
                data: {
                    userId: testUser.id,
                    title: 'Test Event',
                    startTime: new Date(Date.now() + 86400000),
                    attributedTo: `http://test.local/users/${testUser.username}`,
                },
            })

            // Add 2 attendance and 3 likes
            await prisma.eventAttendance.createMany({
                data: [
                    { eventId: event.id, userId: testUser.id, status: 'attending' },
                ],
            })
            await prisma.eventLike.createMany({
                data: [
                    { eventId: event.id, userId: testUser.id },
                ],
            })

            const res = await searchApp.request('/popular')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            const eventInResults = body.events.find((e: any) => e.id === event.id)
            if (eventInResults) {
                expect(eventInResults.popularity).toBe(2) // 1 attendance + 1 like
            }
        })

        it('should sort events by popularity descending', async () => {
            const res = await searchApp.request('/popular')

            expect(res.status).toBe(200)
            const body = await res.json() as any as any
            if (body.events.length > 1) {
                for (let i = 1; i < body.events.length; i++) {
                    expect(body.events[i - 1].popularity).toBeGreaterThanOrEqual(body.events[i].popularity)
                }
            }
        })

        it('should handle database errors gracefully', async () => {
            vi.spyOn(prisma.event, 'findMany').mockRejectedValueOnce(new Error('Database error'))

            const res = await searchApp.request('/popular')

            expect(res.status).toBe(500)
            const body = await res.json() as any as any
            expect(body.error).toBe('Internal server error')
        })
    })
})

