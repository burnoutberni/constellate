/**
 * SSRF Protection
 * Validates URLs to prevent Server-Side Request Forgery attacks
 */

const PRIVATE_IP_RANGES = [
    /^127\./,                    // 127.0.0.0/8 - Loopback
    /^10\./,                     // 10.0.0.0/8 - Private
    /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12 - Private
    /^192\.168\./,               // 192.168.0.0/16 - Private
    /^169\.254\./,               // 169.254.0.0/16 - Link-local
    /^::1$/,                     // IPv6 loopback
    /^fe80:/,                    // IPv6 link-local
    /^fc00:/,                    // IPv6 unique local
    /^fd00:/,                    // IPv6 unique local
]

const ALLOWED_PROTOCOLS = ['http:', 'https:']

/**
 * Validates a URL to prevent SSRF attacks
 * @param urlString - The URL to validate
 * @returns True if the URL is safe to fetch
 */
export function isUrlSafe(urlString: string): boolean {
    try {
        const url = new URL(urlString)

        // Check protocol
        if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
            return false
        }

        // In development, allow localhost and .local domains (for Docker federation testing)
        if (process.env.NODE_ENV === 'development') {
            if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname.endsWith('.local')) {
                return true
            }
        }

        // Check for private IP ranges
        const hostname = url.hostname

        // Check if it's an IP address
        if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
            for (const range of PRIVATE_IP_RANGES) {
                if (range.test(hostname)) {
                    return false
                }
            }
        }

        // Check for IPv6
        if (hostname.includes(':')) {
            for (const range of PRIVATE_IP_RANGES) {
                if (range.test(hostname)) {
                    return false
                }
            }
        }

        // Check for localhost variations (only in production)
        if (hostname === 'localhost' || hostname.endsWith('.local')) {
            return false
        }

        return true
    } catch (error) {
        // Invalid URL
        return false
    }
}

/**
 * Validates and fetches a URL with SSRF protection
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @returns Fetch response
 * @throws Error if URL is not safe
 */
export async function safeFetch(
    url: string,
    options?: RequestInit
): Promise<Response> {
    if (!isUrlSafe(url)) {
        throw new Error(`URL is not safe to fetch: ${url}`)
    }

    return fetch(url, options)
}
