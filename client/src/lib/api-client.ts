/**
 * Centralized API client for making HTTP requests
 * Provides consistent error handling, automatic credential handling, and type safety
 */

import { buildErrorMessage } from './errorHandling'

export interface ApiClientConfig {
	baseURL?: string
	defaultHeaders?: Record<string, string>
}

export type RequestInterceptor = (config: RequestInit) => RequestInit | Promise<RequestInit>
export type ResponseInterceptor = (response: Response) => Response | Promise<Response>

/**
 * API Client class for making HTTP requests with consistent error handling
 */
class ApiClient {
	private baseURL: string
	private defaultHeaders: Record<string, string>
	private requestInterceptors: RequestInterceptor[] = []
	private responseInterceptors: ResponseInterceptor[] = []

	constructor(config: ApiClientConfig = {}) {
		this.baseURL = config.baseURL ?? '/api'
		this.defaultHeaders = {
			'Content-Type': 'application/json',
			...config.defaultHeaders,
		}
	}

	/**
	 * Add a request interceptor
	 */
	addRequestInterceptor(interceptor: RequestInterceptor): void {
		this.requestInterceptors.push(interceptor)
	}

	/**
	 * Add a response interceptor
	 */
	addResponseInterceptor(interceptor: ResponseInterceptor): void {
		this.responseInterceptors.push(interceptor)
	}

	/**
	 * Apply all request interceptors
	 */
	private async applyRequestInterceptors(config: RequestInit): Promise<RequestInit> {
		let result = config
		for (const interceptor of this.requestInterceptors) {
			result = await interceptor(result)
		}
		return result
	}

	/**
	 * Apply all response interceptors
	 */
	private async applyResponseInterceptors(response: Response): Promise<Response> {
		let result = response
		for (const interceptor of this.responseInterceptors) {
			result = await interceptor(result)
		}
		return result
	}

	/**
	 * Build full URL from endpoint
	 */
	private buildURL(
		endpoint: string,
		queryParams?: Record<string, string | number | boolean | undefined>
	): string {
		const url = endpoint.startsWith('/')
			? `${this.baseURL}${endpoint}`
			: `${this.baseURL}/${endpoint}`

		if (queryParams) {
			const params = new URLSearchParams()
			Object.entries(queryParams).forEach(([key, value]) => {
				if (value !== undefined && value !== null) {
					params.set(key, String(value))
				}
			})
			const queryString = params.toString()
			return queryString ? `${url}?${queryString}` : url
		}

		return url
	}

	/**
	 * Handle error responses consistently
	 */
	private async handleError(
		response: Response,
		baseMessage: string = 'Request failed'
	): Promise<never> {
		const errorMessage = await buildErrorMessage(baseMessage, response)
		const error = new Error(errorMessage)
		// Attach response for potential error handling
		;(error as Error & { response?: Response }).response = response
		throw error
	}

	/**
	 * Make a request with consistent error handling
	 */
	private async request<T>(
		endpoint: string,
		options: RequestInit = {},
		baseErrorMessage?: string,
		queryParams?: Record<string, string | number | boolean | undefined>
	): Promise<T> {
		const url = this.buildURL(endpoint, queryParams)

		// Merge default headers with provided headers
		const headers = {
			...this.defaultHeaders,
			...options.headers,
		}

		// Build initial config
		let config: RequestInit = {
			...options,
			headers,
			credentials: 'include', // Always include credentials
		}

		// Apply request interceptors
		config = await this.applyRequestInterceptors(config)

		// Make the request
		const response = await fetch(url, config)

		// Apply response interceptors
		const interceptedResponse = await this.applyResponseInterceptors(response)

		// Handle error responses
		if (!interceptedResponse.ok) {
			await this.handleError(interceptedResponse, baseErrorMessage)
		}

		// Parse JSON response
		try {
			return await interceptedResponse.json()
		} catch (_error) {
			// If response is empty or not JSON, return empty object
			if (
				interceptedResponse.status === 204 ||
				interceptedResponse.headers.get('content-length') === '0'
			) {
				return {} as T
			}
			throw new Error('Failed to parse response as JSON')
		}
	}

	/**
	 * GET request
	 */
	async get<T>(
		endpoint: string,
		queryParams?: Record<string, string | number | boolean | undefined>,
		options?: RequestInit,
		baseErrorMessage?: string
	): Promise<T> {
		return this.request<T>(
			endpoint,
			{ ...options, method: 'GET' },
			baseErrorMessage,
			queryParams
		)
	}

	/**
	 * POST request
	 */
	async post<T>(
		endpoint: string,
		body?: unknown,
		options?: RequestInit,
		baseErrorMessage?: string
	): Promise<T> {
		return this.request<T>(
			endpoint,
			{
				...options,
				method: 'POST',
				body: body ? JSON.stringify(body) : undefined,
			},
			baseErrorMessage
		)
	}

	/**
	 * PUT request
	 */
	async put<T>(
		endpoint: string,
		body?: unknown,
		options?: RequestInit,
		baseErrorMessage?: string
	): Promise<T> {
		return this.request<T>(
			endpoint,
			{
				...options,
				method: 'PUT',
				body: body ? JSON.stringify(body) : undefined,
			},
			baseErrorMessage
		)
	}

	/**
	 * PATCH request
	 */
	async patch<T>(
		endpoint: string,
		body?: unknown,
		options?: RequestInit,
		baseErrorMessage?: string
	): Promise<T> {
		return this.request<T>(
			endpoint,
			{
				...options,
				method: 'PATCH',
				body: body ? JSON.stringify(body) : undefined,
			},
			baseErrorMessage
		)
	}

	/**
	 * DELETE request
	 */
	async delete<T>(
		endpoint: string,
		options?: RequestInit,
		baseErrorMessage?: string
	): Promise<T> {
		return this.request<T>(
			endpoint,
			{
				...options,
				method: 'DELETE',
			},
			baseErrorMessage
		)
	}
}

// Export singleton instance
export const api = new ApiClient()

// Export class for testing or custom instances
export { ApiClient }
