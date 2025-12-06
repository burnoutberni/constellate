import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatRelativeTime, getNotificationMeta, isNotificationUnread } from './notifications'
import type { Notification } from '../types'

describe('notification helpers', () => {
    afterEach(() => {
        vi.useRealTimers()
    })

    it('returns default metadata for unknown types', () => {
        const meta = getNotificationMeta('unknown' as unknown as Notification['type'])
        expect(meta.label).toBe('Notification')
        expect(meta.icon).toBe('🔔')
    })

    it('formats relative time based on current clock', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2025-01-01T00:00:00Z'))
        const result = formatRelativeTime('2025-01-01T01:00:00Z')
        expect(result).toContain('1 hour')
    })

    it('detects unread notifications using flags', () => {
        const unread: Notification = {
            id: 'n1',
            type: 'mention',
            title: 'Mentioned you',
            body: 'Alex mentioned you in a comment',
            createdAt: new Date().toISOString(),
            isRead: false,
        }

        const read: Notification = {
            ...unread,
            id: 'n2',
            isRead: true,
            readAt: new Date().toISOString(),
        }

        expect(isNotificationUnread(unread)).toBe(true)
        expect(isNotificationUnread(read)).toBe(false)
    })
})
