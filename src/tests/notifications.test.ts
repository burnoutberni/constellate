import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { NotificationType } from '@prisma/client'
import notificationsApp from '../notifications.js'
import {
    createNotification,
    listNotifications,
    markNotificationAsRead,
    markAllNotificationsRead,
} from '../services/notifications.js'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { broadcastToUser } from '../realtime.js'
import { AppError } from '../lib/errors.js'

vi.mock('../realtime.js', () => ({
    broadcastToUser: vi.fn().mockResolvedValue(undefined),
    BroadcastEvents: {
        NOTIFICATION_CREATED: 'notification:created',
        NOTIFICATION_READ: 'notification:read',
    },
}))

vi.mock('../middleware/auth.js', () => ({
    requireAuth: vi.fn(),
}))

const app = new Hono()
app.route('/api/notifications', notificationsApp)

const SYSTEM_TYPE = 'SYSTEM' as NotificationType

describe('Notification service and API', () => {
    beforeEach(async () => {
        vi.clearAllMocks()
        await prisma.notification.deleteMany()
        vi.mocked(requireAuth).mockReturnValue('user_123')
    })

    it('creates notifications with sanitized content and broadcasts SSE', async () => {
        const notification = await createNotification({
            userId: 'user_123',
            actorId: 'user_456',
            type: SYSTEM_TYPE,
            title: '<b>Welcome</b>',
            body: '<script>alert(1)</script>See you soon',
            data: { foo: 'bar' },
        })

        expect(notification.title).toBe('Welcome')
        expect(notification.body).toBe('See you soon')
        expect(broadcastToUser).toHaveBeenCalledWith(
            'user_123',
            expect.objectContaining({ type: 'notification:created' })
        )
    })

    it('lists notifications with unread count', async () => {
        await createNotification({
            userId: 'user_123',
            type: SYSTEM_TYPE,
            title: 'First',
        })
        const second = await createNotification({
            userId: 'user_123',
            type: SYSTEM_TYPE,
            title: 'Second',
        })

        await markNotificationAsRead('user_123', second.id)

        const response = await app.request('/api/notifications?limit=5')
        const body = await response.json() as { notifications: any[]; unreadCount: number }

        expect(response.status).toBe(200)
        expect(body.notifications).toHaveLength(2)
        expect(body.unreadCount).toBe(1)
    })

    it('marks notifications as read through the API', async () => {
        const notification = await createNotification({
            userId: 'user_123',
            type: SYSTEM_TYPE,
            title: 'Mark me',
        })

        const response = await app.request(`/api/notifications/${notification.id}/read`, {
            method: 'POST',
        })
        const body = await response.json() as { notification: { read: boolean; readAt: string | null } }

        expect(response.status).toBe(200)
        expect(body.notification.read).toBe(true)
        expect(body.notification.readAt).toBeTruthy()

        const stored = await prisma.notification.findUnique({ where: { id: notification.id } })
        expect(stored?.read).toBe(true)
    })

    it('does not allow marking other users notifications as read', async () => {
        const otherNotification = await createNotification({
            userId: 'user_other',
            type: SYSTEM_TYPE,
            title: 'Private',
        })

        const response = await app.request(`/api/notifications/${otherNotification.id}/read`, {
            method: 'POST',
        })

        expect(response.status).toBe(404)
    })

    it('marks all notifications as read', async () => {
        await createNotification({ userId: 'user_123', type: SYSTEM_TYPE, title: 'One' })
        await createNotification({ userId: 'user_123', type: SYSTEM_TYPE, title: 'Two' })

        const response = await app.request('/api/notifications/mark-all-read', {
            method: 'POST',
        })
        const body = await response.json() as { updated: number; unreadCount: number }

        expect(response.status).toBe(200)
        expect(body.updated).toBe(2)
        expect(body.unreadCount).toBe(0)

        const unread = await prisma.notification.count({
            where: { userId: 'user_123', read: false },
        })
        expect(unread).toBe(0)
    })

    it('returns 401 when authentication fails', async () => {
        vi.mocked(requireAuth).mockImplementation(() => {
            throw new AppError('UNAUTHORIZED', 'Authentication required', 401)
        })

        const response = await app.request('/api/notifications')
        expect(response.status).toBe(401)
    })

    it('lists notifications through the service layer respecting limits', async () => {
        for (let i = 0; i < 5; i++) {
            await createNotification({ userId: 'user_123', type: SYSTEM_TYPE, title: `n-${i}` })
        }

        const items = await listNotifications('user_123', 2)
        expect(items).toHaveLength(2)
        expect(items[0].createdAt.getTime()).toBeGreaterThanOrEqual(items[1].createdAt.getTime())
    })

    it('marks notifications as read via service helper', async () => {
        const notification = await createNotification({ userId: 'user_123', type: SYSTEM_TYPE, title: 'service-read' })

        const updated = await markNotificationAsRead('user_123', notification.id)
        expect(updated?.read).toBe(true)

        const missing = await markNotificationAsRead('user_123', 'unknown')
        expect(missing).toBeNull()
    })

    it('marks all notifications via service helper', async () => {
        await createNotification({ userId: 'user_123', type: SYSTEM_TYPE, title: 'bulk-1' })
        await createNotification({ userId: 'user_123', type: SYSTEM_TYPE, title: 'bulk-2' })

        const updatedCount = await markAllNotificationsRead('user_123')
        expect(updatedCount).toBe(2)
    })
})
