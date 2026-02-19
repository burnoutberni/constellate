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
        realIp = `10.0.0.${testCounter}`
        mockNext = vi.fn().mockResolvedValue(undefined)
        mockRequest = {
            header: vi.fn(),
        }
        mockContext = {
            req: mockRequest,
            get: vi.fn().mockReturnValue(undefined), // No user ID
            header: vi.fn(),
            res: { status: 200 },
        } as unknown as Context
    })

    it('should prevent IP spoofing by using the last IP in X-Forwarded-For', async () => {
        // Set limit to 1 request
        const middleware = rateLimit({ windowMs: 1000, maxRequests: 1 })

        // Request 1: Attacker sends spoofed IP 1.2.3.4, real IP is appended by proxy
        // The rate limiter should see the LAST IP (realIp)
        mockRequest.header.mockImplementation((name: string) => {
            if (name === 'x-forwarded-for') return `1.2.3.4, ${realIp}`
            return undefined
        })
        await middleware(mockContext, mockNext)
        expect(mockNext).toHaveBeenCalledTimes(1)

        // Request 2: Attacker changes spoofed IP to 5.6.7.8, real IP remains same
        // If secure, the rate limiter still sees realIp and blocks the request
        mockRequest.header.mockImplementation((name: string) => {
            if (name === 'x-forwarded-for') return `5.6.7.8, ${realIp}`
            return undefined
        })

        await expect(middleware(mockContext, mockNext)).rejects.toThrow()

        expect(mockNext).toHaveBeenCalledTimes(1)
    })
})
