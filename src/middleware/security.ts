/**
 * Security Headers Middleware
 * Adds security headers to all responses
 */

import { Context, Next } from 'hono'
import { config } from '../config.js'

/**
 * Security headers middleware
 * Adds essential security headers to prevent common attacks
 */
export async function securityHeaders(c: Context, next: Next) {
    await next()
    
    // Content Security Policy
    // Allow same-origin, better-auth, and ActivityPub endpoints
    // In production, you may want to restrict this further
    const csp = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Needed for Vite dev, tighten in production
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self' data:",
        "connect-src 'self' https: wss: ws:", // For ActivityPub federation and WebSocket
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
    ].join('; ')
    
    // Set security headers
    c.header('Content-Security-Policy', csp)
    c.header('X-Frame-Options', 'DENY')
    c.header('X-Content-Type-Options', 'nosniff')
    c.header('X-XSS-Protection', '1; mode=block')
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
    c.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
    
    // HSTS - only if HTTPS (Caddy will handle this, but we set it anyway)
    if (config.isProduction) {
        c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
    }
    
    // Remove server header (optional, but good practice)
    // Note: Hono doesn't set this by default, but we ensure it's not present
    c.header('X-Powered-By', '') // Remove if set
}

