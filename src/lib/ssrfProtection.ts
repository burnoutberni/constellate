/**
 * SSRF Protection
 * Validates URLs to prevent Server-Side Request Forgery attacks
 */



const ALLOWED_PROTOCOLS = ['http:', 'https:']

/**
 * Checks if an IP address is in a private range
 * @param ip - IP address to check (IPv4 or IPv6)
 * @returns True if IP is private
 */
function isPrivateIP(ip: string): boolean {
    // IPv4 private ranges
    const ipv4Patterns = [
        /^127\./,                    // Loopback
        /^10\./,                     // Private
        /^172\.(1[6-9]|2\d|3[01])\./, // Private
        /^192\.168\./,               // Private
        /^169\.254\./,               // Link-local
        /^0\./,                      // Current network
    ]

    // IPv6 private ranges
    const ipv6Patterns = [
        /^::1$/,                     // Loopback
        /^fe80:/i,                   // Link-local
        /^fc00:/i,                   // Unique local
        /^fd00:/i,                   // Unique local
        /^::ffff:127\./i,            // IPv4-mapped loopback
        /^::ffff:10\./i,             // IPv4-mapped private
        /^::ffff:172\.(1[6-9]|2\d|3[01])\./i, // IPv4-mapped private
        /^::ffff:192\.168\./i,       // IPv4-mapped private
    ]

    for (const pattern of [...ipv4Patterns, ...ipv6Patterns]) {
        if (pattern.test(ip)) {
            return true
        }
    }

    return false
}

/**
 * Validates a URL to prevent SSRF attacks with DNS resolution
 * @param urlString - The URL to validate
 * @returns True if the URL is safe to fetch
 */
export async function isUrlSafe(urlString: string): Promise<boolean> {
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

        // Check for private IP ranges in hostname
        const hostname = url.hostname

        // Check if it's an IP address
        if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
            if (isPrivateIP(hostname)) {
                console.error(`[SSRF] Blocked private IPv4: ${hostname}`)
                return false
            }
        }

        // Check for IPv6 (handle bracketed format like [::1])
        if (hostname.includes(':')) {
            // Remove brackets if present for IPv6 addresses
            const normalizedHostname = hostname.startsWith('[') && hostname.endsWith(']')
                ? hostname.slice(1, -1)
                : hostname

            if (isPrivateIP(normalizedHostname)) {
                console.error(`[SSRF] Blocked private IPv6: ${normalizedHostname}`)
                return false
            }
        }

        // Check for localhost variations (only in production)
        if (hostname === 'localhost' || hostname.endsWith('.local')) {
            console.error(`[SSRF] Blocked localhost variation: ${hostname}`)
            return false
        }

        // Resolve DNS and check all IPs (skip in development for .local domains)
        if (process.env.NODE_ENV !== 'development' || !hostname.endsWith('.local')) {
            try {
                const dns = await import('dns/promises')

                // Try to resolve both IPv4 and IPv6
                const ipv4Addresses = await dns.resolve4(hostname).catch(() => [] as string[])
                const ipv6Addresses = await dns.resolve6(hostname).catch(() => [] as string[])

                const allAddresses = [...ipv4Addresses, ...ipv6Addresses]

                // If we got no addresses, the hostname doesn't resolve
                if (allAddresses.length === 0) {
                    console.error(`[SSRF] Hostname does not resolve: ${hostname}`)
                    return false
                }

                // Check each resolved IP
                for (const ip of allAddresses) {
                    if (isPrivateIP(ip)) {
                        console.error(`[SSRF] Blocked private IP from DNS: ${ip} for ${hostname}`)
                        return false
                    }
                }
            } catch (error) {
                // DNS resolution failed - block by default
                console.error(`[SSRF] DNS resolution failed for: ${hostname}`, error)
                return false
            }
        }

        return true
    } catch {
        // Invalid URL
        return false
    }
}

/**
 * Validates and fetches a URL with SSRF protection, redirect handling, and timeout
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @param timeoutMs - Request timeout in milliseconds (default: 30 seconds)
 * @param maxRedirects - Maximum number of redirects to follow (default: 5)
 * @returns Fetch response
 * @throws Error if URL is not safe or request times out
 */
export async function safeFetch(
    url: string,
    options?: RequestInit,
    timeoutMs: number = 30000, // 30 seconds default
    maxRedirects: number = 5
): Promise<Response> {
    let currentUrl = url
    let redirectCount = 0

    while (redirectCount <= maxRedirects) {
        // Validate current URL
        if (!await isUrlSafe(currentUrl)) {
            throw new Error(`URL is not safe to fetch: ${currentUrl}`)
        }

        // Create AbortController for timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

        try {
            const response = await fetch(currentUrl, {
                ...options,
                signal: controller.signal,
                redirect: 'manual', // Handle redirects manually
            })
            clearTimeout(timeoutId)

            // Check for redirects
            if (response.status >= 300 && response.status < 400) {
                const location = response.headers.get('location')
                if (!location) {
                    throw new Error('Redirect without location header')
                }

                // Resolve relative URLs
                currentUrl = new URL(location, currentUrl).toString()
                redirectCount++

                console.log(`[SSRF] Following redirect ${redirectCount}/${maxRedirects}: ${currentUrl}`)
                continue
            }

            return response
        } catch (error: unknown) {
            clearTimeout(timeoutId)
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error(`Request timeout after ${timeoutMs}ms: ${currentUrl}`)
            }
            throw error
        }
    }

    throw new Error(`Too many redirects (max ${maxRedirects})`)
}
