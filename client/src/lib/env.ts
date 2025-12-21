/**
 * Environment utilities
 * Exported as functions to allow mocking in tests
 */

/**
 * Returns true if running in development mode
 */
export function isDevelopment(): boolean {
	return import.meta.env.DEV
}

