/**
 * Test helpers for debugging test failures
 */

interface ErrorResponseBody {
	error?: string
	message?: string
	stack?: string
	details?: unknown
}

/**
 * Logs the response body when a test receives an error status code
 * This helps identify what's causing 500 errors in tests
 */
export async function logErrorResponse(
	res: Response,
	testName?: string
): Promise<void> {
	if (!res.ok) {
		try {
			const body = (await res.clone().json()) as ErrorResponseBody
			console.error(`[Test Error] ${testName || 'Unknown test'}:`, {
				status: res.status,
				error: body.error,
				message: body.message,
				stack: body.stack?.split('\n').slice(0, 10).join('\n'),
				details: body.details,
			})
		} catch {
			// If response isn't JSON, try text
			try {
				const text = await res.clone().text()
				console.error(`[Test Error] ${testName || 'Unknown test'}:`, {
					status: res.status,
					body: text.substring(0, 500), // First 500 chars
				})
			} catch {
				console.error(`[Test Error] ${testName || 'Unknown test'}:`, {
					status: res.status,
					body: 'Could not parse response',
				})
			}
		}
	}
}

/**
 * Helper to check Prismock data state
 * Useful for debugging data isolation issues
 */
export function inspectPrismockData(prismaMock: any): {
	models: string[]
	counts: Record<string, number>
} {
	if (!prismaMock || typeof prismaMock.getData !== 'function') {
		return { models: [], counts: {} }
	}

	const data = prismaMock.getData()
	const models = Object.keys(data)
	const counts: Record<string, number> = {}

	for (const model of models) {
		counts[model] = Array.isArray(data[model]) ? data[model].length : 0
	}

	return { models, counts }
}

