import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { formatDate, formatTime, formatRelativeDate } from './formatUtils'

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
})
