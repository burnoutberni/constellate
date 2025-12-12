/**
 * Utility functions for handling API errors consistently
 *
 * This module provides utilities for extracting user-friendly error messages
 * from various error types and formats used throughout the application.
 */

/**
 * Type guard to check if an error has a response property (from API client)
 */
export function isApiError(error: unknown): error is Error & { response?: Response } {
	return error instanceof Error && 'response' in error
}

/**
 * Type guard to check if an error has a message property
 */
export function hasMessage(error: unknown): error is { message: string } {
	return (
		typeof error === 'object' &&
		error !== null &&
		'message' in error &&
		typeof (error as { message: unknown }).message === 'string'
	)
}

/**
 * Extracts a user-friendly error message from various error types
 *
 * @param error - The error to extract a message from (Error, unknown, Response, etc.)
 * @param defaultMessage - Default message if extraction fails (default: "An unexpected error occurred")
 * @returns A user-friendly error message string
 *
 * @example
 * ```typescript
 * // From Error instance
 * extractErrorMessage(new Error('Something went wrong')) // "Something went wrong"
 *
 * // From API error with response
 * extractErrorMessage(apiError) // Extracts from Error.message (already formatted by buildErrorMessage)
 *
 * // From unknown type
 * extractErrorMessage({ message: 'Custom error' }) // "Custom error"
 * extractErrorMessage(null) // "An unexpected error occurred"
 * ```
 */
export function extractErrorMessage(
	error: unknown,
	defaultMessage: string = 'An unexpected error occurred'
): string {
	// Handle Error instances (most common case)
	if (error instanceof Error) {
		return error.message || defaultMessage
	}

	// Handle objects with message property
	if (hasMessage(error)) {
		return error.message
	}

	// Handle string errors
	if (typeof error === 'string') {
		return error
	}

	// Handle Response objects (shouldn't happen in practice, but handle gracefully)
	if (error instanceof Response) {
		return defaultMessage
	}

	// Fallback for unknown types
	return defaultMessage
}

/**
 * Builds a user-friendly error message from an API response
 *
 * This function is used by the API client to format error messages before throwing.
 * For extracting messages from already-thrown errors, use `extractErrorMessage` instead.
 *
 * @param baseMessage - The base error message (e.g., "Failed to search events")
 * @param response - The fetch Response object
 * @returns A formatted error message string
 *
 * @example
 * ```typescript
 * const response = await fetch('/api/events')
 * if (!response.ok) {
 *   const message = await buildErrorMessage('Failed to fetch events', response)
 *   throw new Error(message)
 * }
 * ```
 */
export async function buildErrorMessage(baseMessage: string, response: Response): Promise<string> {
	const statusCode = response.status
	let errorMessage = baseMessage

	try {
		const errorBody = (await response.json()) as { error?: string; message?: string }
		// Check both 'error' and 'message' fields for API error responses
		const apiMessage = errorBody.error || errorBody.message
		if (apiMessage) {
			errorMessage = `${errorMessage}: ${apiMessage}`
		}
	} catch {
		// If response body isn't JSON, use status-based message
		// getStatusMessage always returns a string (has fallback), so use it directly
		const statusMessage = getStatusMessage(statusCode)
		errorMessage = `${errorMessage} (${statusCode}): ${statusMessage}`
	}

	return errorMessage
}

/**
 * Gets a user-friendly message for common HTTP status codes
 *
 * @param statusCode - HTTP status code
 * @returns User-friendly error message
 */
export function getStatusMessage(statusCode: number): string {
	const statusMessages: Record<number, string> = {
		400: 'Invalid request. Please check your input.',
		401: 'Authentication required. Please sign in.',
		403: 'You do not have permission to perform this action.',
		404: 'The requested resource was not found.',
		409: 'This action conflicts with the current state.',
		429: 'Too many requests. Please try again later.',
		500: 'Server error. Please try again later.',
		502: 'Service temporarily unavailable. Please try again later.',
		503: 'Service temporarily unavailable. Please try again later.',
	}

	return statusMessages[statusCode] || `Request failed with status ${statusCode}`
}
