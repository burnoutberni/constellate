/**
 * Authentication test helpers
 * Provides utilities for testing authenticated endpoints
 */

import { Context } from 'hono'

/**
 * Create a mock context with authentication
 */
export function createAuthenticatedContext(userId: string, context?: Partial<Context>): Context {
	return {
		get: (key: string) => {
			if (key === 'userId') return userId
			return context?.get?.(key)
		},
		...context,
	} as Context
}

/**
 * Create a mock context without authentication
 */
export function createUnauthenticatedContext(context?: Partial<Context>): Context {
	return {
		get: (key: string) => {
			if (key === 'userId') return undefined
			return context?.get?.(key)
		},
		...context,
	} as Context
}

/**
 * Create request headers with authentication token
 */
export function createAuthHeaders(token?: string): Record<string, string> {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
	}

	if (token) {
		headers['Authorization'] = `Bearer ${token}`
	}

	return headers
}
