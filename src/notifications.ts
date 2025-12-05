import { Hono } from 'hono'
import { requireAuth } from './middleware/auth.js'
import { moderateRateLimit } from './middleware/rateLimit.js'
import { AppError } from './lib/errors.js'
import {
    listNotifications,
    getUnreadNotificationCount,
    serializeNotification,
    markNotificationAsRead,
    markAllNotificationsRead,
} from './services/notifications.js'

type JsonStatusCode = 200 | 201 | 400 | 401 | 403 | 404 | 409 | 429 | 500

const app = new Hono()

function parseLimit(value?: string | null) {
    if (!value) {
        return 20
    }

    const parsed = Number.parseInt(value, 10)
    if (Number.isNaN(parsed)) {
        return 20
    }

    return Math.max(1, Math.min(parsed, 100))
}

app.get('/', async (c) => {
    try {
        const userId = requireAuth(c)
        const limit = parseLimit(c.req.query('limit'))

        const [notifications, unreadCount] = await Promise.all([
            listNotifications(userId, limit),
            getUnreadNotificationCount(userId),
        ])

        return c.json({
            notifications: notifications.map(serializeNotification),
            unreadCount,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return c.json(
                { error: error.code, message: error.message },
                error.statusCode as JsonStatusCode
            )
        }
        console.error('Error listing notifications:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

app.post('/:notificationId/read', moderateRateLimit, async (c) => {
    try {
        const userId = requireAuth(c)
        const { notificationId } = c.req.param()

        const notification = await markNotificationAsRead(userId, notificationId)
        if (!notification) {
            return c.json({ error: 'Notification not found' }, 404)
        }

        return c.json({ notification: serializeNotification(notification) })
    } catch (error) {
        if (error instanceof AppError) {
            return c.json(
                { error: error.code, message: error.message },
                error.statusCode as JsonStatusCode
            )
        }
        console.error('Error marking notification as read:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

app.post('/mark-all-read', moderateRateLimit, async (c) => {
    try {
        const userId = requireAuth(c)
        const updated = await markAllNotificationsRead(userId)
        const unreadCount = await getUnreadNotificationCount(userId)

        return c.json({ updated, unreadCount })
    } catch (error) {
        if (error instanceof AppError) {
            return c.json(
                { error: error.code, message: error.message },
                error.statusCode as JsonStatusCode
            )
        }
        console.error('Error marking notifications as read:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

export default app
