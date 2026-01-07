import { describe, it, expect } from 'vitest'

import {
	extractErrorMessage,
	buildErrorMessage,
	getStatusMessage,
	getErrorStatus,
	isApiError,
	hasMessage,
} from '@/lib/errorHandling'

describe('errorHandling', () => {
	describe('isApiError', () => {
		it('should return true for Error with response property', () => {
			const error = new Error('Test error') as Error & { response: Response }
			error.response = new Response()
			expect(isApiError(error)).toBe(true)
		})

		it('should return false for regular Error', () => {
			const error = new Error('Test error')
			expect(isApiError(error)).toBe(false)
		})

		it('should return false for non-Error objects', () => {
			expect(isApiError({ message: 'test' })).toBe(false)
			expect(isApiError('string error')).toBe(false)
			expect(isApiError(null)).toBe(false)
		})
	})

	describe('hasMessage', () => {
		it('should return true for object with string message', () => {
			expect(hasMessage({ message: 'test' })).toBe(true)
		})

		it('should return false for object with non-string message', () => {
			expect(hasMessage({ message: 123 })).toBe(false)
		})

		it('should return false for object without message', () => {
			expect(hasMessage({ error: 'test' })).toBe(false)
		})

		it('should return false for null', () => {
			expect(hasMessage(null)).toBe(false)
		})

		it('should return false for non-objects', () => {
			expect(hasMessage('string')).toBe(false)
			expect(hasMessage(123)).toBe(false)
		})
	})

	describe('extractErrorMessage', () => {
		it('should extract message from Error instance', () => {
			const error = new Error('Test error message')
			expect(extractErrorMessage(error)).toBe('Test error message')
		})

		it('should use default message for Error with empty message', () => {
			const error = new Error('')
			expect(extractErrorMessage(error)).toBe('An unexpected error occurred')
		})

		it('should extract message from object with message property', () => {
			const error = { message: 'Custom error' }
			expect(extractErrorMessage(error)).toBe('Custom error')
		})

		it('should handle string errors', () => {
			expect(extractErrorMessage('String error')).toBe('String error')
		})

		it('should use default message for Response objects', () => {
			const response = new Response()
			expect(extractErrorMessage(response)).toBe('An unexpected error occurred')
		})

		it('should use default message for unknown types', () => {
			expect(extractErrorMessage(null)).toBe('An unexpected error occurred')
			expect(extractErrorMessage(undefined)).toBe('An unexpected error occurred')
			expect(extractErrorMessage(123)).toBe('An unexpected error occurred')
		})

		it('should use custom default message', () => {
			expect(extractErrorMessage(null, 'Custom default')).toBe('Custom default')
		})
	})

	describe('buildErrorMessage', () => {
		it('should build message with API error field', async () => {
			const response = new Response(JSON.stringify({ error: 'API error message' }), {
				status: 400,
			})

			const message = await buildErrorMessage('Failed to fetch', response)
			expect(message).toBe('Failed to fetch: API error message')
		})

		it('should build message with API message field', async () => {
			const response = new Response(JSON.stringify({ message: 'API message' }), {
				status: 400,
			})

			const message = await buildErrorMessage('Failed to fetch', response)
			expect(message).toBe('Failed to fetch: API message')
		})

		it('should prefer error field over message field', async () => {
			const response = new Response(
				JSON.stringify({ error: 'Error field', message: 'Message field' }),
				{ status: 400 }
			)

			const message = await buildErrorMessage('Failed to fetch', response)
			expect(message).toBe('Failed to fetch: Error field')
		})

		it('should use status message when response is not JSON', async () => {
			const response = new Response('Not JSON', { status: 404 })

			const message = await buildErrorMessage('Failed to fetch', response)
			expect(message).toBe('Failed to fetch (404): The requested resource was not found.')
		})

		it('should handle various status codes', async () => {
			const response500 = new Response('', { status: 500 })
			const message500 = await buildErrorMessage('Failed', response500)
			expect(message500).toContain('500')
			expect(message500).toContain('Server error')
		})
	})

	describe('getStatusMessage', () => {
		it('should return message for 400', () => {
			expect(getStatusMessage(400)).toBe('Invalid request. Please check your input.')
		})

		it('should return message for 401', () => {
			expect(getStatusMessage(401)).toBe('Authentication required. Please sign in.')
		})

		it('should return message for 403', () => {
			expect(getStatusMessage(403)).toBe('You do not have permission to perform this action.')
		})

		it('should return message for 404', () => {
			expect(getStatusMessage(404)).toBe('The requested resource was not found.')
		})

		it('should return message for 409', () => {
			expect(getStatusMessage(409)).toBe('This action conflicts with the current state.')
		})

		it('should return message for 429', () => {
			expect(getStatusMessage(429)).toBe('Too many requests. Please try again later.')
		})

		it('should return message for 500', () => {
			expect(getStatusMessage(500)).toBe('Server error. Please try again later.')
		})

		it('should return message for 502', () => {
			expect(getStatusMessage(502)).toBe('Service temporarily unavailable. Please try again later.')
		})

		it('should return message for 503', () => {
			expect(getStatusMessage(503)).toBe('Service temporarily unavailable. Please try again later.')
		})

		it('should return generic message for unknown status codes', () => {
			expect(getStatusMessage(418)).toBe('Request failed with status 418')
			expect(getStatusMessage(999)).toBe('Request failed with status 999')
		})
	})

	describe('getErrorStatus', () => {
		it('should extract status from API error', () => {
			const error = new Error('Test error') as Error & { response: Response }
			error.response = new Response('', { status: 404 })

			expect(getErrorStatus(error)).toBe(404)
		})

		it('should return undefined for Error without response', () => {
			const error = new Error('Test error')
			expect(getErrorStatus(error)).toBeUndefined()
		})

		it('should return undefined for non-Error objects', () => {
			expect(getErrorStatus({ message: 'test' })).toBeUndefined()
			expect(getErrorStatus('string')).toBeUndefined()
			expect(getErrorStatus(null)).toBeUndefined()
		})
	})
})
