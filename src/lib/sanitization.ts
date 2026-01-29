/**
 * Input Sanitization
 * Sanitizes user-generated HTML content to prevent XSS attacks
 */

import DOMPurify from 'isomorphic-dompurify'

// Allowed tags matching frontend SafeHTML component
const ALLOWED_TAGS = [
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
]

const ALLOWED_ATTR = ['href', 'title', 'target', 'rel']

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
 * Sanitizes HTML content (allows safe tags)
 * @param input - Raw HTML content
 * @returns Sanitized HTML with only allowed tags and attributes
 */
export function sanitizeHtml(input: string): string {
	return DOMPurify.sanitize(input, {
		ALLOWED_TAGS,
		ALLOWED_ATTR,
		ALLOWED_URI_REGEXP: /^(https?:|mailto:|tel:|\/)/i,
	})
}
