import { Hono } from 'hono'
import { requireAuth } from './middleware/auth.js'
import { lenientRateLimit } from './middleware/rateLimit.js'
import { getEventRecommendations } from './services/recommendations.js'
import { AppError } from './lib/errors.js'

const app = new Hono()

app.get('/', lenientRateLimit, async (c) => {
    try {
        const userId = requireAuth(c)
        const limitParam = c.req.query('limit')
        const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined

        const payload = await getEventRecommendations(userId, Number.isNaN(limit) ? undefined : limit)

        return c.json(payload)
    } catch (error) {
        if (error instanceof AppError) {
            return c.json(
                { error: error.code, message: error.message },
                error.statusCode as 200 | 201 | 400 | 401 | 403 | 404 | 409 | 429 | 500
            )
        }
        console.error('Error generating recommendations:', error)
        return c.json({ error: 'INTERNAL_ERROR', message: 'Unable to generate recommendations' }, 500 as const)
    }
})

export default app
