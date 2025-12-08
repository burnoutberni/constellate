import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { config } from 'dotenv'
config()
import { app } from '../server.js'

describe('Location Search API', () => {
    const originalFetch = global.fetch

    beforeEach(() => {
        global.fetch = vi.fn()
    })

    afterEach(() => {
        global.fetch = originalFetch
        vi.restoreAllMocks()
    })

    it('should return location search results for valid query', async () => {
        const mockNominatimResponse = [
            {
                place_id: 12345,
                display_name: 'New York, NY, USA',
                lat: '40.7128',
                lon: '-74.0060',
                type: 'city',
                class: 'place',
                importance: 0.9,
                address: {
                    city: 'New York',
                    state: 'NY',
                    country: 'USA',
                },
            },
            {
                place_id: 67890,
                display_name: 'New York Mills, MN, USA',
                lat: '46.5181',
                lon: '-95.3764',
                type: 'city',
                class: 'place',
                importance: 0.5,
                address: {
                    city: 'New York Mills',
                    state: 'MN',
                    country: 'USA',
                },
            },
        ]

        vi.mocked(global.fetch).mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => mockNominatimResponse,
        } as Response)

        const res = await app.request('/api/location/search?q=New York&limit=5')
        expect(res.status).toBe(200)
        const body = await res.json() as { query: string; results: Array<{ id: string; label: string; latitude: number; longitude: number; importance: number | null; type?: string; class?: string; hint?: string }> }
        expect(body.query).toBe('New York')
        expect(body.results).toBeDefined()
        expect(Array.isArray(body.results)).toBe(true)
        expect(body.results.length).toBe(2)
        expect(body.results[0]).toMatchObject({
            id: '12345',
            label: 'New York, NY, USA',
            latitude: 40.7128,
            longitude: -74.0060,
            importance: 0.9,
            type: 'city',
            class: 'place',
            hint: 'New York',
        })
    })

    it('should validate query length (min 2 characters)', async () => {
        const res = await app.request('/api/location/search?q=A')
        expect(res.status).toBe(400)
        const body = await res.json() as { error: string; details?: unknown }
        expect(body.error).toBeDefined()
        expect(body.details).toBeDefined()
    })

    it('should validate query length (max 200 characters)', async () => {
        const longQuery = 'A'.repeat(201)
        const res = await app.request(`/api/location/search?q=${encodeURIComponent(longQuery)}`)
        expect(res.status).toBe(400)
        const body = await res.json() as { error: string; details?: unknown }
        expect(body.error).toBeDefined()
        expect(body.details).toBeDefined()
    })

    it('should validate limit parameter and default to 5', async () => {
        const mockNominatimResponse = [
            {
                place_id: 1,
                display_name: 'Test Location',
                lat: '40.7128',
                lon: '-74.0060',
            },
        ]

        vi.mocked(global.fetch).mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => mockNominatimResponse,
        } as Response)

        const res = await app.request('/api/location/search?q=test')
        expect(res.status).toBe(200)
        const fetchCall = vi.mocked(global.fetch).mock.calls[0][0] as string
        const url = new URL(fetchCall)
        expect(url.searchParams.get('limit')).toBe('5')
    })

    it('should enforce limit maximum of 10', async () => {
        const mockNominatimResponse = [
            {
                place_id: 1,
                display_name: 'Test Location',
                lat: '40.7128',
                lon: '-74.0060',
            },
        ]

        vi.mocked(global.fetch).mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => mockNominatimResponse,
        } as Response)

        const res = await app.request('/api/location/search?q=test&limit=20')
        expect(res.status).toBe(200)
        const fetchCall = vi.mocked(global.fetch).mock.calls[0][0] as string
        const url = new URL(fetchCall)
        const limit = parseInt(url.searchParams.get('limit') || '5', 10)
        expect(limit).toBeLessThanOrEqual(10)
    })

    it('should enforce limit minimum of 1', async () => {
        const mockNominatimResponse = [
            {
                place_id: 1,
                display_name: 'Test Location',
                lat: '40.7128',
                lon: '-74.0060',
            },
        ]

        vi.mocked(global.fetch).mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => mockNominatimResponse,
        } as Response)

        const res = await app.request('/api/location/search?q=test&limit=0')
        expect(res.status).toBe(200)
        const fetchCall = vi.mocked(global.fetch).mock.calls[0][0] as string
        const url = new URL(fetchCall)
        const limit = parseInt(url.searchParams.get('limit') || '5', 10)
        expect(limit).toBeGreaterThanOrEqual(1)
    })

    it('should handle rate limit errors (429)', async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce({
            ok: false,
            status: 429,
        } as Response)

        const res = await app.request('/api/location/search?q=test')
        expect(res.status).toBe(429)
        const body = await res.json() as { error: string }
        expect(body.error).toBe('Location provider rate limit exceeded')
    })

    it('should handle other HTTP error status codes', async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce({
            ok: false,
            status: 500,
        } as Response)

        const res = await app.request('/api/location/search?q=test')
        expect(res.status).toBe(500)
        const body = await res.json() as { error: string }
        expect(body.error).toBe('Unable to resolve location')
    })

    it('should handle 403 Forbidden status', async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce({
            ok: false,
            status: 403,
        } as Response)

        const res = await app.request('/api/location/search?q=test')
        expect(res.status).toBe(500)
        const body = await res.json() as { error: string }
        expect(body.error).toBe('Unable to resolve location')
    })

    it('should filter out invalid coordinates', async () => {
        const mockNominatimResponse = [
            {
                place_id: 1,
                display_name: 'Valid Location',
                lat: '40.7128',
                lon: '-74.0060',
            },
            {
                place_id: 2,
                display_name: 'Invalid Location',
                lat: 'invalid',
                lon: 'invalid',
            },
            {
                place_id: 3,
                display_name: 'Another Valid Location',
                lat: '34.0522',
                lon: '-118.2437',
            },
        ]

        vi.mocked(global.fetch).mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => mockNominatimResponse,
        } as Response)

        const res = await app.request('/api/location/search?q=test')
        expect(res.status).toBe(200)
        const body = await res.json() as { query: string; results: Array<{ latitude: number; longitude: number }> }
        expect(body.results.length).toBe(2)
        expect(body.results.every((r: { latitude: number; longitude: number }) =>
            Number.isFinite(r.latitude) && Number.isFinite(r.longitude)
        )).toBe(true)
    })

    it('should handle invalid JSON response from Nominatim', async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => { throw new Error('Invalid JSON') },
        } as unknown as Response)

        const res = await app.request('/api/location/search?q=test')
        expect(res.status).toBe(500)
        const body = await res.json() as { error: string }
        expect(body.error).toBe('Unable to resolve location')
    })

    it('should handle invalid response schema from Nominatim', async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => [{ invalid: 'data' }],
        } as Response)

        const res = await app.request('/api/location/search?q=test')
        expect(res.status).toBe(500)
        const body = await res.json() as { error: string }
        expect(body.error).toBe('Unable to resolve location')
    })

    it('should include hint from address when available', async () => {
        const mockNominatimResponse = [
            {
                place_id: 1,
                display_name: 'Central Park, New York, NY, USA',
                lat: '40.7829',
                lon: '-73.9654',
                address: {
                    city: 'New York',
                    state: 'NY',
                },
            },
        ]

        vi.mocked(global.fetch).mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => mockNominatimResponse,
        } as Response)

        const res = await app.request('/api/location/search?q=Central Park')
        expect(res.status).toBe(200)
        const body = await res.json() as { query: string; results: Array<{ hint?: string }> }
        expect(body.results[0].hint).toBe('New York')
    })

    it('should handle missing address gracefully', async () => {
        const mockNominatimResponse = [
            {
                place_id: 1,
                display_name: 'Some Location',
                lat: '40.7128',
                lon: '-74.0060',
            },
        ]

        vi.mocked(global.fetch).mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => mockNominatimResponse,
        } as Response)

        const res = await app.request('/api/location/search?q=test')
        expect(res.status).toBe(200)
        const body = await res.json() as { query: string; results: Array<{ hint?: string }> }
        expect(body.results[0].hint).toBeUndefined()
    })
})
