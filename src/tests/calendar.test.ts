/**
 * Tests for Calendar Export (ICS)
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { config } from 'dotenv'
config()
vi.mock('../lib/eventVisibility.js', () => ({
    canUserViewEvent: vi.fn().mockResolvedValue(true),
}))
import { prisma } from '../lib/prisma.js'
import { canUserViewEvent } from '../lib/eventVisibility.js'

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
        vi.mocked(canUserViewEvent).mockResolvedValue(true)
    })

    afterEach(async () => {
        vi.mocked(canUserViewEvent).mockReset()
        // Clean up
        await prisma.eventAttendance.deleteMany({})
        await prisma.eventLike.deleteMany({})
        await prisma.comment.deleteMany({})
        await prisma.event.deleteMany({})
        await prisma.user.deleteMany({})
    })

    

    describe('User Calendar Export', () => {

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

    })

    describe('Public Feed Export', () => {

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
            // Note: Cleanup is handled by afterEach hook
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
            // Note: Cleanup is handled by afterEach hook
        })

        it('should include calendar URL in feed', async () => {
            const res = await app.request('/api/calendar/feed.ics')

            expect(res.status).toBe(200)
            const icsContent = await res.text()
            expect(icsContent).toContain(`X-WR-CALDESC:Public events from Constellate`)
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
            // Note: Cleanup is handled by afterEach hook
        })
    })

    describe('Visibility filtering', () => {
        it('should return 403 when viewer cannot access single event export', async () => {
            vi.mocked(canUserViewEvent).mockResolvedValueOnce(false)

            const res = await app.request(`/api/calendar/${testEvent.id}/export.ics`)

            expect(res.status).toBe(403)
            const text = await res.text()
            expect(text).toBe('Forbidden')
        })

        it('should exclude hidden events in user calendar export', async () => {
            await prisma.event.create({
                data: {
                    title: 'Followers Only Event',
                    startTime: new Date('2024-01-02T10:00:00Z'),
                    userId: testUser.id,
                    attributedTo: `${baseUrl}/users/${testUser.username}`,
                    visibility: 'FOLLOWERS',
                },
            })

            vi.mocked(canUserViewEvent).mockResolvedValueOnce(true).mockResolvedValueOnce(false)

            const res = await app.request(`/api/calendar/user/${testUser.username}/export.ics`)

            expect(res.status).toBe(200)
            const icsContent = await res.text()
            expect(icsContent).toContain('SUMMARY:Test Event')
            expect(icsContent).not.toContain('SUMMARY:Followers Only Event')
        })
    })
})

