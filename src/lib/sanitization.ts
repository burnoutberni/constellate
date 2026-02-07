/**
 * Input Sanitization
 * Sanitizes user-generated HTML content to prevent XSS attacks
 */

import DOMPurify from 'isomorphic-dompurify'

// Regular expression to match external URLs (http://, https://, or protocol-relative //)
const EXTERNAL_URL_REGEX = /^(https?:\/\/|\/\/)/i

// Interface for JSDOM Element used by isomorphic-dompurify
interface SanitizeElement {
	tagName: string
	hasAttribute(name: string): boolean
	getAttribute(name: string): string | null
	setAttribute(name: string, value: string): void
}

// Hook function to add security attributes to external links
// specific to JSDOM environment used by isomorphic-dompurify
function addExternalLinkSecurity(node: unknown) {
	// Cast to our interface to satisfy linter
	const element = node as SanitizeElement

	if (element.tagName === 'A' && element.hasAttribute('href')) {
		const href = element.getAttribute('href')
		if (href && EXTERNAL_URL_REGEX.test(href)) {
			element.setAttribute('target', '_blank')
			element.setAttribute('rel', 'noopener noreferrer')
		}
	}
}

// Register hook at module level for SafeHTML sanitization
DOMPurify.addHook('afterSanitizeAttributes', addExternalLinkSecurity)

// DOMPurify configuration for safe HTML sanitization
// This allows common formatting tags like <p>, <strong>, <em>, <br>, <a>, etc.
// but blocks dangerous tags like <script>, <iframe>, etc.
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
export function sanitizeText(input: string | null | undefined): string {
	if (!input) return ''
	return DOMPurify.sanitize(input, {
		ALLOWED_TAGS: [],
		ALLOWED_ATTR: [],
	})
}

/**
 * Sanitizes HTML content using a safe configuration (allows basic formatting)
 * @param input - Raw HTML content
 * @returns Sanitized HTML with dangerous tags removed
 */
export function sanitizeHtml(input: string | null | undefined): string {
	if (!input) return ''
	return DOMPurify.sanitize(input, DOMPURIFY_CONFIG)
}
