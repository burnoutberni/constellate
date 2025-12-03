/**
 * HTTP test helpers
 * Provides utilities for making HTTP requests in tests
 */

import { Hono } from 'hono'

/**
 * Make a test request to the app
 */
export async function makeRequest(
    app: Hono,
    path: string,
    options?: {
        method?: string
        headers?: Record<string, string>
        body?: any
    }
) {
    const method = options?.method || 'GET'
    const headers = options?.headers || {}
    const body = options?.body

    return await app.request(path, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    })
}

/**
 * Assert response status
 */
export function expectStatus(response: Response, status: number) {
    if (response.status !== status) {
        throw new Error(`Expected status ${status}, got ${response.status}`)
    }
}

/**
 * Assert response JSON
 */
export async function expectJson(response: Response, expected: any) {
    const body = await response.json() as any
    if (JSON.stringify(body) !== JSON.stringify(expected)) {
        throw new Error(`Expected JSON ${JSON.stringify(expected)}, got ${JSON.stringify(body)}`)
    }
}

