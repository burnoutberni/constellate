import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Context } from 'hono'
import {
	strictRateLimit,
	lenientRateLimit,
} from '../../middleware/rateLimit.js'
import { Errors } from '../../lib/errors.js'

let testCounter = 1000

describe('Rate Limiting Scope Issue Reproduction', () => {
	let mockContext: Context
	let mockNext: () => Promise<void>
	let mockRequest: any
	let uniqueIp: string

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

	it('should confirm that lenient requests consume strict quota', async () => {
		// 1. Make 15 requests using lenient limiter (max 200)
		// This should be allowed
		for (let i = 0; i < 15; i++) {
			await lenientRateLimit(mockContext, mockNext)
		}

		// 2. Try to make a request using strict limiter (max 10)
		// Since count is shared and is now 15, strict limiter sees 15 >= 10 and blocks
		// If independent, it would see 0 (or 1) < 10.

		try {
			await strictRateLimit(mockContext, mockNext)
            // If we reach here, it means they are independent (or issue not reproduced)
            // But we expect it to fail if the issue exists
		} catch (error: any) {
			expect(error).toBeInstanceOf(Errors.tooManyRequests('').constructor)
            return
		}

        throw new Error('Expected strictRateLimit to throw because of shared state with lenientRateLimit')
	})
})
