/**
 * Input Sanitization
 * Sanitizes user-generated HTML content to prevent XSS attacks
 */

import DOMPurify from 'isomorphic-dompurify'

// DOMPurify configuration for safe HTML sanitization
// Matches frontend configuration in client/src/components/ui/SafeHTML.tsx
const DOMPURIFY_CONFIG = {
	ALLOWED_TAGS: [
		'p',
		'br',
		'strong',
		'b',
		'em',
		'i',
		'u',
		's',
		'strike',
		'del',
		'h1',
		'h2',
		'h3',
		'h4',
		'h5',
		'h6',
		'ul',
		'ol',
		'li',
		'a',
		'blockquote',
		'pre',
		'code',
		'span',
		'div',
	],
	ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
	ALLOWED_URI_REGEXP: /^(https?:|mailto:|tel:|\/)/i,
}

/**
 * Sanitizes plain text (strips all HTML)
 * @param input - Raw text that may contain HTML
 * @returns Plain text with all HTML removed
 */
export function sanitizeText(input: string | null | undefined): string | null {
	if (input === null || input === undefined) return null
	return DOMPurify.sanitize(input, {
		ALLOWED_TAGS: [],
		ALLOWED_ATTR: [],
	})
}

/**
 * Sanitizes HTML content using a safe whitelist
 * Preserves rich text formatting while removing scripts and unsafe elements
 * @param input - Raw HTML content
 * @returns Sanitized HTML or null if input is null/undefined
 */
export function sanitizeHtml(input: string | null | undefined): string | null {
	if (input === null || input === undefined) return null
	return DOMPurify.sanitize(input, DOMPURIFY_CONFIG)
}
