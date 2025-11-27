/**
 * Tests for Calendar Export (ICS)
 */

import { config } from 'dotenv'
config()
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'
import { prisma } from '../lib/prisma.js'

describe('Calendar Export', () => {
    let app: any
    let testUser: any
    let testEvent: any
    const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000'

    beforeAll(async () => {
        const mod = await import('../server.js')
        app = mod.app
    })

    beforeEach(async () => {
        // Clean up test data
        await prisma.eventAttendance.deleteMany({})
        await prisma.eventLike.deleteMany({})
        await prisma.comment.deleteMany({})
        await prisma.event.deleteMany({})
        await prisma.user.deleteMany({})

        // Create test user
        testUser = await prisma.user.create({
            data: {
                username: 'testuser',
                email: 'test@example.com',
                name: 'Test User',
                isRemote: false,
            },
        })

        // Create test event
        testEvent = await prisma.event.create({
            data: {
                title: 'Test Event',
                summary: 'Test event description',
                location: 'Test Location',
                startTime: new Date('2024-01-01T10:00:00Z'),
                endTime: new Date('2024-01-01T12:00:00Z'),
                userId: testUser.id,
                attributedTo: `${baseUrl}/users/${testUser.username}`,
            },
        })
    })

    afterEach(async () => {
        // Clean up
        await prisma.eventAttendance.deleteMany({})
        await prisma.eventLike.deleteMany({})
        await prisma.comment.deleteMany({})
        await prisma.event.deleteMany({})
        await prisma.user.deleteMany({})
    })

    describe('Single Event Export', () => {
        it('should export single event as ICS', async () => {
            const res = await app.request(`/api/calendar/${testEvent.id}/export.ics`)

            expect(res.status).toBe(200)
            expect(res.headers.get('content-type')).toContain('text/calendar')
            expect(res.headers.get('content-disposition')).toContain('attachment')
            expect(res.headers.get('content-disposition')).toContain('Test_Event.ics')

            const icsContent = await res.text()
            expect(icsContent).toContain('BEGIN:VCALENDAR')
            expect(icsContent).toContain('END:VCALENDAR')
            expect(icsContent).toContain('BEGIN:VEVENT')
            expect(icsContent).toContain('END:VEVENT')
            expect(icsContent).toContain('SUMMARY:Test Event')
            expect(icsContent).toContain('DESCRIPTION:Test event description')
            expect(icsContent).toContain('LOCATION:Test Location')
        })

        it('should handle event without endTime', async () => {
            const eventWithoutEnd = await prisma.event.create({
                data: {
                    title: 'Event Without End',
                    startTime: new Date('2024-01-01T10:00:00Z'),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                },
            })

            const res = await app.request(`/api/calendar/${eventWithoutEnd.id}/export.ics`)

            expect(res.status).toBe(200)
            const icsContent = await res.text()
            expect(icsContent).toContain('SUMMARY:Event Without End')
            // End time should default to start time
            expect(icsContent).toContain('DTEND')

            // Cleanup
            await prisma.event.delete({ where: { id: eventWithoutEnd.id } })
        })

        it('should handle event without optional fields', async () => {
            const minimalEvent = await prisma.event.create({
                data: {
                    title: 'Minimal Event',
                    startTime: new Date('2024-01-01T10:00:00Z'),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                },
            })

            const res = await app.request(`/api/calendar/${minimalEvent.id}/export.ics`)

            expect(res.status).toBe(200)
            const icsContent = await res.text()
            expect(icsContent).toContain('SUMMARY:Minimal Event')
            // Should still be valid ICS even without optional fields

            // Cleanup
            await prisma.event.delete({ where: { id: minimalEvent.id } })
        })

        it('should handle cancelled events', async () => {
            const cancelledEvent = await prisma.event.create({
                data: {
                    title: 'Cancelled Event',
                    startTime: new Date('2024-01-01T10:00:00Z'),
                    eventStatus: 'EventCancelled',
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                },
            })

            const res = await app.request(`/api/calendar/${cancelledEvent.id}/export.ics`)

            expect(res.status).toBe(200)
            const icsContent = await res.text()
            expect(icsContent).toContain('STATUS:CANCELLED')

            // Cleanup
            await prisma.event.delete({ where: { id: cancelledEvent.id } })
        })

        it('should include event URL when present', async () => {
            const eventWithUrl = await prisma.event.create({
                data: {
                    title: 'Event With URL',
                    startTime: new Date('2024-01-01T10:00:00Z'),
                    url: 'https://example.com/event',
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                },
            })

            const res = await app.request(`/api/calendar/${eventWithUrl.id}/export.ics`)

            expect(res.status).toBe(200)
            const icsContent = await res.text()
            expect(icsContent).toContain('URL:https://example.com/event')

            // Cleanup
            await prisma.event.delete({ where: { id: eventWithUrl.id } })
        })

        it('should return 404 for non-existent event', async () => {
            const res = await app.request('/api/calendar/nonexistent-id/export.ics')

            expect(res.status).toBe(404)
            const text = await res.text()
            expect(text).toBe('Event not found')
        })

        it('should sanitize filename for special characters', async () => {
            const specialEvent = await prisma.event.create({
                data: {
                    title: 'Event: With/Special\\Characters?',
                    startTime: new Date('2024-01-01T10:00:00Z'),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                },
            })

            const res = await app.request(`/api/calendar/${specialEvent.id}/export.ics`)

            expect(res.status).toBe(200)
            const disposition = res.headers.get('content-disposition')
            expect(disposition).toBeTruthy()
            // Filename should have special characters replaced
            expect(disposition).toMatch(/filename="[^"]*\.ics"/)

            // Cleanup
            await prisma.event.delete({ where: { id: specialEvent.id } })
        })
    })

    describe('User Calendar Export', () => {
        it('should export user events as ICS', async () => {
            // Create additional events for the user
            await prisma.event.create({
                data: {
                    title: 'Event 2',
                    startTime: new Date('2024-01-02T10:00:00Z'),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                },
            })

            await prisma.event.create({
                data: {
                    title: 'Event 3',
                    startTime: new Date('2024-01-03T10:00:00Z'),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                },
            })

            const res = await app.request(`/api/calendar/user/${testUser.username}/export.ics`)

            expect(res.status).toBe(200)
            expect(res.headers.get('content-type')).toContain('text/calendar')
            expect(res.headers.get('content-disposition')).toContain(`${testUser.username}_calendar.ics`)

            const icsContent = await res.text()
            expect(icsContent).toContain('BEGIN:VCALENDAR')
            expect(icsContent).toContain('END:VCALENDAR')
            // Should contain multiple events
            const eventMatches = icsContent.match(/BEGIN:VEVENT/g)
            expect(eventMatches?.length).toBeGreaterThanOrEqual(3)
        })

        it('should handle user with no events', async () => {
            const userWithoutEvents = await prisma.user.create({
                data: {
                    username: 'noevents',
                    email: 'noevents@example.com',
                    isRemote: false,
                },
            })

            const res = await app.request(`/api/calendar/user/${userWithoutEvents.username}/export.ics`)

            expect(res.status).toBe(200)
            const icsContent = await res.text()
            expect(icsContent).toContain('BEGIN:VCALENDAR')
            expect(icsContent).toContain('END:VCALENDAR')
            // Should not contain any events
            expect(icsContent).not.toContain('BEGIN:VEVENT')

            // Cleanup
            await prisma.user.delete({ where: { id: userWithoutEvents.id } })
        })

        it('should return 404 for non-existent user', async () => {
            const res = await app.request('/api/calendar/user/nonexistent/export.ics')

            expect(res.status).toBe(404)
            const text = await res.text()
            expect(text).toBe('User not found')
        })

        it('should use user name in calendar name when available', async () => {
            const res = await app.request(`/api/calendar/user/${testUser.username}/export.ics`)

            expect(res.status).toBe(200)
            const icsContent = await res.text()
            expect(icsContent).toContain(`X-WR-CALNAME:${testUser.name}'s Events`)
        })

        it('should use username in calendar name when name is missing', async () => {
            const userWithoutName = await prisma.user.create({
                data: {
                    username: 'noname',
                    email: 'noname@example.com',
                    name: null,
                    isRemote: false,
                },
            })

            const res = await app.request(`/api/calendar/user/${userWithoutName.username}/export.ics`)

            expect(res.status).toBe(200)
            const icsContent = await res.text()
            expect(icsContent).toContain(`X-WR-CALNAME:${userWithoutName.username}'s Events`)

            // Cleanup
            await prisma.user.delete({ where: { id: userWithoutName.id } })
        })
    })

    describe('Public Feed Export', () => {
        it('should export public events feed as ICS', async () => {
            // Create future events
            const futureEvent1 = await prisma.event.create({
                data: {
                    title: 'Future Event 1',
                    startTime: new Date(Date.now() + 86400000), // Tomorrow
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                },
            })

            const futureEvent2 = await prisma.event.create({
                data: {
                    title: 'Future Event 2',
                    startTime: new Date(Date.now() + 172800000), // Day after tomorrow
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                },
            })

            const res = await app.request('/api/calendar/feed.ics')

            expect(res.status).toBe(200)
            expect(res.headers.get('content-type')).toContain('text/calendar')

            const icsContent = await res.text()
            expect(icsContent).toContain('BEGIN:VCALENDAR')
            expect(icsContent).toContain('END:VCALENDAR')
            expect(icsContent).toContain('X-WR-CALNAME:Stellar Calendar - Public Events')
            // Should contain future events
            expect(icsContent).toContain('SUMMARY:Future Event 1')
            expect(icsContent).toContain('SUMMARY:Future Event 2')

            // Cleanup
            await prisma.event.delete({ where: { id: futureEvent1.id } })
            await prisma.event.delete({ where: { id: futureEvent2.id } })
        })

        it('should only include future events', async () => {
            // Create past event
            const pastEvent = await prisma.event.create({
                data: {
                    title: 'Past Event',
                    startTime: new Date(Date.now() - 86400000), // Yesterday
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                },
            })

            const res = await app.request('/api/calendar/feed.ics')

            expect(res.status).toBe(200)
            const icsContent = await res.text()
            // Should not contain past event
            expect(icsContent).not.toContain('SUMMARY:Past Event')

            // Cleanup
            await prisma.event.delete({ where: { id: pastEvent.id } })
        })

        it('should limit to 100 events', async () => {
            // Create many future events
            const events = []
            for (let i = 0; i < 150; i++) {
                const event = await prisma.event.create({
                    data: {
                        title: `Event ${i}`,
                        startTime: new Date(Date.now() + (i + 1) * 86400000),
                        userId: testUser.id,
                        attributedTo: `${baseUrl}/users/${testUser.username}`,
                    },
                })
                events.push(event)
            }

            const res = await app.request('/api/calendar/feed.ics')

            expect(res.status).toBe(200)
            const icsContent = await res.text()
            const eventMatches = icsContent.match(/BEGIN:VEVENT/g)
            // Should be limited to 100
            expect(eventMatches?.length).toBeLessThanOrEqual(100)

            // Cleanup
            await prisma.event.deleteMany({
                where: {
                    id: { in: events.map(e => e.id) },
                },
            })
        })

        it('should handle events without user', async () => {
            const eventWithoutUser = await prisma.event.create({
                data: {
                    title: 'Event Without User',
                    startTime: new Date(Date.now() + 86400000),
                    userId: null,
                    attributedTo: 'https://remote.example.com/users/remote',
                },
            })

            const res = await app.request('/api/calendar/feed.ics')

            expect(res.status).toBe(200)
            const icsContent = await res.text()
            expect(icsContent).toContain('SUMMARY:Event Without User')
            // Should handle missing user gracefully

            // Cleanup
            await prisma.event.delete({ where: { id: eventWithoutUser.id } })
        })

        it('should include calendar URL in feed', async () => {
            const res = await app.request('/api/calendar/feed.ics')

            expect(res.status).toBe(200)
            const icsContent = await res.text()
            expect(icsContent).toContain(`X-WR-CALDESC:Public events from Stellar Calendar`)
        })
    })

    describe('ICS Format Validation', () => {
        it('should produce valid ICS format', async () => {
            const res = await app.request(`/api/calendar/${testEvent.id}/export.ics`)

            expect(res.status).toBe(200)
            const icsContent = await res.text()

            // Basic ICS structure
            expect(icsContent).toContain('BEGIN:VCALENDAR')
            expect(icsContent).toContain('VERSION:2.0')
            expect(icsContent).toContain('PRODID:')
            expect(icsContent).toContain('END:VCALENDAR')

            // Event structure
            expect(icsContent).toContain('BEGIN:VEVENT')
            expect(icsContent).toContain('END:VEVENT')
            expect(icsContent).toContain('DTSTART')
            expect(icsContent).toContain('DTEND')
            expect(icsContent).toContain('SUMMARY')
        })

        it('should include organizer information', async () => {
            const res = await app.request(`/api/calendar/${testEvent.id}/export.ics`)

            expect(res.status).toBe(200)
            const icsContent = await res.text()
            expect(icsContent).toContain('ORGANIZER')
            expect(icsContent).toContain(testUser.name || testUser.username)
        })

        it('should format dates correctly', async () => {
            const res = await app.request(`/api/calendar/${testEvent.id}/export.ics`)

            expect(res.status).toBe(200)
            const icsContent = await res.text()
            // ICS dates should be in format YYYYMMDDTHHMMSSZ
            expect(icsContent).toMatch(/DTSTART:\d{8}T\d{6}Z/)
            expect(icsContent).toMatch(/DTEND:\d{8}T\d{6}Z/)
        })
    })

    describe('Error Handling', () => {
        it('should handle database errors in single event export', async () => {
            const { vi } = await import('vitest')
            const originalFindUnique = prisma.event.findUnique
            vi.spyOn(prisma.event, 'findUnique').mockRejectedValueOnce(new Error('Database error'))

            const res = await app.request(`/api/calendar/${testEvent.id}/export.ics`)

            expect(res.status).toBe(500)
            const text = await res.text()
            expect(text).toBe('Internal server error')

            // Restore
            prisma.event.findUnique = originalFindUnique
        })

        it('should handle database errors in user calendar export', async () => {
            const { vi } = await import('vitest')
            const originalFindUnique = prisma.user.findUnique
            vi.spyOn(prisma.user, 'findUnique').mockRejectedValueOnce(new Error('Database error'))

            const res = await app.request(`/api/calendar/user/${testUser.username}/export.ics`)

            expect(res.status).toBe(500)
            const text = await res.text()
            expect(text).toBe('Internal server error')

            // Restore
            prisma.user.findUnique = originalFindUnique
        })

        it('should handle database errors in feed export', async () => {
            const { vi } = await import('vitest')
            const originalFindMany = prisma.event.findMany
            vi.spyOn(prisma.event, 'findMany').mockRejectedValueOnce(new Error('Database error'))

            const res = await app.request('/api/calendar/feed.ics')

            expect(res.status).toBe(500)
            const text = await res.text()
            expect(text).toBe('Internal server error')

            // Restore
            prisma.event.findMany = originalFindMany
        })

        it('should handle event without user in single export', async () => {
            const eventWithoutUser = await prisma.event.create({
                data: {
                    title: 'Event Without User',
                    startTime: new Date('2024-01-01T10:00:00Z'),
                    userId: null,
                    attributedTo: 'https://remote.example.com/users/remote',
                },
            })

            const res = await app.request(`/api/calendar/${eventWithoutUser.id}/export.ics`)

            expect(res.status).toBe(200)
            const icsContent = await res.text()
            expect(icsContent).toContain('SUMMARY:Event Without User')
            // Should handle missing user gracefully

            // Cleanup
            await prisma.event.delete({ where: { id: eventWithoutUser.id } })
        })

        it('should handle user without name in user export', async () => {
            const userWithoutName = await prisma.user.create({
                data: {
                    username: 'nonameuser',
                    email: 'noname@example.com',
                    name: null,
                    isRemote: false,
                },
            })

            const event = await prisma.event.create({
                data: {
                    title: 'User Event',
                    startTime: new Date('2024-01-01T10:00:00Z'),
                    userId: userWithoutName.id,
                    attributedTo: `${baseUrl}/users/${userWithoutName.username}`,
                },
            })

            const res = await app.request(`/api/calendar/user/${userWithoutName.username}/export.ics`)

            expect(res.status).toBe(200)
            const icsContent = await res.text()
            expect(icsContent).toContain('SUMMARY:User Event')

            // Cleanup
            await prisma.event.delete({ where: { id: event.id } })
            await prisma.user.delete({ where: { id: userWithoutName.id } })
        })
    })
})

