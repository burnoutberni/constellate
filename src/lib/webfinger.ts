import { safeFetch } from './ssrfProtection.js'
import { ContentType } from '../constants/activitypub.js'

/**
 * Resolves a WebFinger resource
 * @param resource - Resource identifier (e.g., acct:user@domain)
 * @returns Actor URL
 */
export async function resolveWebFinger(resource: string): Promise<string | null> {
	try {
		// Parse resource (acct:username@domain)
		const match = resource.match(/^acct:([^@]+)@(.+)$/)
		if (!match) {
			return null
		}

		const [, , domain] = match

		// Use http:// for .local domains in development, https:// otherwise
		const protocol =
			process.env.NODE_ENV === 'development' && domain.endsWith('.local') ? 'http' : 'https'
		const webfingerUrl = `${protocol}://${domain}/.well-known/webfinger?resource=${encodeURIComponent(resource)}`

		const response = await safeFetch(webfingerUrl, {
			headers: {
				Accept: ContentType.JSON,
			},
		})

		if (!response.ok) {
			return null
		}

		const data = (await response.json()) as {
			links?: Array<{ rel: string; type?: string; href?: string }>
		}

		// Find the ActivityPub link
		const apLink = data.links?.find(
			(link) => link.rel === 'self' && link.type === ContentType.ACTIVITY_JSON
		)

		return apLink?.href || null
	} catch (error) {
		console.error('WebFinger resolution error:', error)
		return null
	}
}
