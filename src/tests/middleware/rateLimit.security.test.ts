import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Context } from 'hono'
import { rateLimit } from '../../middleware/rateLimit.js'
import { Errors } from '../../lib/errors.js'

// Static counter to ensure unique IPs across tests in the same file execution
// Since rateLimitStore is a module-level variable, it persists across tests
let testCounter = 0

describe('Rate Limiting Security', () => {
    let mockContext: Context
    let mockNext: () => Promise<void>
    let mockRequest: any
    let uniqueIp: string

    beforeEach(() => {
        // Increment counter for each test run to avoid collisions
        testCounter++
        uniqueIp = `203.0.113.${testCounter}`

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

    it('should prevent IP spoofing via X-Forwarded-For', async () => {
        // Set limit to 1 request
        const middleware = rateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 1 })

        // Request 1: Attacker sends spoofed IP 1, but real IP is uniqueIp
        // The server receives: Client-IP, Real-IP (appended by proxy)
        mockRequest.header.mockImplementation((name: string) => {
            if (name === 'x-forwarded-for') return `1.2.3.4, ${uniqueIp}`
            // Even if X-Real-IP is present, we prioritize X-Forwarded-For (last IP)
            if (name === 'x-real-ip') return uniqueIp
            return undefined
        })

        await middleware(mockContext, mockNext)
        expect(mockNext).toHaveBeenCalledTimes(1)

        // Request 2: Attacker sends spoofed IP 2, real IP is still uniqueIp
        mockRequest.header.mockImplementation((name: string) => {
            if (name === 'x-forwarded-for') return `5.6.7.8, ${uniqueIp}`
            if (name === 'x-real-ip') return uniqueIp
            return undefined
        })

        // VERIFY FIX:
        // With the fix, the rate limiter should see `uniqueIp` (the real IP) for both requests.
        // Since limit is 1, the second request should be blocked.
        await expect(middleware(mockContext, mockNext)).rejects.toThrow()
        expect(mockNext).toHaveBeenCalledTimes(1)
    })
})
