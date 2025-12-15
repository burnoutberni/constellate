import DOMPurify from 'dompurify'
import { useMemo, type ElementType } from 'react'

// Regular expression to match external URLs (http://, https://, or protocol-relative //)
const EXTERNAL_URL_REGEX = /^(https?:\/\/|\/\/)/i

// Add hook once at module level to modify external links during sanitization
// This runs synchronously during sanitization, avoiding hydration mismatches
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
	// Add target="_blank" and rel="noopener noreferrer" to external links
	if (node.tagName === 'A' && node.hasAttribute('href')) {
		const href = node.getAttribute('href')
		if (href && EXTERNAL_URL_REGEX.test(href)) {
			node.setAttribute('target', '_blank')
			node.setAttribute('rel', 'noopener noreferrer')
		}
	}
})

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
	ALLOWED_URI_REGEXP:
		/^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix):|[^a-z]|[a-z+\-.]+(?:[^a-z+.\-:]|$))/i,
}

/**
 * SafeHTML component renders HTML content after sanitizing it with DOMPurify
 * to prevent XSS attacks. Only safe HTML tags and attributes are allowed.
 *
 * @example
 * ```tsx
 * <SafeHTML html="<p>Hello <strong>world</strong>!</p>" />
 * ```
 */
export function SafeHTML({ html, className, tag: Tag = 'div' }: SafeHTMLProps) {
	const sanitizedHTML = useMemo(() => {
		if (!html) {
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
