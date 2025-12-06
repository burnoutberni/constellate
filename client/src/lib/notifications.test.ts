import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getNotificationTypeMeta } from './notifications'
import { formatRelativeTime } from './datetime'

describe('getNotificationTypeMeta', () => {
    it('returns metadata for known types', () => {
        const meta = getNotificationTypeMeta('FOLLOW')
        expect(meta.label).toBe('New follower')
        expect(meta.icon).toBe('👤')
    })

    it('falls back for unknown types', () => {
        const meta = getNotificationTypeMeta('UNKNOWN')
        expect(meta.label).toBe('Notification')
    })
})

describe('formatRelativeTime', () => {
    const base = new Date('2025-01-01T12:00:00Z')

    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(base)
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('returns seconds for short differences', () => {
        const value = new Date(base.getTime() - 30 * 1000)
        expect(formatRelativeTime(value)).toBe('30s ago')
    })

    it('returns minutes for medium differences', () => {
        const value = new Date(base.getTime() - 5 * 60 * 1000)
        expect(formatRelativeTime(value)).toBe('5m ago')
    })

    it('returns days for longer differences', () => {
        const value = new Date(base.getTime() - 2 * 24 * 60 * 60 * 1000)
        expect(formatRelativeTime(value)).toBe('2d ago')
    })

    it('falls back to formatted date for older values', () => {
        const value = new Date(base.getTime() - 14 * 24 * 60 * 60 * 1000)
        expect(formatRelativeTime(value)).toMatch(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/)
    })

    it('returns empty string for invalid dates', () => {
        expect(formatRelativeTime('not-a-date')).toBe('')
    })
})

