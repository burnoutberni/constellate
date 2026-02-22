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
 * Sanitizes HTML content, allowing a safe subset of tags and attributes
 * @param input - Raw HTML content
 * @returns Sanitized HTML safe for storage/display
 */
export function sanitizeHtml(input: string): string {
	return DOMPurify.sanitize(input, {
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
	})
}
