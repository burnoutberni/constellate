import DOMPurify from 'dompurify'
import { useMemo, type ElementType } from 'react'

import { cn } from '../../lib/utils'

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
 * SafeHTML component renders HTML content after sanitizing it with DOMPurify
 * to prevent XSS attacks. Only safe HTML tags and attributes are allowed.
 *
 * It automatically applies prose typography styles for consistency.
 */
export function SafeHTML({ html, className, tag: Tag = 'div' }: SafeHTMLProps) {
	const sanitizedHTML = useMemo(() => {
		if (!html) {
			return ''
		}

		// Guard against non-browser environments (defensive programming)
		if (typeof window === 'undefined') {
			return ''
		}

		return DOMPurify.sanitize(html, DOMPURIFY_CONFIG)
	}, [html])

	// If no HTML content, return null
	if (!sanitizedHTML) {
		return null
	}

	return (
		<Tag
			className={cn(
				'prose prose-sm dark:prose-invert max-w-none',
				'prose-a:text-primary-600 dark:prose-a:text-primary-400 prose-a:no-underline hover:prose-a:underline',
				'prose-headings:font-semibold prose-headings:text-text-primary',
				'prose-p:text-text-secondary',
				'prose-strong:text-text-primary',
				'prose-code:text-primary-700 dark:prose-code:text-primary-300 prose-code:bg-primary-50 dark:prose-code:bg-primary-900/30 prose-code:px-1 prose-code:rounded',
				className
			)}
			dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
		/>
	)
}
