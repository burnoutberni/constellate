import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Context } from 'hono'
import { strictRateLimit, moderateRateLimit, lenientRateLimit } from '../../middleware/rateLimit.js'
import { Errors } from '../../lib/errors.js'

describe('Rate Limiting Collision', () => {
	let mockContext: Context
	let mockNext: () => Promise<void>
	let mockRequest: any
	let uniqueIp: string
	let testCounter = 0

	beforeEach(() => {
		testCounter++
		uniqueIp = `127.0.0.${testCounter}`

		mockNext = vi.fn().mockResolvedValue(undefined)

		mockRequest = {
			header: vi.fn(),
		}

		mockContext = {
			req: mockRequest,
			get: vi.fn(),
			header: vi.fn(),
			res: {
				status: 200,
			},
		} as unknown as Context

		mockRequest.header.mockImplementation((name: string) => {
			if (name === 'x-forwarded-for') return uniqueIp
			return undefined
		})
	})

	it('should NOT show collision between different rate limiters', async () => {
		// 1. Hit lenient endpoint 10 times (limit 200)
		for (let i = 0; i < 10; i++) {
			await lenientRateLimit(mockContext, mockNext)
		}

		// 2. Try to hit strict endpoint (limit 10)
		// With fix, they use different keys, so strict count starts at 0.
		// It should NOT throw.
		await expect(strictRateLimit(mockContext, mockNext)).resolves.not.toThrow()
	})

	it('should still enforce limits independently', async () => {
		// 1. Hit lenient endpoint 10 times (limit 200) - consume some quota
		for (let i = 0; i < 10; i++) {
			await lenientRateLimit(mockContext, mockNext)
		}

		// 2. Hit strict endpoint 10 times (limit 10) - consume full strict quota
		for (let i = 0; i < 10; i++) {
			await strictRateLimit(mockContext, mockNext)
		}

		// 3. 11th strict request should fail
		await expect(strictRateLimit(mockContext, mockNext)).rejects.toThrow()

		// 4. Lenient endpoint should still be available (only 10/200 used)
		await expect(lenientRateLimit(mockContext, mockNext)).resolves.not.toThrow()
	})
})
