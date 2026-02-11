/**
 * Input Sanitization
 * Sanitizes user-generated HTML content to prevent XSS attacks
 */

import DOMPurify from 'isomorphic-dompurify'

/**
 * Sanitizes plain text (strips all HTML)
 * @param input - Raw text that may contain HTML
 * @returns Plain text with all HTML removed
 */
export function sanitizeText(input: string): string {
	return DOMPurify.sanitize(input, {
		ALLOWED_TAGS: [],
		ALLOWED_ATTR: [],
	})
}

/**
 * Sanitizes a URL to ensure it uses a safe protocol (http/https)
 * Preserves undefined to avoid overwriting fields in partial updates.
 * @param url - The URL to sanitize
 * @returns The URL if safe, null if unsafe/invalid/null, undefined if input was undefined
 */
export function sanitizeUrl(url: undefined): undefined
export function sanitizeUrl(url: string | null): string | null
export function sanitizeUrl(url: string | undefined): string | undefined
export function sanitizeUrl(url: string | null | undefined): string | null | undefined {
	if (url === undefined) {
		return undefined
	}
	if (!url) {
		return null
	}
	try {
		const parsed = new URL(url)
		if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
			return url
		}
		return null
	} catch {
		return null
	}
}
