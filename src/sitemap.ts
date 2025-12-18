/**
 * Dynamic Sitemap Generation
 * Generates XML sitemap including static pages, public user profiles, and public events
 */

import { OpenAPIHono } from '@hono/zod-openapi'
import { prisma } from './lib/prisma.js'
import { config } from './config.js'

const app = new OpenAPIHono()

// Maximum URLs per sitemap (sitemap protocol limit is 50,000)
const MAX_URLS_PER_SITEMAP = 50000

// Static application pages with their priorities and change frequencies
const STATIC_PAGES = [
	{ path: '/', changefreq: 'daily', priority: '1.0' },
	{ path: '/about', changefreq: 'monthly', priority: '0.8' },
	{ path: '/discover', changefreq: 'always', priority: '0.9' },
	{ path: '/moderation', changefreq: 'monthly', priority: '0.6' },
	{ path: '/terms', changefreq: 'yearly', priority: '0.5' },
	{ path: '/privacy', changefreq: 'yearly', priority: '0.5' },
]

function escapeXml(unsafe: string): string {
	return unsafe
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;')
}

function formatDate(date: Date): string {
	return date.toISOString().split('T')[0]
}

function buildSitemapXml(
	urls: Array<{ loc: string; lastmod?: Date; changefreq?: string; priority?: string }>
): string {
	const baseUrl = config.baseUrl.endsWith('/') ? config.baseUrl.slice(0, -1) : config.baseUrl

	let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
	xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

	for (const url of urls) {
		xml += '  <url>\n'
		const fullUrl = `${baseUrl}${url.loc}`
		xml += `    <loc>${escapeXml(fullUrl)}</loc>\n`
		if (url.lastmod) {
			xml += `    <lastmod>${formatDate(url.lastmod)}</lastmod>\n`
		}
		if (url.changefreq) {
			xml += `    <changefreq>${url.changefreq}</changefreq>\n`
		}
		if (url.priority) {
			xml += `    <priority>${url.priority}</priority>\n`
		}
		xml += '  </url>\n'
	}

	xml += '</urlset>'
	return xml
}

// Generate sitemap
app.get('/sitemap.xml', async (c) => {
	try {
		const urls: Array<{ loc: string; lastmod?: Date; changefreq?: string; priority?: string }> =
			[]

		// Add static pages
		for (const page of STATIC_PAGES) {
			urls.push({
				loc: page.path,
				changefreq: page.changefreq,
				priority: page.priority,
			})
		}

		// Add public user profiles
		// Include both local users and cached remote users
		const users = await prisma.user.findMany({
			where: {
				// Include all users (both local and remote) that have been cached
				// Remote users are only in our DB if they've been resolved/cached
			},
			select: {
				username: true,
				updatedAt: true,
			},
			orderBy: {
				updatedAt: 'desc',
			},
			take: MAX_URLS_PER_SITEMAP - urls.length, // Reserve space for events
		})

		for (const user of users) {
			urls.push({
				loc: `/@${encodeURIComponent(user.username)}`,
				lastmod: user.updatedAt,
				changefreq: 'weekly',
				priority: '0.7',
			})
		}

		// Add public events
		// Only include public events that are not shared events (original events only)
		const remainingSlots = MAX_URLS_PER_SITEMAP - urls.length
		if (remainingSlots > 0) {
			const events = await prisma.event.findMany({
				where: {
					visibility: 'PUBLIC',
					sharedEventId: null, // Only original events, not shares
				},
				select: {
					id: true,
					userId: true,
					updatedAt: true,
					user: {
						select: {
							username: true,
						},
					},
				},
				orderBy: {
					updatedAt: 'desc',
				},
				take: remainingSlots,
			})

			for (const event of events) {
				if (event.user) {
					urls.push({
						loc: `/@${encodeURIComponent(event.user.username)}/${event.id}`,
						lastmod: event.updatedAt,
						changefreq: 'weekly',
						priority: '0.6',
					})
				}
			}
		}

		const xml = buildSitemapXml(urls)

		return c.body(xml, 200, {
			'Content-Type': 'application/xml',
			'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
		})
	} catch (error) {
		console.error('Error generating sitemap:', error)
		return c.json({ error: 'Internal server error' }, 500)
	}
})

export default app
