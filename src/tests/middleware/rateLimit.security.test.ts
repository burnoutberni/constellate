import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { rateLimit } from '../../middleware/rateLimit.js'
import { handleError } from '../../lib/errors.js'

describe('Rate Limit Security', () => {
	it('should prevent rate limit bypass via X-Forwarded-For spoofing', async () => {
		const app = new Hono()
		app.onError(handleError)

		// Configure strict rate limit: 2 requests per window
		app.use(
			'*',
			rateLimit({
				windowMs: 15 * 60 * 1000,
				maxRequests: 2,
				keyGenerator: undefined, // Use default IP-based key
			})
		)

		app.get('/', (c) => c.text('ok'))

		const realIp = '203.0.113.5'
		const spoofedIp1 = '198.51.100.1'
		const spoofedIp2 = '198.51.100.2'
		const spoofedIp3 = '198.51.100.3'

		// Request 1: Allow
		const res1 = await app.request('/', {
			headers: {
				'X-Forwarded-For': `${spoofedIp1}, ${realIp}`,
			},
		})
		expect(res1.status).toBe(200)

		// Request 2: Allow
		const res2 = await app.request('/', {
			headers: {
				'X-Forwarded-For': `${spoofedIp2}, ${realIp}`,
			},
		})
		expect(res2.status).toBe(200)

		// Request 3: Should trigger rate limit because real IP is the same
		// BUT currently it fails (vulnerability exists) because it uses the first IP (spoofed)
		const res3 = await app.request('/', {
			headers: {
				'X-Forwarded-For': `${spoofedIp3}, ${realIp}`,
			},
		})

		// ----------------------------------------------------------------
		// SECURITY FIX VERIFICATION
		// With the fix, the rate limiter should see the REAL IP (which is constant)
		// and ignore the spoofed IP.
		// Since we've made 2 requests from this real IP already, the 3rd request
		// should be blocked (429 Too Many Requests).
		// ----------------------------------------------------------------
		expect(res3.status).toBe(429)
	})
})
