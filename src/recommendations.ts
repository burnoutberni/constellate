import { Hono } from 'hono'
import { requireAuth } from './middleware/auth.js'
import { lenientRateLimit } from './middleware/rateLimit.js'
import { AppError } from './lib/errors.js'
import { getEventRecommendations } from './services/recommendations.js'

type JsonStatusCode = 200 | 201 | 400 | 401 | 403 | 404 | 409 | 429 | 500

const app = new Hono()

function parseLimit(value?: string | null) {
    if (!value) {
        return undefined
    }

    const parsed = Number.parseInt(value, 10)
    if (Number.isNaN(parsed)) {
        return undefined
    }

    return Math.max(1, Math.min(parsed, 20))
}

app.get('/', lenientRateLimit, async (c) => {
    try {
        const userId = requireAuth(c)
        const limit = parseLimit(c.req.query('limit'))

        const result = await getEventRecommendations(userId, limit)

        return c.json(result)
    } catch (error) {
        if (error instanceof AppError) {
            return c.json(
                { error: error.code, message: error.message },
                error.statusCode as JsonStatusCode
            )
        }
        console.error('Error getting recommendations:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

export default app
