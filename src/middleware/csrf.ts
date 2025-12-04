/**
 * CSRF Protection Middleware
 * Protects against Cross-Site Request Forgery attacks
 */


import { csrf } from 'hono/csrf'
import { config } from '../config.js'

/**
 * CSRF middleware using Hono's built-in protection
 * Validates Origin header for state-changing requests
 */
export const csrfProtection = csrf({
    origin: config.corsOrigins,
})
