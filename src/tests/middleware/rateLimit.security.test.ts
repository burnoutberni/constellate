import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Context } from 'hono'
import { rateLimit } from '../../middleware/rateLimit.js'

describe('Rate Limiting Security', () => {
  let mockContext: Context
  let mockNext: () => Promise<void>
  let mockRequest: any

  let testCounter = 0

  beforeEach(() => {
    testCounter++
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

  it('should prevent IP spoofing via X-Forwarded-For header', async () => {
    // Set limit to 1 request
    const middleware = rateLimit({ windowMs: 1000, maxRequests: 1 })

    const spoofedIp = `1.2.3.${testCounter}`
    const realIp1 = `10.0.${testCounter}.1`
    const realIp2 = `10.0.${testCounter}.2`

    // Request 1: Attacker sends spoofed IP, proxy appends real IP 1
    mockRequest.header.mockImplementation((name: string) => {
      if (name === 'x-forwarded-for') return `${spoofedIp}, ${realIp1}`
      return undefined
    })

    // First request should succeed
    await middleware(mockContext, mockNext)
    expect(mockNext).toHaveBeenCalledTimes(1)

    // Request 2: Different real user (or same attacker from different IP) sends same spoofed IP
    // If the rate limiter uses the first IP (spoofed), this will be blocked.
    // If it uses the last IP (real), this is a different user, so it should succeed.
    mockRequest.header.mockImplementation((name: string) => {
        if (name === 'x-forwarded-for') return `${spoofedIp}, ${realIp2}`
        return undefined
    })

    // Reset mocks for second call
    mockNext = vi.fn().mockResolvedValue(undefined)

    // This should NOT throw if the implementation is secure (using real IP)
    await middleware(mockContext, mockNext)
    expect(mockNext).toHaveBeenCalledTimes(1)
  })

  it('should prioritize X-Real-IP over X-Forwarded-For', async () => {
    const middleware = rateLimit({ windowMs: 1000, maxRequests: 1 })

    const spoofedForwarded = `1.2.3.${testCounter}`
    const realIp1 = `10.0.${testCounter}.3`
    const realIp2 = `10.0.${testCounter}.4`

    // Request 1
    mockRequest.header.mockImplementation((name: string) => {
      if (name === 'x-forwarded-for') return spoofedForwarded
      if (name === 'x-real-ip') return realIp1
      return undefined
    })

    await middleware(mockContext, mockNext)

    // Request 2: Different Real IP, same spoofed X-Forwarded-For
    mockRequest.header.mockImplementation((name: string) => {
        if (name === 'x-forwarded-for') return spoofedForwarded
        if (name === 'x-real-ip') return realIp2
        return undefined
    })

    mockNext = vi.fn().mockResolvedValue(undefined)

    // Should succeed if X-Real-IP is used
    await middleware(mockContext, mockNext)
    expect(mockNext).toHaveBeenCalledTimes(1)
  })
})
