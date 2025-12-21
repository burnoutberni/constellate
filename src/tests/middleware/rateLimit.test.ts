import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Context } from 'hono'
import {
	rateLimit,
	strictRateLimit,
	moderateRateLimit,
	lenientRateLimit,
} from '../../middleware/rateLimit.js'
import { Errors } from '../../lib/errors.js'

// Access the rate limit store to clear it between tests
// We'll need to import the module and access its internal store
let testCounter = 0

describe('Rate Limiting Middleware', () => {
	let mockContext: Context
	let mockNext: () => Promise<void>
	let mockRequest: any
	let uniqueIp: string

	beforeEach(() => {
		// Use unique IP for each test to avoid interference
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
	})

	describe('rateLimit', () => {
		it('should allow requests within limit', async () => {
			const middleware = rateLimit({ windowMs: 1000, maxRequests: 5 })

			// Make 5 requests (within limit)
			for (let i = 0; i < 5; i++) {
				mockRequest.header.mockImplementation((name: string) => {
					if (name === 'x-forwarded-for') return uniqueIp
					return undefined
				})

				await middleware(mockContext, mockNext)
			}

			expect(mockNext).toHaveBeenCalledTimes(5)
		})

		it('should block requests exceeding limit', async () => {
			const middleware = rateLimit({ windowMs: 1000, maxRequests: 2 })

			mockRequest.header.mockImplementation((name: string) => {
				if (name === 'x-forwarded-for') return uniqueIp
				return undefined
			})

			// Make 2 requests (within limit)
			await middleware(mockContext, mockNext)
			await middleware(mockContext, mockNext)

			// Third request should be blocked
			await expect(middleware(mockContext, mockNext)).rejects.toThrow()

			// Verify it's the correct error type
			try {
				await middleware(mockContext, mockNext)
				expect.fail('Should have thrown')
			} catch (error: any) {
				expect(error).toBeInstanceOf(Errors.tooManyRequests('').constructor)
			}

			expect(mockNext).toHaveBeenCalledTimes(2)
		})

		it('should set rate limit headers', async () => {
			const middleware = rateLimit({ windowMs: 1000, maxRequests: 10 })

			mockRequest.header.mockImplementation((name: string) => {
				if (name === 'x-forwarded-for') return uniqueIp
				return undefined
			})

			await middleware(mockContext, mockNext)

			expect(mockContext.header).toHaveBeenCalledWith('X-RateLimit-Limit', '10')
			expect(mockContext.header).toHaveBeenCalledWith(
				'X-RateLimit-Remaining',
				expect.any(String)
			)
			expect(mockContext.header).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String))
		})

		it('should use IP address for anonymous users', async () => {
			const middleware = rateLimit({ windowMs: 1000, maxRequests: 5 })

			mockRequest.header.mockImplementation((name: string) => {
				if (name === 'x-forwarded-for') return '192.168.1.1'
				return undefined
			})
			mockContext.get = vi.fn().mockReturnValue(undefined) // No user ID

			await middleware(mockContext, mockNext)

			expect(mockContext.get).toHaveBeenCalledWith('userId')
		})

		it('should use user ID for authenticated users', async () => {
			const middleware = rateLimit({ windowMs: 1000, maxRequests: 5 })

			mockContext.get = vi.fn().mockReturnValue('user_123')

			await middleware(mockContext, mockNext)

			expect(mockContext.get).toHaveBeenCalledWith('userId')
		})

		it('should use custom key generator when provided', async () => {
			const customKeyGenerator = vi.fn().mockReturnValue('custom-key')
			const middleware = rateLimit({
				windowMs: 1000,
				maxRequests: 5,
				keyGenerator: customKeyGenerator,
			})

			await middleware(mockContext, mockNext)

			expect(customKeyGenerator).toHaveBeenCalledWith(mockContext)
		})

		it('should use x-real-ip when x-forwarded-for is not available', async () => {
			const middleware = rateLimit({ windowMs: 1000, maxRequests: 5 })

			mockRequest.header.mockImplementation((name: string) => {
				if (name === 'x-real-ip') return uniqueIp
				return undefined
			})
			mockContext.get = vi.fn().mockReturnValue(undefined)

			await middleware(mockContext, mockNext)

			expect(mockNext).toHaveBeenCalled()
		})

		it('should use "unknown" when no IP headers are available', async () => {
			const middleware = rateLimit({ windowMs: 1000, maxRequests: 5 })

			mockRequest.header.mockImplementation(() => undefined)
			mockContext.get = vi.fn().mockReturnValue(undefined)

			await middleware(mockContext, mockNext)

			expect(mockNext).toHaveBeenCalled()
		})

		it('should handle x-forwarded-for with multiple IPs', async () => {
			const middleware = rateLimit({ windowMs: 1000, maxRequests: 5 })

			mockRequest.header.mockImplementation((name: string) => {
				if (name === 'x-forwarded-for') return `${uniqueIp}, 10.0.0.1`
				return undefined
			})
			mockContext.get = vi.fn().mockReturnValue(undefined)

			await middleware(mockContext, mockNext)

			expect(mockNext).toHaveBeenCalled()
		})

		it('should reset counter after window expires', async () => {
			const middleware = rateLimit({ windowMs: 100, maxRequests: 2 })

			mockRequest.header.mockImplementation((name: string) => {
				if (name === 'x-forwarded-for') return uniqueIp
				return undefined
			})

			// Make 2 requests (within limit)
			await middleware(mockContext, mockNext)
			await middleware(mockContext, mockNext)

			// Wait for window to expire
			await new Promise((resolve) => setTimeout(resolve, 150))

			// Should be able to make requests again
			await middleware(mockContext, mockNext)

			expect(mockNext).toHaveBeenCalledTimes(3)
		})

		it('should throw tooManyRequests error when limit exceeded', async () => {
			const middleware = rateLimit({ windowMs: 1000, maxRequests: 1 })

			mockRequest.header.mockImplementation((name: string) => {
				if (name === 'x-forwarded-for') return uniqueIp
				return undefined
			})

			// First request succeeds
			await middleware(mockContext, mockNext)

			// Second request should fail
			await expect(middleware(mockContext, mockNext)).rejects.toThrow()

			// Verify error is the correct type
			try {
				await middleware(mockContext, mockNext)
				expect.fail('Should have thrown an error')
			} catch (error: any) {
				expect(error).toBeInstanceOf(Errors.tooManyRequests('').constructor)
			}
		})

		it('should set remaining count to 0 when limit exceeded', async () => {
			const middleware = rateLimit({ windowMs: 1000, maxRequests: 1 })

			mockRequest.header.mockImplementation((name: string) => {
				if (name === 'x-forwarded-for') return uniqueIp
				return undefined
			})

			// First request
			await middleware(mockContext, mockNext)

			// Second request should set remaining to 0 before throwing
			try {
				await middleware(mockContext, mockNext)
				expect.fail('Should have thrown an error')
			} catch (error) {
				expect(mockContext.header).toHaveBeenCalledWith('X-RateLimit-Remaining', '0')
			}
		})
	})

	describe('strictRateLimit', () => {
		it('should have maxRequests of 10', async () => {
			const middleware = strictRateLimit

			mockRequest.header.mockImplementation((name: string) => {
				if (name === 'x-forwarded-for') return uniqueIp
				return undefined
			})

			// Make 10 requests (within limit)
			for (let i = 0; i < 10; i++) {
				await middleware(mockContext, mockNext)
			}

			// 11th request should be blocked
			await expect(middleware(mockContext, mockNext)).rejects.toThrow()

			// Verify it's the correct error type
			try {
				await middleware(mockContext, mockNext)
				expect.fail('Should have thrown')
			} catch (error: any) {
				expect(error).toBeInstanceOf(Errors.tooManyRequests('').constructor)
			}
		})
	})

	describe('moderateRateLimit', () => {
		it('should have maxRequests of 100', async () => {
			const middleware = moderateRateLimit

			mockRequest.header.mockImplementation((name: string) => {
				if (name === 'x-forwarded-for') return uniqueIp
				return undefined
			})

			// Make 100 requests (within limit)
			for (let i = 0; i < 100; i++) {
				await middleware(mockContext, mockNext)
			}

			// 101st request should be blocked
			await expect(middleware(mockContext, mockNext)).rejects.toThrow()

			// Verify it's the correct error type
			try {
				await middleware(mockContext, mockNext)
				expect.fail('Should have thrown')
			} catch (error: any) {
				expect(error).toBeInstanceOf(Errors.tooManyRequests('').constructor)
			}
		})
	})

	describe('lenientRateLimit', () => {
		it('should have maxRequests of 200', async () => {
			const middleware = lenientRateLimit

			mockRequest.header.mockImplementation((name: string) => {
				if (name === 'x-forwarded-for') return uniqueIp
				return undefined
			})

			// Make 200 requests (within limit)
			for (let i = 0; i < 200; i++) {
				await middleware(mockContext, mockNext)
			}

			// 201st request should be blocked
			await expect(middleware(mockContext, mockNext)).rejects.toThrow()

			// Verify it's the correct error type
			try {
				await middleware(mockContext, mockNext)
				expect.fail('Should have thrown')
			} catch (error: any) {
				expect(error).toBeInstanceOf(Errors.tooManyRequests('').constructor)
			}
		})
	})

	describe('Scope Isolation', () => {
		it('should not share state between different limiters', async () => {
			// Limiter A: Strict (max 2)
			const strictLimiter = rateLimit({ windowMs: 60000, maxRequests: 2 })

			// Limiter B: Lenient (max 10)
			const lenientLimiter = rateLimit({ windowMs: 60000, maxRequests: 10 })

			// 1. Make 5 requests to Lenient (Valid)
			for (let i = 0; i < 5; i++) {
				mockRequest.header.mockImplementation((name: string) => {
					if (name === 'x-forwarded-for') return uniqueIp
					return undefined
				})
				await lenientLimiter(mockContext, mockNext)
			}

			// 2. Make 1 request to Strict
			// If shared, count is 5. Max is 2. Should fail.
			// If independent, count is 0. Should pass.
			mockRequest.header.mockImplementation((name: string) => {
				if (name === 'x-forwarded-for') return uniqueIp
				return undefined
			})

			await strictLimiter(mockContext, mockNext)
			expect(mockNext).toHaveBeenCalled()
		})
	})
})
