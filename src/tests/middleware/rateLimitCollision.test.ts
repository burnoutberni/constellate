
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Context } from 'hono'
import { rateLimit } from '../../middleware/rateLimit.js'

// Mock Hono Context
const createMockContext = (ip: string, userId?: string) => {
	return {
		req: {
			header: (name: string) => {
				if (name === 'x-forwarded-for') return ip
				if (name === 'x-real-ip') return ip
				return undefined
			},
		},
		get: (key: string) => {
			if (key === 'userId') return userId
			return undefined
		},
		header: vi.fn(),
		res: {
			status: 200,
		},
	} as unknown as Context
}

const mockNext = vi.fn()

describe('Rate Limit Collision', () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	it('should not share limits between different rate limiters when scopes are used', async () => {
		// Create two different rate limiters with unique scopes
		const limiter1 = rateLimit({
			windowMs: 60000,
			maxRequests: 2,
            scope: 'limiter1'
		})

		const limiter2 = rateLimit({
			windowMs: 60000,
			maxRequests: 10,
            scope: 'limiter2'
		})

		const c = createMockContext('1.2.3.4')

		// Use limiter1 up to its limit
		await limiter1(c, mockNext)
		await limiter1(c, mockNext)

        // At this point, count for 'limiter1:ip:1.2.3.4' is 2 in the shared store.

        // Now use limiter2. It should have its own counter (0).
        // Check 8 hits.
        for (let i = 0; i < 8; i++) {
            await limiter2(c, mockNext)
        }

        // Total hits:
        // limiter1: 2
        // limiter2: 8

        // If separate (which they should be now), both are below or at limit (limiter1 at limit, limiter2 below limit).

        // Let's verify limiter2 still allows requests.
        // limiter2 maxRequests is 10. Current count 8.
        // It should accept 2 more.
        await limiter2(c, mockNext) // 9
        await limiter2(c, mockNext) // 10

        // Next one should fail.
        try {
            await limiter2(c, mockNext)
            expect(true).toBe(false) // Should fail
        } catch (e) {
            expect((e as any).message).toContain('Rate limit exceeded')
        }

        // Verify limiter1 is still blocked (count 2, max 2).
        try {
            await limiter1(c, mockNext)
            expect(true).toBe(false) // Should fail
        } catch (e) {
             expect((e as any).message).toContain('Rate limit exceeded')
        }

        // Verify cross-contamination didn't happen.
        // If shared, total hits would be 2 (limiter1) + 10 (limiter2) = 12.
        // But scopes are used, so they are separate.

        // Let's do the strict vs lenient test again with explicit scopes.

        const strict = rateLimit({ windowMs: 60000, maxRequests: 1, scope: 'strict-test' })
        const lenient = rateLimit({ windowMs: 60000, maxRequests: 10, scope: 'lenient-test' })

        const c2 = createMockContext('5.6.7.8')

        await strict(c2, mockNext) // strict count = 1. strict exhausted.

        await lenient(c2, mockNext) // lenient count = 1.

        // lenient should NOT be affected by strict's usage.
        // lenient count is 1. max is 10.
        // If shared, count would be 2.

        // Hit strict again. Should fail.
        try {
            await strict(c2, mockNext)
            expect(true).toBe(false)
        } catch (e) {
            expect((e as any).message).toContain('Maximum 1 requests')
        }

        // Hit lenient. Should succeed.
        await lenient(c2, mockNext) // lenient count = 2.

        // If shared, count would be 3 (strict 1, lenient 1, strict 1(fail), lenient 1).

        // We can verify independence by exhausting one and ensuring the other is fine.

        const strict2 = rateLimit({ windowMs: 60000, maxRequests: 10, scope: 'strict2' })
        const lenient2 = rateLimit({ windowMs: 60000, maxRequests: 20, scope: 'lenient2' })

        const c3 = createMockContext('9.9.9.9')
        c3.header = vi.fn()

        for (let i = 0; i < 10; i++) {
            await strict2(c3, mockNext)
        }

        // Clear mock to reset accumulated calls
        ;(c3.header as any).mockClear()

        await lenient2(c3, mockNext)

        // Check Remaining header for lenient2
        const remainingCalls = c3.header.mock.calls.find(call => call[0] === 'X-RateLimit-Remaining')
        const remaining = remainingCalls ? parseInt(remainingCalls[1] as string) : -1

        // lenient2 limit is 20. used 1. remaining 19.
        expect(remaining).toBe(19)
	})
})
