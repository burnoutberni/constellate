/**
 * Input Sanitization
 * Sanitizes user-generated HTML content to prevent XSS attacks
 */

import DOMPurify from 'isomorphic-dompurify'

// Configuration for safe HTML sanitization
// Matches the client-side configuration in client/src/components/ui/SafeHTML.tsx
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

// Hook function to add security attributes to external links
// Same as in client/src/components/ui/SafeHTML.tsx
const EXTERNAL_URL_REGEX = /^(https?:\/\/|\/\/)/i

DOMPurify.addHook('afterSanitizeAttributes', (currentNode) => {
	// Use type assertion with unknown to safely cast to a compatible interface
	// This avoids "Unsafe member access on an error typed value" which happens
	// when typescript-eslint can't infer the type of currentNode from the library
	const node = currentNode as unknown as {
		tagName: string
		getAttribute: (name: string) => string | null
		setAttribute: (name: string, value: string) => void
		hasAttribute: (name: string) => boolean
	}

	// Defensive check
	if (!node || typeof node.tagName !== 'string') {
		return
	}

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
	if (!input) return ''
	return DOMPurify.sanitize(input, {
		ALLOWED_TAGS: [],
		ALLOWED_ATTR: [],
	})
}

/**
 * Sanitizes HTML content allowing only safe tags
 * @param input - Raw HTML content
 * @returns Sanitized HTML
 */
export function sanitizeHtml(input: string): string {
	if (!input) return ''
	return DOMPurify.sanitize(input, DOMPURIFY_CONFIG)
}
