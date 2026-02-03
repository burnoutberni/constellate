/**
 * Input Sanitization
 * Sanitizes user-generated HTML content to prevent XSS attacks
 */

import DOMPurify from 'isomorphic-dompurify'

// Configure DOMPurify to enforce secure link attributes globally
// This hook ensures all links have target="_blank" and rel="noopener noreferrer"
// to prevent reverse tabnabbing and ensure external links open in new tabs.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
	if ('target' in node) {
		node.setAttribute('target', '_blank')
		node.setAttribute('rel', 'noopener noreferrer')
	}
})

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
 * Sanitizes HTML content (allows safe tags, strips scripts)
 * Enforces target="_blank" and rel="noopener noreferrer" on links
 * @param input - Raw HTML content
 * @returns Sanitized HTML
 */
export function sanitizeHtml(input: string): string {
	return DOMPurify.sanitize(input, {
		ALLOWED_TAGS: [
			'p',
			'br',
			'b',
			'i',
			'strong',
			'em',
			'a',
			'ul',
			'ol',
			'li',
			'blockquote',
			'code',
			'pre',
			'img',
			'h1',
			'h2',
			'h3',
			'h4',
			'h5',
			'h6',
			'span',
			'div',
		],
		ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'target', 'rel'],
	})
}
