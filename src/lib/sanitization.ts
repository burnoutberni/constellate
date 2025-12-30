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

// Configuration for safe HTML sanitization
// Matches the frontend configuration in client/src/components/ui/SafeHTML.tsx
// This allows common formatting tags like <p>, <strong>, <em>, <br>, <a>, etc.
// but blocks dangerous tags like <script>, <iframe>, etc.
const RICH_TEXT_CONFIG = {
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
 * Sanitizes rich text (allows safe HTML tags)
 * Use this for content like event summaries, comments, and bios
 * where basic formatting is desired but XSS must be prevented.
 *
 * @param input - Raw HTML content
 * @returns Sanitized HTML with only safe tags and attributes
 */
export function sanitizeRichText(input: string): string {
	return DOMPurify.sanitize(input, RICH_TEXT_CONFIG)
}

// Register the hook once globally to avoid repeated additions
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
	if (node.tagName === 'A' && node.hasAttribute('href')) {
		const href = node.getAttribute('href')
		if (href && /^(https?:\/\/|\/\/)/i.test(href)) {
			node.setAttribute('target', '_blank')
			node.setAttribute('rel', 'noopener noreferrer')
		}
	}
})
