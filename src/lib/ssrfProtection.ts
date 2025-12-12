/**
 * SSRF Protection
 * Validates URLs to prevent Server-Side Request Forgery attacks
 */

const ALLOWED_PROTOCOLS = ['http:', 'https:']

function isAllowedProtocol(url: URL) {
	return ALLOWED_PROTOCOLS.includes(url.protocol)
}

function allowDevLocalhost(hostname: string) {
	return (
		process.env.NODE_ENV === 'development' &&
		(hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local'))
	)
}

function getPrivateHostnameReason(hostname: string): string | null {
	if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
		return isPrivateIP(hostname) ? `[SSRF] Blocked private IPv4: ${hostname}` : null
	}

	if (hostname.includes(':')) {
		const normalizedHostname =
			hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname
		return isPrivateIP(normalizedHostname)
			? `[SSRF] Blocked private IPv6: ${normalizedHostname}`
			: null
	}

	if (hostname === 'localhost' || hostname.endsWith('.local')) {
		return `[SSRF] Blocked localhost variation: ${hostname}`
	}

	return null
}

function shouldSkipDns(hostname: string) {
	return process.env.NODE_ENV === 'development' && hostname.endsWith('.local')
}

async function resolveAndValidateDns(hostname: string): Promise<string | null> {
	try {
		const dns = await import('dns/promises')
		const ipv4Addresses = await dns.resolve4(hostname).catch(() => [] as string[])
		const ipv6Addresses = await dns.resolve6(hostname).catch(() => [] as string[])
		const allAddresses = [...ipv4Addresses, ...ipv6Addresses]

		if (allAddresses.length === 0) {
			return `[SSRF] Hostname does not resolve: ${hostname}`
		}

		for (const ip of allAddresses) {
			if (isPrivateIP(ip)) {
				return `[SSRF] Blocked private IP from DNS: ${ip} for ${hostname}`
			}
		}
	} catch (error) {
		console.error(`[SSRF] DNS resolution failed for: ${hostname}`, error)
		return `[SSRF] DNS resolution failed for: ${hostname}`
	}

	return null
}

/**
 * Checks if an IP address is in a private range
 * @param ip - IP address to check (IPv4 or IPv6)
 * @returns True if IP is private
 */
function isPrivateIP(ip: string): boolean {
	// IPv4 private ranges
	const ipv4Patterns = [
		/^127\./, // Loopback
		/^10\./, // Private
		/^172\.(1[6-9]|2\d|3[01])\./, // Private
		/^192\.168\./, // Private
		/^169\.254\./, // Link-local
		/^0\./, // Current network
	]

	// IPv6 private ranges
	const ipv6Patterns = [
		/^::1$/, // Loopback
		/^fe80:/i, // Link-local
		/^fc00:/i, // Unique local
		/^fd00:/i, // Unique local
		/^::ffff:127\./i, // IPv4-mapped loopback
		/^::ffff:10\./i, // IPv4-mapped private
		/^::ffff:172\.(1[6-9]|2\d|3[01])\./i, // IPv4-mapped private
		/^::ffff:192\.168\./i, // IPv4-mapped private
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
		if (!isAllowedProtocol(url)) {
			return false
		}

		const hostname = url.hostname

		if (allowDevLocalhost(hostname)) {
			return true
		}

		const privateReason = getPrivateHostnameReason(hostname)
		if (privateReason) {
			console.error(privateReason)
			return false
		}

		if (!shouldSkipDns(hostname)) {
			const dnsBlockReason = await resolveAndValidateDns(hostname)
			if (dnsBlockReason) {
				console.error(dnsBlockReason)
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
		if (!(await isUrlSafe(currentUrl))) {
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

				console.log(
					`[SSRF] Following redirect ${redirectCount}/${maxRedirects}: ${currentUrl}`
				)
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
