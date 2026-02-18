import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Context } from 'hono'
import { rateLimit } from '../../middleware/rateLimit.js'
import { Errors } from '../../lib/errors.js'

describe('Rate Limiting Security', () => {
	let mockContext: Context
	let mockNext: () => Promise<void>
	let mockRequest: any
	let realIp: string
	let spoofedIp: string

	beforeEach(() => {
		realIp = '203.0.113.1' // Example real IP
		spoofedIp = '198.51.100.1' // Example spoofed IP
		mockNext = vi.fn().mockResolvedValue(undefined)

		mockRequest = {
			header: vi.fn(),
		}

		mockContext = {
			req: mockRequest,
			get: vi.fn(), // No user ID
			header: vi.fn(),
			res: {
				status: 200,
			},
		} as unknown as Context
	})

	it('SECURITY: uses last IP in X-Forwarded-For (trusted proxy appended IP) to prevent spoofing', async () => {
		// Set a low limit
		const middleware = rateLimit({ windowMs: 1000, maxRequests: 1 })

		// Request 1: Spoofed IP 1
		mockRequest.header.mockImplementation((name: string) => {
			if (name === 'x-forwarded-for') return `${spoofedIp}, ${realIp}`
			return undefined
		})

		await middleware(mockContext, mockNext)
		expect(mockNext).toHaveBeenCalledTimes(1)

		// Request 2: Different Spoofed IP, SAME Real IP
		// If insecure, this will be counted as a new user and allowed
		// If secure (using real IP), this should be blocked
		const spoofedIp2 = '198.51.100.2'
		mockRequest.header.mockImplementation((name: string) => {
			if (name === 'x-forwarded-for') return `${spoofedIp2}, ${realIp}`
			return undefined
		})

		// This should be blocked because the real IP is the same
		await expect(middleware(mockContext, mockNext)).rejects.toThrow()

		expect(mockNext).toHaveBeenCalledTimes(1)
	})
})
