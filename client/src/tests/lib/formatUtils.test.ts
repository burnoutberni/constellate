import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { formatDate, formatTime, formatRelativeDate } from '../../lib/formatUtils'

describe('formatUtils', () => {
    beforeEach(() => {
        // Mock navigator.language
        Object.defineProperty(navigator, 'language', {
            writable: true,
            value: 'en-US',
        })
    })

    describe('formatDate', () => {
        it('formats a date string to localized date format', () => {
            const dateString = '2024-12-25T10:00:00Z'
            const formatted = formatDate(dateString)
            
            // Should contain month and day at minimum
            expect(formatted).toContain('December')
            expect(formatted).toContain('25')
            expect(formatted).toContain('2024')
        })

        it('uses custom options when provided', () => {
            const dateString = '2024-12-25T10:00:00Z'
            const formatted = formatDate(dateString, {
                month: 'short',
                day: 'numeric',
            })
            
            expect(formatted).toContain('Dec')
            expect(formatted).toContain('25')
        })
    })

    describe('formatTime', () => {
        it('formats a date string to localized time format', () => {
            const dateString = '2024-12-25T14:30:00Z'
            const formatted = formatTime(dateString)
            
            // Should contain time information
            expect(formatted).toMatch(/\d{1,2}:\d{2}/)
        })

        it('uses custom options when provided', () => {
            const dateString = '2024-12-25T14:30:00Z'
            const formatted = formatTime(dateString, {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
            })
            
            expect(formatted).toMatch(/\d{2}:\d{2}/)
        })
    })

    describe('formatRelativeDate', () => {
        beforeEach(() => {
            // Mock current date to December 20, 2024
            vi.useFakeTimers()
            vi.setSystemTime(new Date('2024-12-20T12:00:00Z'))
        })

        afterEach(() => {
            vi.useRealTimers()
        })

        it('returns "Today" for today\'s date', () => {
            const today = new Date('2024-12-20T15:00:00Z').toISOString()
            expect(formatRelativeDate(today)).toBe('Today')
        })

        it('returns "Tomorrow" for tomorrow\'s date', () => {
            const tomorrow = new Date('2024-12-21T15:00:00Z').toISOString()
            expect(formatRelativeDate(tomorrow)).toBe('Tomorrow')
        })

        it('returns "In X days" for dates within a week', () => {
            const threeDaysLater = new Date('2024-12-23T15:00:00Z').toISOString()
            expect(formatRelativeDate(threeDaysLater)).toBe('In 3 days')
        })

        it('returns formatted date for dates more than a week away', () => {
            const futureDate = new Date('2024-12-30T15:00:00Z').toISOString()
            const formatted = formatRelativeDate(futureDate)
            
            // Should be a formatted date, not relative
            expect(formatted).not.toContain('In')
            expect(formatted).toMatch(/Dec|December/)
            expect(formatted).toContain('30')
        })

        it('includes year for dates in different year', () => {
            const nextYear = new Date('2025-01-15T15:00:00Z').toISOString()
            const formatted = formatRelativeDate(nextYear)
            
            expect(formatted).toContain('2025')
        })

        it('handles past dates correctly', () => {
            const yesterday = new Date('2024-12-19T15:00:00Z').toISOString()
            const formatted = formatRelativeDate(yesterday)
            
            // Past dates should be formatted, not relative
            expect(formatted).not.toContain('Today')
            expect(formatted).not.toContain('Tomorrow')
            expect(formatted).not.toContain('In')
        })
    })

    describe('formatRelativeDate - timezone edge cases', () => {
        beforeEach(() => {
            vi.useFakeTimers()
        })

        afterEach(() => {
            vi.useRealTimers()
        })

        it('handles UTC dates correctly when local timezone is behind UTC', () => {
            // Simulate Dec 31, 2024 11:00 PM EST (UTC-5) = Jan 1, 2025 04:00:00Z UTC
            // Event at Jan 1, 2025 02:00:00Z UTC should be "Tomorrow" (not "Today")
            vi.setSystemTime(new Date('2025-01-01T04:00:00Z'))
            
            const eventDate = '2025-01-01T02:00:00Z'
            const result = formatRelativeDate(eventDate)
            
            // Should be "Today" because both are Jan 1 in UTC
            expect(result).toBe('Today')
        })

        it('handles event at midnight UTC correctly', () => {
            // Current time: Dec 31, 2024 11:00 PM EST (UTC-5) = Jan 1, 2025 04:00:00Z UTC
            vi.setSystemTime(new Date('2025-01-01T04:00:00Z'))
            
            // Event at Jan 1, 2025 00:00:00Z UTC
            const eventDate = '2025-01-01T00:00:00Z'
            const result = formatRelativeDate(eventDate)
            
            expect(result).toBe('Today')
        })

        it('handles event early in UTC day when local timezone is ahead', () => {
            // Current time: Jan 1, 2025 01:00 AM JST (UTC+9) = Dec 31, 2024 16:00:00Z UTC
            vi.setSystemTime(new Date('2024-12-31T16:00:00Z'))
            
            // Event at Jan 1, 2025 02:00:00Z UTC
            const eventDate = '2025-01-01T02:00:00Z'
            const result = formatRelativeDate(eventDate)
            
            // Should be "Tomorrow" because it's Jan 1 in UTC (tomorrow from Dec 31 UTC)
            expect(result).toBe('Tomorrow')
        })

        it('handles event late in UTC day when local timezone is behind', () => {
            // Current time: Jan 1, 2025 01:00 AM EST (UTC-5) = Jan 1, 2025 06:00:00Z UTC
            vi.setSystemTime(new Date('2025-01-01T06:00:00Z'))
            
            // Event at Jan 1, 2025 23:00:00Z UTC (same UTC day)
            const eventDate = '2025-01-01T23:00:00Z'
            const result = formatRelativeDate(eventDate)
            
            expect(result).toBe('Today')
        })

        it('handles event crossing UTC day boundary correctly', () => {
            // Current time: Dec 31, 2024 23:30:00Z UTC
            vi.setSystemTime(new Date('2024-12-31T23:30:00Z'))
            
            // Event at Jan 1, 2025 00:30:00Z UTC (next UTC day)
            const eventDate = '2025-01-01T00:30:00Z'
            const result = formatRelativeDate(eventDate)
            
            expect(result).toBe('Tomorrow')
        })

        it('handles event in same UTC day but different local day', () => {
            // Current time: Jan 1, 2025 01:00 AM EST (UTC-5) = Jan 1, 2025 06:00:00Z UTC
            vi.setSystemTime(new Date('2025-01-01T06:00:00Z'))
            
            // Event at Jan 1, 2025 01:00:00Z UTC (same UTC day, but Dec 31 in EST)
            const eventDate = '2025-01-01T01:00:00Z'
            const result = formatRelativeDate(eventDate)
            
            // Should be "Today" because both are Jan 1 in UTC
            expect(result).toBe('Today')
        })

        it('handles year boundary correctly in UTC', () => {
            // Current time: Dec 31, 2024 23:00:00Z UTC
            vi.setSystemTime(new Date('2024-12-31T23:00:00Z'))
            
            // Event at Jan 1, 2025 01:00:00Z UTC
            const eventDate = '2025-01-01T01:00:00Z'
            const result = formatRelativeDate(eventDate)
            
            expect(result).toBe('Tomorrow')
        })

        it('handles dates multiple days away correctly across timezones', () => {
            // Current time: Dec 31, 2024 20:00:00Z UTC
            vi.setSystemTime(new Date('2024-12-31T20:00:00Z'))
            
            // Event at Jan 3, 2025 02:00:00Z UTC (3 days later in UTC)
            const eventDate = '2025-01-03T02:00:00Z'
            const result = formatRelativeDate(eventDate)
            
            expect(result).toBe('In 3 days')
        })

        it('handles edge case from user example: event at 02:00 UTC on Jan 1 when current time is Dec 31 EST', () => {
            // Current time: Dec 31, 2024 11:00 PM EST (UTC-5) = Jan 1, 2025 04:00:00Z UTC
            vi.setSystemTime(new Date('2025-01-01T04:00:00Z'))
            
            // Event at Jan 1, 2025 02:00:00Z UTC
            // In EST, this would be Dec 31, 2024 9:00 PM, but in UTC it's Jan 1
            const eventDate = '2025-01-01T02:00:00Z'
            const result = formatRelativeDate(eventDate)
            
            // Should be "Today" because both dates are Jan 1 in UTC
            expect(result).toBe('Today')
        })

        it('handles reverse case: event at 02:00 UTC on Jan 1 when current time is Dec 31 UTC', () => {
            // Current time: Dec 31, 2024 23:00:00Z UTC
            vi.setSystemTime(new Date('2024-12-31T23:00:00Z'))
            
            // Event at Jan 1, 2025 02:00:00Z UTC
            const eventDate = '2025-01-01T02:00:00Z'
            const result = formatRelativeDate(eventDate)
            
            // Should be "Tomorrow" because event is Jan 1 UTC, current is Dec 31 UTC
            expect(result).toBe('Tomorrow')
        })
    })
})
