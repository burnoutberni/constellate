import { Hono } from 'hono'
import { z, ZodError } from 'zod'
import { lenientRateLimit } from './middleware/rateLimit.js'
import { config } from './config.js'

const app = new Hono()

app.use('*', lenientRateLimit)

const LocationSearchSchema = z.object({
    q: z.string().min(2).max(200),
    limit: z.string().optional(),
})

const NominatimResultSchema = z.object({
    place_id: z.number(),
    display_name: z.string(),
    lat: z.string(),
    lon: z.string(),
    type: z.string().optional(),
    class: z.string().optional(),
    importance: z.number().optional(),
    address: z.record(z.string(), z.string()).optional(),
})

const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search'

const pickAddressLine = (address: Record<string, string> | undefined): string | undefined => {
    if (!address) {
        return undefined
    }
    return (
        address.city ||
        address.town ||
        address.village ||
        address.county ||
        address.state ||
        address.country
    )
}

app.get('/search', async (c) => {
    try {
        const parsed = LocationSearchSchema.parse({
            q: c.req.query('q'),
            limit: c.req.query('limit'),
        })

        const limit = Math.max(1, Math.min(parseInt(parsed.limit || '5', 10) || 5, 10))

        const url = new URL(NOMINATIM_ENDPOINT)
        url.searchParams.set('q', parsed.q)
        url.searchParams.set('format', 'jsonv2')
        url.searchParams.set('addressdetails', '1')
        url.searchParams.set('limit', limit.toString())
        url.searchParams.set('namedetails', '0')
        url.searchParams.set('extratags', '0')

        const response = await fetch(url.toString(), {
            headers: {
                'User-Agent': config.locationSearch.userAgent,
            },
        })

        if (!response.ok) {
            const message = response.status === 429
                ? 'Location provider rate limit exceeded'
                : 'Unable to resolve location'
            const statusCode = response.status === 429 ? 429 : 500
            return c.json({ error: message }, statusCode)
        }

        const body = await response.json()
        let results
        try {
            results = z.array(NominatimResultSchema).parse(body)
        } catch (parseError) {
            // Invalid response schema from Nominatim - treat as server error
            console.error('Invalid response schema from Nominatim:', parseError)
            return c.json({ error: 'Unable to resolve location' }, 500)
        }

        return c.json({
            query: parsed.q,
            results: results.map((result) => ({
                id: String(result.place_id),
                label: result.display_name,
                latitude: parseFloat(result.lat),
                longitude: parseFloat(result.lon),
                importance: result.importance ?? null,
                type: result.type,
                class: result.class,
                hint: pickAddressLine(result.address),
            })).filter((res) => Number.isFinite(res.latitude) && Number.isFinite(res.longitude)),
        })
    } catch (error) {
        if (error instanceof ZodError) {
            return c.json({ error: 'Invalid location search parameters', details: error.issues }, 400 as const)
        }
        console.error('Error performing location search:', error)
        return c.json({ error: 'Unable to resolve location' }, 500)
    }
})

export default app
