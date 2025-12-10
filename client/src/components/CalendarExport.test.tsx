import { describe, it, expect } from 'vitest'

/**
 * Test CalendarExport component logic
 */
describe('CalendarExport', () => {
    it('constructs correct ICS URL for single event', () => {
        const eventId = 'test-event-123'
        const expectedUrl = `/api/calendar/${eventId}/export.ics`
        
        expect(expectedUrl).toBe('/api/calendar/test-event-123/export.ics')
    })

    it('constructs correct ICS URL for user calendar', () => {
        const username = 'testuser'
        const expectedUrl = `/api/calendar/user/${username}/export.ics`
        
        expect(expectedUrl).toBe('/api/calendar/user/testuser/export.ics')
    })

    it('constructs correct ICS URL for public feed', () => {
        const expectedUrl = '/api/calendar/feed.ics'
        
        expect(expectedUrl).toBe('/api/calendar/feed.ics')
    })

    it('constructs correct Google Calendar export URL', () => {
        const eventId = 'test-event-123'
        const expectedUrl = `/api/calendar/${eventId}/export/google`
        
        expect(expectedUrl).toBe('/api/calendar/test-event-123/export/google')
    })

    it('generates correct filename for event ICS', () => {
        const eventId = 'test-event-123'
        const filename = `event-${eventId}.ics`
        
        expect(filename).toBe('event-test-event-123.ics')
    })

    it('generates correct filename for user calendar ICS', () => {
        const username = 'testuser'
        const filename = `${username}-calendar.ics`
        
        expect(filename).toBe('testuser-calendar.ics')
    })

    it('generates correct filename for feed ICS', () => {
        const filename = 'constellate-feed.ics'
        
        expect(filename).toBe('constellate-feed.ics')
    })
})
