/**
 * Input Sanitization
 * Sanitizes user-generated HTML content to prevent XSS attacks
 */

import DOMPurify from 'isomorphic-dompurify'

// Add hook to enforce target="_blank" and rel="noopener noreferrer" on all links
// This prevents reverse tabnabbing and ensures external links open in new tabs
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
	if ('target' in node) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
		;(node as any).setAttribute('target', '_blank')
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
		;(node as any).setAttribute('rel', 'noopener noreferrer')
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
 * Sanitizes HTML content, allowing safe tags and enforcing security attributes on links
 * @param input - Raw HTML content
 * @returns Sanitized HTML safe for rendering
 */
export function sanitizeHtml(input: string): string {
	return DOMPurify.sanitize(input, {
		ALLOWED_TAGS: [
			'p',
			'br',
			'span',
			'a',
			'b',
			'i',
			'strong',
			'em',
			'ul',
			'ol',
			'li',
			'blockquote',
			'code',
			'pre',
			'h1',
			'h2',
			'h3',
			'h4',
			'h5',
			'h6',
			'img',
		],
		ALLOWED_ATTR: ['href', 'title', 'src', 'alt', 'class', 'rel', 'target'],
	})
}
