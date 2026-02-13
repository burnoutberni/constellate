import { describe, it, expect, vi, beforeEach } from 'vitest'
import { rateLimit } from '../../middleware/rateLimit.js'
import { Context } from 'hono'
import { randomBytes } from 'crypto'

// Create a minimal mock context
function createMockContext(headers: Record<string, string>): Context {
    const resHeaders: Record<string, string> = {}
    return {
        req: {
            header: (name: string) => headers[name.toLowerCase()],
        },
        res: {
            status: 200,
        },
        header: (name: string, value: string) => {
            resHeaders[name] = value
        },
        get: (key: string) => undefined, // No user
        set: () => {},
        resHeaders,
    } as unknown as Context
}

function getRandomIp() {
    return `10.${randomBytes(1)[0]}.${randomBytes(1)[0]}.${randomBytes(1)[0]}`
}

describe('Rate Limiting Middleware - IP Security', () => {
    let next: any

    beforeEach(() => {
        next = vi.fn()
    })

    it('should prevent IP spoofing: rate limits based on real IP (last in X-Forwarded-For)', async () => {
        const middleware = rateLimit({
            windowMs: 1000,
            maxRequests: 5,
        })

        const realIp = getRandomIp()
        const spoofedIp1 = getRandomIp()
        const spoofedIp2 = getRandomIp()

        // 1. Send 5 requests from spoofedIp1
        for (let i = 0; i < 5; i++) {
            const ctx = createMockContext({
                'x-forwarded-for': `${spoofedIp1}, ${realIp}`
            })
            await middleware(ctx, next)
        }

        // 2. Send 1 more request from spoofedIp1 - should be blocked
        // Because realIp is now exhausted
        const ctxBlocked = createMockContext({
            'x-forwarded-for': `${spoofedIp1}, ${realIp}`
        })
        try {
            await middleware(ctxBlocked, next)
        } catch (e: any) {
            expect(e.message).toContain('Rate limit exceeded')
        }

        // 3. Send 1 request from spoofedIp2 (same real IP) - should ALSO be blocked
        // If vulnerable, this would pass as a "new user" (spoofedIp2)
        // If secure, this uses realIp which is already exhausted
        const ctxNewSpoof = createMockContext({
            'x-forwarded-for': `${spoofedIp2}, ${realIp}`
        })

        let errorThrown = false
        try {
            await middleware(ctxNewSpoof, next)
        } catch (e: any) {
            errorThrown = true
            expect(e.message).toContain('Rate limit exceeded')
        }

        expect(errorThrown).toBe(true)
    })

    it('should prioritize X-Real-IP if present', async () => {
        const middleware = rateLimit({
            windowMs: 1000,
            maxRequests: 5,
        })

        const realIp = getRandomIp()
        const xffIp = getRandomIp() // Should be ignored in favor of X-Real-IP

        // 1. Send 5 requests from realIp
        for (let i = 0; i < 5; i++) {
            const ctx = createMockContext({
                'x-real-ip': realIp,
                'x-forwarded-for': xffIp
            })
            await middleware(ctx, next)
        }

        // 2. Send 1 request from DIFFERENT xffIp but SAME X-Real-IP
        const ctxBlocked = createMockContext({
            'x-real-ip': realIp,
            'x-forwarded-for': getRandomIp()
        })

        let errorThrown = false
        try {
            await middleware(ctxBlocked, next)
        } catch (e: any) {
            errorThrown = true
            expect(e.message).toContain('Rate limit exceeded')
        }

        expect(errorThrown).toBe(true)
    })
})
