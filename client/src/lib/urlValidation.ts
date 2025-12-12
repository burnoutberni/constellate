/**
 * URL Validation Utilities
 * Provides safe URL validation to prevent XSS attacks via malicious URL schemes
 */

import { logger } from './logger'

/**
 * Validates that a URL is safe for navigation
 * Only allows:
 * - http:// and https:// for external URLs
 * - Relative paths (starting with /) for internal navigation
 *
 * Blocks:
 * - javascript: URLs
 * - data: URLs
 * - Other non-HTTP schemes
 *
 * @param url - The URL to validate
 * @returns True if the URL is safe for navigation, false otherwise
 */
export function isSafeNavigationUrl(url: string): boolean {
    if (!url || typeof url !== 'string') {
        return false
    }

    // Trim whitespace
    const trimmed = url.trim()
    if (!trimmed) {
        return false
    }

    // Allow relative paths (internal navigation)
    if (trimmed.startsWith('/')) {
        // Check if it contains a protocol scheme (like javascript: or data:)
        // Allow colons in query strings (?key=value:something), fragments (#section:1), and path segments
        const colonIndex = trimmed.indexOf(':')
        if (colonIndex === -1) {
            // No colon, definitely safe
            return true
        }
        // If colon exists, check if it's part of a protocol scheme
        // A protocol would appear as /protocol:something where protocol has no special chars
        const beforeColon = trimmed.substring(1, colonIndex) // Skip leading /
        // Check if beforeColon looks like a protocol name (alphanumeric, no /, ?, #)
        if (beforeColon.length > 0 && /^[a-zA-Z0-9+.-]+$/.test(beforeColon)) {
            // This looks like a protocol attempt (e.g., /javascript:alert, /data:text)
            return false
        }
        // Colon is in path segment, query, or fragment - safe
        return true
    }

    // For absolute URLs, check the protocol
    try {
        const urlObj = new URL(trimmed)
        // Only allow http and https protocols
        return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
    } catch {
        // Invalid URL format
        return false
    }
}

/**
 * Safely navigates to a URL, either as an external link or internal route
 * @param url - The URL to navigate to
 * @param navigate - React Router navigate function for internal navigation
 * @returns True if navigation was successful, false if URL was invalid
 */
export function safeNavigate(
    url: string,
    navigate: (path: string) => void,
): boolean {
    if (!isSafeNavigationUrl(url)) {
        logger.warn('Blocked unsafe URL:', url)
        return false
    }

    // Trim the URL for consistent processing (validation already checked trimmed version)
    const trimmed = url.trim()

    // Check if it's an external URL (http/https)
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        window.location.href = trimmed
        return true
    }

    // Otherwise, it's a relative path - use React Router navigation
    navigate(trimmed)
    return true
}
