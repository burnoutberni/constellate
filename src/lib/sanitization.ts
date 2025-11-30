/**
 * Input Sanitization
 * Sanitizes user-generated HTML content to prevent XSS attacks
 */

import DOMPurify from 'isomorphic-dompurify'

/**
 * Sanitizes HTML content to prevent XSS attacks
 * @param input - Raw HTML string
 * @returns Sanitized HTML string
 */
export function sanitizeHtml(input: string): string {
    return DOMPurify.sanitize(input, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
        ALLOWED_ATTR: ['href', 'rel', 'target'],
        ALLOW_DATA_ATTR: false,
    })
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
