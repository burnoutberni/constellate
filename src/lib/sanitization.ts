/**
 * Input Sanitization
 * Sanitizes user-generated HTML content to prevent XSS attacks
 */

import DOMPurify from 'isomorphic-dompurify'

// Regular expression to match external URLs (http://, https://, or protocol-relative //)
const EXTERNAL_URL_REGEX = /^(https?:\/\/|\/\/)/i

// Define a minimal interface for the DOM node since we don't have global DOM types
interface SanitizationNode {
	tagName: string
	getAttribute(name: string): string | null
	setAttribute(name: string, value: string): void
}

// Hook function to add security attributes to external links
// This ensures that links in sanitized content are safe
DOMPurify.addHook('afterSanitizeAttributes', (currentNode) => {
	// Cast to unknown first then to our interface to satisfy TypeScript
	// We rely on runtime checks to ensure safety
	const node = currentNode as unknown as SanitizationNode

	// Check if node is an Element (has tagName and getAttribute)
	if ('tagName' in node && node.tagName === 'A' && 'getAttribute' in node) {
		const href = node.getAttribute('href')
		if (href && EXTERNAL_URL_REGEX.test(href)) {
			node.setAttribute('target', '_blank')
			node.setAttribute('rel', 'noopener noreferrer')
		}
	}
})

// DOMPurify configuration for safe HTML sanitization
// Matches the frontend configuration in client/src/components/ui/SafeHTML.tsx
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
export function sanitizeText(input: string): string {
	return DOMPurify.sanitize(input, {
		ALLOWED_TAGS: [],
		ALLOWED_ATTR: [],
	})
}

/**
 * Sanitizes HTML content while preserving safe tags and attributes
 * @param input - Raw HTML content
 * @returns Sanitized HTML with dangerous tags/attributes removed
 */
export function sanitizeHtml(input: string): string {
	return DOMPurify.sanitize(input, DOMPURIFY_CONFIG)
}
