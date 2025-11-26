/**
 * Rate Limiting Middleware
 * Prevents abuse and DoS attacks
 */

import { Context, Next } from 'hono'
import { Errors } from '../lib/errors.js'

// In-memory rate limit store
// In production, consider using Redis for distributed rate limiting
interface RateLimitEntry {
    count: number
    resetAt: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

// Cleanup old entries every 5 minutes
setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of rateLimitStore.entries()) {
        if (entry.resetAt < now) {
            rateLimitStore.delete(key)
        }
    }
}, 5 * 60 * 1000)

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
    windowMs: number // Time window in milliseconds
    maxRequests: number // Maximum requests per window
    keyGenerator?: (c: Context) => string // Custom key generator
    skipSuccessfulRequests?: boolean // Don't count successful requests
    skipFailedRequests?: boolean // Don't count failed requests
}

/**
 * Default rate limit: 100 requests per 15 minutes for authenticated users
 * 50 requests per 15 minutes for anonymous users
 */
const defaultConfig: RateLimitConfig = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
}

/**
 * Rate limiting middleware
 */
export function rateLimit(config: Partial<RateLimitConfig> = {}) {
    const finalConfig = { ...defaultConfig, ...config }
    
    return async (c: Context, next: Next) => {
        // Generate rate limit key
        const userId = c.get('userId') as string | undefined
        const ip = c.req.header('x-forwarded-for')?.split(',')[0] || 
                   c.req.header('x-real-ip') || 
                   'unknown'
        
        const key = finalConfig.keyGenerator 
            ? finalConfig.keyGenerator(c)
            : userId 
                ? `user:${userId}` 
                : `ip:${ip}`
        
        const now = Date.now()
        const entry = rateLimitStore.get(key)
        
        // Check if entry exists and is still valid
        if (entry && entry.resetAt > now) {
            // Check if limit exceeded
            if (entry.count >= finalConfig.maxRequests!) {
                c.header('X-RateLimit-Limit', String(finalConfig.maxRequests!))
                c.header('X-RateLimit-Remaining', '0')
                c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)))
                throw Errors.tooManyRequests(
                    `Rate limit exceeded. Maximum ${finalConfig.maxRequests} requests per ${Math.ceil(finalConfig.windowMs! / 60000)} minutes.`
                )
            }
            
            // Increment counter
            entry.count++
        } else {
            // Create new entry
            rateLimitStore.set(key, {
                count: 1,
                resetAt: now + finalConfig.windowMs!,
            })
        }
        
        // Set rate limit headers
        const currentEntry = rateLimitStore.get(key)!
        c.header('X-RateLimit-Limit', String(finalConfig.maxRequests!))
        c.header('X-RateLimit-Remaining', String(Math.max(0, finalConfig.maxRequests! - currentEntry.count)))
        c.header('X-RateLimit-Reset', String(Math.ceil(currentEntry.resetAt / 1000)))
        
        await next()
        
        // Optionally skip counting successful requests
        if (finalConfig.skipSuccessfulRequests && c.res.status >= 200 && c.res.status < 300) {
            const entry = rateLimitStore.get(key)
            if (entry) {
                entry.count = Math.max(0, entry.count - 1)
            }
        }
    }
}

/**
 * Stricter rate limit for sensitive operations (login, signup, etc.)
 */
export const strictRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10, // Only 10 attempts per 15 minutes
})

/**
 * Moderate rate limit for authenticated operations
 */
export const moderateRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
})

/**
 * Lenient rate limit for public read operations
 */
export const lenientRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 200,
})

