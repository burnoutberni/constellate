/**
 * Authentication Middleware
 * Extracts user from cookies and adds to context
 */

import { Context, Next } from 'hono'
import { PrismaClient } from '@prisma/client'
import { auth } from '../auth.js'

const prisma = new PrismaClient()

export async function authMiddleware(c: Context, next: Next) {
    try {
        const session = await auth.api.getSession({
            headers: c.req.raw.headers,
        })

        if (session) {
            c.set('user', session.user)
            c.set('userId', session.user.id)
        }
    } catch (e) {
        console.error('[Middleware] Error checking session:', e)
    }

    await next()
}

export function requireAuth(c: Context): string {
    const userId = c.get('userId')
    if (!userId) {
        throw new Error('Authentication required')
    }
    return userId
}
