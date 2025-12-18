/**
 * Structured Error Handling
 * Prevents information disclosure in production
 */

import { Context } from 'hono'
import { ZodError } from 'zod'
import { config } from '../config.js'

/**
 * Application Error Class
 * Provides structured error handling with error codes
 */
export class AppError extends Error {
	constructor(
		public code: string,
		message: string,
		public statusCode: number = 500,
		public details?: unknown
	) {
		super(message)
		this.name = 'AppError'
	}
}

/**
 * Handles errors and returns appropriate responses
 * Sanitizes error messages in production
 */
interface ErrorResponse {
	error: string
	message: string
	details?: unknown
}

export function handleError(error: unknown, c: Context): Response {
	// Handle known application errors
	if (error instanceof AppError) {
		const response: ErrorResponse = {
			error: error.code,
			message: error.message,
		}

		// Only include details in development
		if (config.isDevelopment && error.details !== undefined) {
			response.details = error.details
		}

		return c.json(
			response,
			error.statusCode as 200 | 201 | 400 | 401 | 403 | 404 | 409 | 429 | 500
		)
	}

	// Handle Zod validation errors
	if (error instanceof ZodError) {
		const response: ErrorResponse = {
			error: 'VALIDATION_ERROR',
			message: 'Invalid input data',
		}

		if (config.isDevelopment) {
			response.details = error.issues
		}

		return c.json(response, 400 as const)
	}

	// Log full error server-side (for debugging)
	console.error('[Error Handler] Unhandled error:', error)

	// Return generic error to client (no sensitive information)
	return c.json(
		{
			error: 'INTERNAL_ERROR',
			message: 'An internal error occurred',
		},
		500 as const
	)
}

/**
 * Common error factories
 */
export const Errors = {
	notFound: (resource: string = 'Resource') =>
		new AppError('NOT_FOUND', `${resource} not found`, 404),

	unauthorized: (message: string = 'Authentication required') =>
		new AppError('UNAUTHORIZED', message, 401),

	forbidden: (message: string = 'Access forbidden') => new AppError('FORBIDDEN', message, 403),

	badRequest: (message: string = 'Bad request') => new AppError('BAD_REQUEST', message, 400),

	conflict: (message: string = 'Resource conflict') => new AppError('CONFLICT', message, 409),

	tooManyRequests: (message: string = 'Too many requests') =>
		new AppError('TOO_MANY_REQUESTS', message, 429),

	internal: (message: string = 'Internal server error') =>
		new AppError('INTERNAL_ERROR', message, 500),
}
