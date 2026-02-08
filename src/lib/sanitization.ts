/**
 * Input Sanitization
 * Sanitizes user-generated HTML content to prevent XSS attacks
 */

import DOMPurify from 'isomorphic-dompurify'

// Enforce target="_blank" and rel="noopener noreferrer" on all links
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
	// Cast node to Element to access setAttribute safely
	// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
	const el: any = node
	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
	if ('target' in el && typeof el.setAttribute === 'function') {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		el.setAttribute('target', '_blank')
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		el.setAttribute('rel', 'noopener noreferrer')
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
 * Sanitizes HTML content (allows safe tags and attributes)
 * @param input - Raw HTML content
 * @returns Sanitized HTML with only safe tags/attributes
 */
export function sanitizeHtml(input: string): string {
	return DOMPurify.sanitize(input, {
		ALLOWED_TAGS: [
			'b',
			'i',
			'em',
			'strong',
			'a',
			'p',
			'br',
			'ul',
			'ol',
			'li',
			'span',
			'blockquote',
			'h1',
			'h2',
			'h3',
			'h4',
			'h5',
			'h6',
			'img',
			'code',
			'pre',
		],
		ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'alt', 'title', 'src', 'width', 'height'],
	})
}
