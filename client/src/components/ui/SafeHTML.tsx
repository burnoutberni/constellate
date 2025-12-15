import DOMPurify from 'dompurify'
import { useMemo, type ElementType } from 'react'

// Regular expression to match external URLs (http://, https://, or protocol-relative //)
const EXTERNAL_URL_REGEX = /^(https?:\/\/|\/\/)/i

// Hook function to add security attributes to external links
// This is registered globally but only affects SafeHTML sanitization
// since SafeHTML is the only component using DOMPurify in the client
function addExternalLinkSecurity(node: Element) {
	if (node.tagName === 'A' && node.hasAttribute('href')) {
		const href = node.getAttribute('href')
		if (href && EXTERNAL_URL_REGEX.test(href)) {
			node.setAttribute('target', '_blank')
			node.setAttribute('rel', 'noopener noreferrer')
		}
	}
}

// Register hook at module level for SafeHTML sanitization
// Note: This is global, but SafeHTML is the only DOMPurify usage in the client
// If DOMPurify is used elsewhere, consider creating a scoped instance
DOMPurify.addHook('afterSanitizeAttributes', addExternalLinkSecurity)

export interface SafeHTMLProps {
	/**
	 * HTML content to safely render
	 */
	html: string | null | undefined
	/**
	 * Additional CSS classes to apply to the container
	 */
	className?: string
	/**
	 * HTML tag to use as the container (default: 'div')
	 */
	tag?: ElementType
}

// DOMPurify configuration for safe HTML sanitization
// This allows common formatting tags like <p>, <strong>, <em>, <br>, <a>, etc.
// but blocks dangerous tags like <script>, <iframe>, etc.
// The afterSanitizeAttributes hook (added at module level) will automatically
// add target="_blank" and rel="noopener noreferrer" to external links
//
// ALLOWED_URI_REGEXP explanation:
// - Allows safe protocols: http, https, mailto, tel
// - Allows relative URLs (starting with /)
// - DOMPurify automatically blocks dangerous protocols like javascript:, data:, etc.
const DOMPURIFY_CONFIG = {
	ALLOWED_TAGS: [
		'p',
		'br',
		'strong',
		'em',
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
	// Only allow safe, commonly-used protocols for event summaries
	// DOMPurify automatically blocks javascript:, data:, and other dangerous protocols
	// This tighter regex reduces attack surface while supporting common use cases
	ALLOWED_URI_REGEXP: /^(https?:|mailto:|tel:|\/)/i,
}

/**
 * SafeHTML component renders HTML content after sanitizing it with DOMPurify
 * to prevent XSS attacks. Only safe HTML tags and attributes are allowed.
 *
 * Note: This component is client-only and requires a browser environment.
 * The wrapper tag defaults to 'div' but can be customized (e.g., 'p' for paragraphs).
 * Be aware that changing the tag may affect CSS styling (margins, line-height, etc.).
 *
 * @example
 * ```tsx
 * <SafeHTML html="<p>Hello <strong>world</strong>!</p>" />
 * <SafeHTML html="<p>Content</p>" tag="p" className="text-lg" />
 * ```
 */
export function SafeHTML({ html, className, tag: Tag = 'div' }: SafeHTMLProps) {
	const sanitizedHTML = useMemo(() => {
		if (!html) {
			return ''
		}

		// Guard against non-browser environments (defensive programming)
		if (typeof window === 'undefined') {
			// In SSR/non-browser environments, return empty string
			// This component is designed for client-side only
			return ''
		}

		return DOMPurify.sanitize(html, DOMPURIFY_CONFIG)
	}, [html])

	// If no HTML content, return null
	if (!sanitizedHTML) {
		return null
	}

	return <Tag className={className} dangerouslySetInnerHTML={{ __html: sanitizedHTML }} />
}
