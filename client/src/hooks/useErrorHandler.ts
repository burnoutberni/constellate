/**
 * React hook for consistent error handling across the application
 *
 * This hook provides a standardized way to handle errors by:
 * - Extracting user-friendly error messages from various error types
 * - Displaying errors via toast notifications
 * - Optionally logging errors for debugging
 * - Supporting context information for better error tracking
 *
 * @example
 * ```typescript
 * // Basic usage
 * const handleError = useErrorHandler()
 *
 * try {
 *   await someAsyncOperation()
 * } catch (error) {
 *   handleError(error, 'Failed to perform operation')
 * }
 *
 * // With React Query mutations
 * const mutation = useMutation({
 *   mutationFn: updateEvent,
 *   onError: (error) => handleError(error, 'Failed to update event')
 * })
 *
 * // Silent error (no toast, just logging)
 * handleError(error, 'Background operation failed', { silent: true })
 * ```
 */

import { useCallback } from 'react'
import { useUIStore } from '@/stores'
import { extractErrorMessage } from '@/lib/errorHandling'
import { createLogger } from '@/lib/logger'

const log = createLogger('[Error Handler]')

export interface ErrorHandlerOptions {
	/**
	 * If true, error will be logged but no toast will be shown
	 * Useful for background operations or errors that are handled inline
	 */
	silent?: boolean
	/**
	 * Additional context for debugging (e.g., component name, operation name)
	 * This is logged but not shown to the user
	 */
	context?: string
}

/**
 * Hook that returns a function to handle errors consistently
 *
 * The returned function:
 * - Extracts a user-friendly message from the error
 * - Shows a toast notification (unless silent option is used)
 * - Logs the error for debugging (in development or with context)
 *
 * @returns A memoized error handler function
 */
export function useErrorHandler() {
	const addErrorToast = useUIStore((state) => state.addErrorToast)

	return useCallback(
		(error: unknown, contextOrMessage?: string, options?: ErrorHandlerOptions) => {
			// Handle legacy usage: if second param is an object, treat it as options
			let message: string | undefined
			let opts: ErrorHandlerOptions | undefined

			if (typeof contextOrMessage === 'string') {
				message = contextOrMessage
				opts = options
			} else if (contextOrMessage && typeof contextOrMessage === 'object') {
				// Legacy: second param was options object
				opts = contextOrMessage as ErrorHandlerOptions
			} else {
				opts = options
			}

			// Extract error message
			const errorMessage = extractErrorMessage(
				error,
				message || 'An unexpected error occurred'
			)

			// Use provided message as context if no explicit context is given
			const finalMessage = message || errorMessage
			const debugContext = opts?.context || (message ? `Context: ${message}` : undefined)

			// Log error for debugging (always in dev, or when context is provided)
			if (import.meta.env.DEV || debugContext) {
				log.error(debugContext ? `${debugContext} -` : '', error)
			}

			// Show toast unless silent option is used
			if (!opts?.silent) {
				addErrorToast({
					id: crypto.randomUUID(),
					message: finalMessage,
				})
			}
		},
		[addErrorToast]
	)
}

/**
 * Hook for handling React Query mutation errors
 *
 * This is a convenience wrapper around useErrorHandler that's specifically
 * designed for use with React Query's onError callback.
 *
 * @example
 * ```typescript
 * const handleMutationError = useMutationErrorHandler()
 *
 * const mutation = useMutation({
 *   mutationFn: updateEvent,
 *   onError: (error) => handleMutationError(error, 'Failed to update event')
 * })
 * ```
 */
export function useMutationErrorHandler() {
	const handleError = useErrorHandler()

	return useCallback(
		(error: unknown, message?: string, options?: ErrorHandlerOptions) => {
			handleError(error, message, options)
		},
		[handleError]
	)
}

/**
 * Hook for handling React Query query errors
 *
 * This is a convenience wrapper for handling errors from React Query queries.
 * It can be used in the onError callback or in useEffect hooks that watch for errors.
 *
 * @example
 * ```typescript
 * const handleQueryError = useQueryErrorHandler()
 *
 * const { data, error } = useQuery({
 *   queryKey: ['events'],
 *   queryFn: fetchEvents,
 *   onError: (error) => handleQueryError(error, 'Failed to load events')
 * })
 *
 * // Or in useEffect
 * useEffect(() => {
 *   if (error) {
 *     handleQueryError(error, 'Failed to load events')
 *   }
 * }, [error, handleQueryError])
 * ```
 */
export function useQueryErrorHandler() {
	const handleError = useErrorHandler()

	return useCallback(
		(error: unknown, message?: string, options?: ErrorHandlerOptions) => {
			handleError(error, message, options)
		},
		[handleError]
	)
}
