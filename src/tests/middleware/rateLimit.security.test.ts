import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Context } from 'hono'
import { rateLimit } from '../../middleware/rateLimit.js'
import { Errors } from '../../lib/errors.js'

describe('Rate Limit Security', () => {
	let mockContext: Context
	let mockNext: () => Promise<void>
	let mockRequest: any
	// We'll use a new unique IP for each test to avoid interference from shared state
	let testId = 0

	beforeEach(() => {
		testId++
		mockNext = vi.fn().mockResolvedValue(undefined)
		mockRequest = {
			header: vi.fn(),
		}
		mockContext = {
			req: mockRequest,
			get: vi.fn(),
			header: vi.fn(),
			res: { status: 200 },
		} as unknown as Context
	})

	it('should use the LAST IP in X-Forwarded-For to prevent spoofing', async () => {
		// Scenario:
		// Attacker IP: 1.2.3.4
		// Attacker sends header: "X-Forwarded-For: 8.8.8.8" (Spoofing Google DNS)
		// Trusted Proxy (Caddy) appends real IP: "8.8.8.8, 1.2.3.4"

		const attackerIp = `1.2.3.4-${testId}`
		const spoofedIp = `8.8.8.8-${testId}`

		// 1. Setup rate limiter allowing 1 request
		const middleware = rateLimit({
			windowMs: 1000,
			maxRequests: 1,
			// Ensure we are using IP-based limiting
			keyGenerator: undefined
		})

		// Mock Context: No user logged in
		mockContext.get = vi.fn().mockReturnValue(undefined)

		// 2. Attacker makes request 1 (Success)
		// Header seen by app: "spoofed-ip, real-ip"
		mockRequest.header.mockImplementation((name: string) => {
			if (name === 'x-forwarded-for') return `${spoofedIp}, ${attackerIp}`
			return undefined
		})

		await middleware(mockContext, mockNext)
		expect(mockNext).toHaveBeenCalledTimes(1)

		// 3. Attacker makes request 2 (Should Fail due to limit on attackerIp)
		await expect(middleware(mockContext, mockNext)).rejects.toThrow(Errors.tooManyRequests('').constructor)

		// 4. Innocent user (using the IP that was attempted to be spoofed) makes request
		// If the system was vulnerable, it would have banned spoofedIp instead of attackerIp.
		// So innocent user would be blocked.
		// Real scenario:
		// Innocent User IP: 8.8.8.8
		// Header: "8.8.8.8" (or added by proxy)

		const innocentIp = spoofedIp
		const innocentContext = { ...mockContext } as unknown as Context
		const innocentRequest = { header: vi.fn() }
		innocentContext.req = innocentRequest as any
		innocentContext.header = vi.fn()

		innocentRequest.header.mockImplementation((name: string) => {
			if (name === 'x-forwarded-for') return innocentIp
			return undefined
		})

		// Should SUCCESS (because the ban should be on attackerIp, not spoofedIp)
		// If vulnerability exists: this will fail (because we banned spoofedIp)
		await middleware(innocentContext, mockNext)
	})
})
