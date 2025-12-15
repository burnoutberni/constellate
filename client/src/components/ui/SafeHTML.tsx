import DOMPurify from 'dompurify'
import { useMemo, useEffect, useRef, type ElementType } from 'react'

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
	const containerRef = useRef<HTMLElement>(null)

	const sanitizedHTML = useMemo(() => {
		if (!html) {
			return ''
		}

		// Configure DOMPurify to allow safe HTML tags and attributes
		// This allows common formatting tags like <p>, <strong>, <em>, <br>, <a>, etc.
		// but blocks dangerous tags like <script>, <iframe>, etc.
		const sanitized = DOMPurify.sanitize(html, {
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
				/^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+\-.]+(?:[^a-z+.\-:]|$))/i,
		})

		// Return sanitized HTML without post-processing to ensure SSR/CSR consistency
		// Post-processing will be done in useEffect after mount
		return sanitized
	}, [html])

	// Post-process the sanitized HTML after mount to add target="_blank" to external links
	// This ensures the initial render matches the server, avoiding hydration errors
	useEffect(() => {
		if (!containerRef.current) {
			return
		}

		// Find all external links and add target="_blank" and rel="noopener noreferrer"
		containerRef.current
			.querySelectorAll<HTMLAnchorElement>('a[href^="http"]')
			.forEach((link) => {
				link.setAttribute('target', '_blank')
				link.setAttribute('rel', 'noopener noreferrer')
			})
	}, [sanitizedHTML])

	// If no HTML content, return null
	if (!sanitizedHTML) {
		return null
	}

	return (
		<Tag
			ref={containerRef}
			className={className}
			dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
		/>
	)
}
