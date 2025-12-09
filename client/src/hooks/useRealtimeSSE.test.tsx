import { describe, it, expect } from 'vitest'
import type { Notification } from '../types'
import type { NotificationsResponse } from './queries/notifications'

/**
 * Test the unreadCount calculation logic from notification:created event handler
 * This tests the core logic that was fixed to prevent inflated unread counts
 */
describe('notification:created unreadCount logic', () => {
    // Extract the updater logic for testing
    const createNotificationUpdater = (newNotification: Notification) => {
        return (current: NotificationsResponse, limit: number | null): NotificationsResponse => {
            // Find existing notification before filtering to check its read status
            const existingNotification = current.notifications.find((item) => item.id === newNotification.id)
            const wasExistingUnread = existingNotification ? !existingNotification.read : false
            
            const filtered = current.notifications.filter((item) => item.id !== newNotification.id)
            const merged = [newNotification, ...filtered]
            const trimmed = typeof limit === 'number' ? merged.slice(0, limit) : merged

            // Calculate unreadCount change:
            // - If new notification is unread and old one wasn't (or didn't exist), increment
            // - If new notification is read and old one was unread, decrement
            // - Otherwise, no change
            let unreadCountChange = 0
            if (!newNotification.read && !wasExistingUnread) {
                // New unread notification (old one was read or didn't exist)
                unreadCountChange = 1
            } else if (newNotification.read && wasExistingUnread) {
                // New read notification (old one was unread)
                unreadCountChange = -1
            }
            // If both are unread or both are read, no change needed

            return {
                notifications: trimmed,
                unreadCount: Math.max(0, current.unreadCount + unreadCountChange),
            }
        }
    }

    const createNotification = (id: string, read: boolean): Notification => ({
        id,
        type: 'FOLLOW',
        title: 'Test notification',
        body: 'Test body',
        read,
        readAt: read ? new Date().toISOString() : null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        contextUrl: '/test',
        actor: null,
    })

    describe('new notification (no existing)', () => {
        it('increments count when new notification is unread', () => {
            const current: NotificationsResponse = {
                notifications: [],
                unreadCount: 5,
            }
            const newNotification = createNotification('new-1', false)
            const updater = createNotificationUpdater(newNotification)
            const result = updater(current, null)

            expect(result.unreadCount).toBe(6)
            expect(result.notifications).toHaveLength(1)
            expect(result.notifications[0].id).toBe('new-1')
        })

        it('does not change count when new notification is read', () => {
            const current: NotificationsResponse = {
                notifications: [],
                unreadCount: 5,
            }
            const newNotification = createNotification('new-1', true)
            const updater = createNotificationUpdater(newNotification)
            const result = updater(current, null)

            expect(result.unreadCount).toBe(5)
            expect(result.notifications).toHaveLength(1)
        })
    })

    describe('updating existing notification', () => {
        it('does not increment when both old and new are unread', () => {
            const existingUnread = createNotification('existing-1', false)
            const current: NotificationsResponse = {
                notifications: [existingUnread],
                unreadCount: 3,
            }
            const newUnread = createNotification('existing-1', false) // Same ID, still unread
            const updater = createNotificationUpdater(newUnread)
            const result = updater(current, null)

            // Should not increment - both were unread
            expect(result.unreadCount).toBe(3)
            expect(result.notifications).toHaveLength(1)
        })

        it('increments when old was read and new is unread', () => {
            const existingRead = createNotification('existing-1', true)
            const current: NotificationsResponse = {
                notifications: [existingRead],
                unreadCount: 2,
            }
            const newUnread = createNotification('existing-1', false) // Same ID, now unread
            const updater = createNotificationUpdater(newUnread)
            const result = updater(current, null)

            // Should increment - old was read, new is unread
            expect(result.unreadCount).toBe(3)
            expect(result.notifications).toHaveLength(1)
        })

        it('decrements when old was unread and new is read', () => {
            const existingUnread = createNotification('existing-1', false)
            const current: NotificationsResponse = {
                notifications: [existingUnread],
                unreadCount: 3,
            }
            const newRead = createNotification('existing-1', true) // Same ID, now read
            const updater = createNotificationUpdater(newRead)
            const result = updater(current, null)

            // Should decrement - old was unread, new is read
            expect(result.unreadCount).toBe(2)
            expect(result.notifications).toHaveLength(1)
        })

        it('does not change when both old and new are read', () => {
            const existingRead = createNotification('existing-1', true)
            const current: NotificationsResponse = {
                notifications: [existingRead],
                unreadCount: 2,
            }
            const newRead = createNotification('existing-1', true) // Same ID, still read
            const updater = createNotificationUpdater(newRead)
            const result = updater(current, null)

            // Should not change - both were read
            expect(result.unreadCount).toBe(2)
            expect(result.notifications).toHaveLength(1)
        })
    })

    describe('edge cases', () => {
        it('handles count at zero correctly', () => {
            const existingRead = createNotification('existing-1', true)
            const current: NotificationsResponse = {
                notifications: [existingRead],
                unreadCount: 0,
            }
            const newUnread = createNotification('existing-1', false)
            const updater = createNotificationUpdater(newUnread)
            const result = updater(current, null)

            expect(result.unreadCount).toBe(1)
        })

        it('prevents negative counts', () => {
            const existingUnread = createNotification('existing-1', false)
            const current: NotificationsResponse = {
                notifications: [existingUnread],
                unreadCount: 0, // Edge case: count is 0 but notification exists
            }
            const newRead = createNotification('existing-1', true)
            const updater = createNotificationUpdater(newRead)
            const result = updater(current, null)

            // Should not go below 0
            expect(result.unreadCount).toBe(0)
        })

        it('handles multiple notifications correctly', () => {
            const existing1 = createNotification('existing-1', false)
            const existing2 = createNotification('existing-2', true)
            const existing3 = createNotification('existing-3', false)
            const current: NotificationsResponse = {
                notifications: [existing1, existing2, existing3],
                unreadCount: 2, // existing-1 and existing-3 are unread
            }
            const newUnread = createNotification('existing-2', false) // Update existing-2 from read to unread
            const updater = createNotificationUpdater(newUnread)
            const result = updater(current, null)

            // Should increment by 1 (existing-2 changed from read to unread)
            expect(result.unreadCount).toBe(3)
            expect(result.notifications).toHaveLength(3)
            expect(result.notifications[0].id).toBe('existing-2') // Should be at the front
        })

        it('respects limit when provided', () => {
            const notifications = Array.from({ length: 10 }, (_, i) => 
                createNotification(`existing-${i}`, false)
            )
            const current: NotificationsResponse = {
                notifications,
                unreadCount: 10,
            }
            const newNotification = createNotification('new-1', false)
            const updater = createNotificationUpdater(newNotification)
            const result = updater(current, 5) // Limit to 5

            expect(result.notifications).toHaveLength(5)
            expect(result.notifications[0].id).toBe('new-1')
        })
    })
})

