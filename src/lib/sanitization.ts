/**
 * Input Sanitization
 * Sanitizes user-generated HTML content to prevent XSS attacks
 */

import DOMPurify from 'isomorphic-dompurify'

// Allowed tags for safe HTML (matching frontend SafeHTML component)
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

// Regular expression to match external URLs
const EXTERNAL_URL_REGEX = /^(https?:\/\/|\/\/)/i

// Define a minimal interface for the DOM element since we don't have DOM types in Node environment
interface SanitizeElement {
	tagName: string
	hasAttribute(name: string): boolean
	getAttribute(name: string): string | null
	setAttribute(name: string, value: string): void
}

// Hook to add security attributes to external links
DOMPurify.addHook('afterSanitizeAttributes', (currentNode) => {
	// Cast to our minimal interface since we don't have DOM types
	const node = currentNode as unknown as SanitizeElement

	if (node.tagName === 'A' && node.hasAttribute('href')) {
		const href = node.getAttribute('href')
		if (href && EXTERNAL_URL_REGEX.test(href)) {
			node.setAttribute('target', '_blank')
			node.setAttribute('rel', 'noopener noreferrer')
		}
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
 * Sanitizes HTML content while preserving safe tags
 * @param input - Raw HTML content
 * @returns Sanitized HTML with dangerous tags removed
 */
export function sanitizeHtml(input: string): string {
	return DOMPurify.sanitize(input, {
		ALLOWED_TAGS,
		ALLOWED_ATTR,
		ALLOWED_URI_REGEXP: /^(https?:|mailto:|tel:|\/)/i,
	})
}
