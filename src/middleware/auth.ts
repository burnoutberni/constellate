/**
 * Authentication & Authorization Middleware
 * Extracts user from cookies and provides auth helpers
 */

import { Context, Next } from 'hono'
import { auth } from '../auth.js'
import { prisma } from '../lib/prisma.js'
import { Errors } from '../lib/errors.js'

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

/**
 * Requires authentication - throws error if user is not authenticated
 */
export function requireAuth(c: Context): string {
	const userId = c.get('userId')
	if (!userId) {
		throw Errors.unauthorized()
	}
	return userId
}

/**
 * Requires ownership of a resource
 * @param c - Hono context
 * @param resourceUserId - User ID of the resource owner (can be null for public resources)
 * @param resourceName - Name of the resource for error messages
 */
export async function requireOwnership(
	c: Context,
	resourceUserId: string | null,
	resourceName: string = 'resource'
): Promise<void> {
	// If resourceUserId is null, it's a public resource - allow access
	if (resourceUserId === null) {
		return
	}

	const userId = requireAuth(c)
	if (resourceUserId !== userId) {
		throw Errors.forbidden(`You don't have permission to access this ${resourceName}`)
	}
}

/**
 * Requires admin role
 * @param c - Hono context
 */
export async function requireAdmin(c: Context): Promise<void> {
	const userId = requireAuth(c)

	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { isAdmin: true },
	})

	if (!user?.isAdmin) {
		throw Errors.forbidden('Admin access required')
	}
}
