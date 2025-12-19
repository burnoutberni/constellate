/**
 * Dynamic Sitemap and Robots.txt Generation
 * Generates XML sitemap index with paginated sub-sitemaps for scalability
 * Includes static pages, all user profiles, and public events
 * All profiles are included - private profiles show minimal info (name, username, profile picture) when accessed
 * Generates robots.txt with dynamic sitemap URL based on configuration
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

function buildSitemapIndexXml(sitemaps: Array<{ loc: string; lastmod?: Date }>): string {
	const baseUrl = config.baseUrl.endsWith('/') ? config.baseUrl.slice(0, -1) : config.baseUrl

	let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
	xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

	for (const sitemap of sitemaps) {
		xml += '  <sitemap>\n'
		const fullUrl = `${baseUrl}${sitemap.loc}`
		xml += `    <loc>${escapeXml(fullUrl)}</loc>\n`
		if (sitemap.lastmod) {
			xml += `    <lastmod>${formatDate(sitemap.lastmod)}</lastmod>\n`
		}
		xml += '  </sitemap>\n'
	}

	xml += '</sitemapindex>'
	return xml
}

// Generate sitemap index
app.get('/sitemap.xml', async (c) => {
	try {
		const sitemaps: Array<{ loc: string; lastmod?: Date }> = []

		// Always include static pages sitemap
		sitemaps.push({
			loc: '/sitemap-static.xml',
			lastmod: new Date(),
		})

		// Count users to determine number of user sitemap files needed
		const userCount = await prisma.user.count()
		const userSitemapCount = Math.ceil(userCount / MAX_URLS_PER_SITEMAP)

		for (let page = 1; page <= userSitemapCount; page++) {
			sitemaps.push({
				loc: `/sitemap-users/${page}.xml`,
			})
		}

		// Count public events to determine number of event sitemap files needed
		const eventCount = await prisma.event.count({
			where: {
				visibility: 'PUBLIC',
				sharedEventId: null, // Only original events, not shares
			},
		})
		const eventSitemapCount = Math.ceil(eventCount / MAX_URLS_PER_SITEMAP)

		for (let page = 1; page <= eventSitemapCount; page++) {
			sitemaps.push({
				loc: `/sitemap-events/${page}.xml`,
			})
		}

		const xml = buildSitemapIndexXml(sitemaps)

		return c.body(xml, 200, {
			'Content-Type': 'application/xml',
			'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
		})
	} catch (error) {
		console.error('Error generating sitemap index:', error)
		return c.json({ error: 'Internal server error' }, 500)
	}
})

// Generate static pages sitemap
app.get('/sitemap-static.xml', async (c) => {
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

		const xml = buildSitemapXml(urls)

		return c.body(xml, 200, {
			'Content-Type': 'application/xml',
			'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
		})
	} catch (error) {
		console.error('Error generating static sitemap:', error)
		return c.json({ error: 'Internal server error' }, 500)
	}
})

// Helper function to generate paginated user sitemap
async function generateUserSitemap(page: number) {
	const skip = (page - 1) * MAX_URLS_PER_SITEMAP
	const users = await prisma.user.findMany({
		// No privacy filtering - include all users
		select: {
			username: true,
			updatedAt: true,
		},
		orderBy: {
			updatedAt: 'desc',
		},
		skip,
		take: MAX_URLS_PER_SITEMAP,
	})

	const urls: Array<{ loc: string; lastmod?: Date; changefreq?: string; priority?: string }> = []

	for (const user of users) {
		urls.push({
			loc: `/@${encodeURIComponent(user.username)}`,
			lastmod: user.updatedAt,
			changefreq: 'weekly',
			priority: '0.7',
		})
	}

	return buildSitemapXml(urls)
}

// Helper function to generate paginated event sitemap
async function generateEventSitemap(page: number) {
	const skip = (page - 1) * MAX_URLS_PER_SITEMAP
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
		skip,
		take: MAX_URLS_PER_SITEMAP,
	})

	const urls: Array<{ loc: string; lastmod?: Date; changefreq?: string; priority?: string }> = []

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

	return buildSitemapXml(urls)
}

// Generate paginated user profiles sitemap
// Handle /sitemap-users/:page (the .xml is in the sitemap index URL but route doesn't need it)
app.get('/sitemap-users/:page', async (c) => {
	try {
		const pageParam = c.req.param('page')
		// Remove .xml if present (for backwards compatibility)
		const pageStr = pageParam.replace(/\.xml$/, '')
		const page = parseInt(pageStr, 10)
		if (isNaN(page) || page < 1) {
			return c.json({ error: 'Invalid page number' }, 400)
		}

		const xml = await generateUserSitemap(page)

		return c.body(xml, 200, {
			'Content-Type': 'application/xml',
			'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
		})
	} catch (error) {
		console.error('Error generating user sitemap:', error)
		return c.json({ error: 'Internal server error' }, 500)
	}
})

// Generate paginated public events sitemap
// Handle /sitemap-events/:page (the .xml is in the sitemap index URL but route doesn't need it)
app.get('/sitemap-events/:page', async (c) => {
	try {
		const pageParam = c.req.param('page')
		// Remove .xml if present (for backwards compatibility)
		const pageStr = pageParam.replace(/\.xml$/, '')
		const page = parseInt(pageStr, 10)
		if (isNaN(page) || page < 1) {
			return c.json({ error: 'Invalid page number' }, 400)
		}

		const xml = await generateEventSitemap(page)

		return c.body(xml, 200, {
			'Content-Type': 'application/xml',
			'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
		})
	} catch (error) {
		console.error('Error generating event sitemap:', error)
		return c.json({ error: 'Internal server error' }, 500)
	}
})

// Generate robots.txt
app.get('/robots.txt', async (c) => {
	try {
		const baseUrl = config.baseUrl.endsWith('/') ? config.baseUrl.slice(0, -1) : config.baseUrl
		const sitemapUrl = `${baseUrl}/sitemap.xml`

		const robotsTxt = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /settings/
Disallow: /notifications/
Disallow: /reminders/
Disallow: /edit/

Sitemap: ${sitemapUrl}
`

		return c.body(robotsTxt, 200, {
			'Content-Type': 'text/plain',
			'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
		})
	} catch (error) {
		console.error('Error generating robots.txt:', error)
		return c.json({ error: 'Internal server error' }, 500)
	}
})

export default app
