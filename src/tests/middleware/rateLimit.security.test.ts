import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Context } from 'hono'
import { rateLimit } from '../../middleware/rateLimit.js'
import { Errors } from '../../lib/errors.js'

let testCounter = 0

describe('Rate Limiting Security', () => {
	let mockContext: Context
	let mockNext: () => Promise<void>
	let mockRequest: any
	let realIp: string

	beforeEach(() => {
		testCounter++
		realIp = `203.0.113.${testCounter}` // distinct real IP per test run

		mockNext = vi.fn().mockResolvedValue(undefined)
		mockRequest = {
			header: vi.fn(),
		}

		mockContext = {
			req: mockRequest,
			get: vi.fn(), // user not logged in
			header: vi.fn(),
			res: {
				status: 200,
			},
		} as unknown as Context
	})

	it('should prevent bypass via X-Forwarded-For spoofing', async () => {
		// Limit to 1 request
		const middleware = rateLimit({ windowMs: 60000, maxRequests: 1 })

		// Attack scenario: Attacker is at realIp.
		// They send requests with different spoofed IPs at the start of X-Forwarded-For.
		// The proxy appends the realIp at the end.

		// Request 1: Spoofed IP 1
		mockRequest.header.mockImplementation((name: string) => {
			if (name === 'x-forwarded-for') return `1.2.3.4, ${realIp}`
			return undefined
		})

		await middleware(mockContext, mockNext)
		expect(mockNext).toHaveBeenCalledTimes(1)

		// Request 2: Spoofed IP 2
		mockRequest.header.mockImplementation((name: string) => {
			if (name === 'x-forwarded-for') return `5.6.7.8, ${realIp}`
			return undefined
		})

		// If vulnerable, this will pass because "5.6.7.8" != "1.2.3.4"
		// If secure, this should fail because realIp is the same
		try {
			await middleware(mockContext, mockNext)
            // If we reach here, the vulnerability exists (or test failed to catch it)
		} catch (error: any) {
			expect(error).toBeInstanceOf(Errors.tooManyRequests('').constructor)
            return; // Test passed (security behavior confirmed)
		}

        // Fail if no error was thrown
        expect.fail('Rate limit was bypassed using X-Forwarded-For spoofing')
	})
})
