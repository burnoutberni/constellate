/**
 * Calendar Export (ICS)
 * Generate iCalendar files for events
 */

import { Hono } from 'hono'
import ical, { ICalEventStatus, ICalEventRepeatingFreq } from 'ical-generator'
import { getVtimezoneComponent } from '@touch4it/ical-timezones'
import { prisma } from './lib/prisma.js'
import { canUserViewEvent } from './lib/eventVisibility.js'
import { normalizeTimeZone } from './lib/timezone.js'
import { randomBytes } from 'crypto'
import { requireAuth } from './middleware/auth.js'
import { buildEventFilter } from './lib/eventQueries.js'
import { Prisma } from '@prisma/client'

type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY'

const DEFAULT_BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const APP_HOSTNAME = (() => {
	try {
		return new URL(DEFAULT_BASE_URL).hostname
	} catch {
		return 'localhost'
	}
})()

function mapRecurrenceFrequency(freq: RecurrenceFrequency): ICalEventRepeatingFreq {
	switch (freq) {
		case 'DAILY':
			return ICalEventRepeatingFreq.DAILY
		case 'WEEKLY':
			return ICalEventRepeatingFreq.WEEKLY
		case 'MONTHLY':
			return ICalEventRepeatingFreq.MONTHLY
	}
}

function resolveAppUrl(path: string): string {
	try {
		return new URL(path, DEFAULT_BASE_URL).toString()
	} catch {
		const normalizedBase = DEFAULT_BASE_URL.endsWith('/')
			? DEFAULT_BASE_URL.slice(0, -1)
			: DEFAULT_BASE_URL
		const normalizedPath = path.startsWith('/') ? path : `/${path}`
		return `${normalizedBase}${normalizedPath}`
	}
}

function getEventPageUrl(eventId: string): string {
	return resolveAppUrl(`/events/${eventId}`)
}

function getEventExportMetadata(event: {
	id: string
	summary?: string | null
	url?: string | null
}) {
	const pageUrl = event.url || getEventPageUrl(event.id)
	const trimmedSummary = event.summary?.trim()
	const description = trimmedSummary ? `${trimmedSummary}\n\n${pageUrl}` : pageUrl
	return { pageUrl, description }
}

function formatDateForGoogle(date: Date | string | null | undefined): string {
	if (!date) {
		return ''
	}
	const dateObj = new Date(date)
	if (Number.isNaN(dateObj.getTime())) {
		return ''
	}
	return dateObj
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d{3}Z$/, 'Z')
}

function buildGoogleCalendarLink(event: {
	id: string
	title: string
	startTime: Date
	endTime?: Date | null
	location?: string | null
	summary?: string | null
	url?: string | null
}) {
	const { pageUrl, description } = getEventExportMetadata(event)
	const start = formatDateForGoogle(event.startTime)
	const end = formatDateForGoogle(event.endTime || event.startTime)
	if (!start || !end) {
		throw new Error(
			`Invalid event date: startTime=${event.startTime}, endTime=${event.endTime}`
		)
	}

	const googleUrl = new URL('https://calendar.google.com/calendar/render')
	googleUrl.searchParams.set('action', 'TEMPLATE')
	googleUrl.searchParams.set('text', event.title)
	googleUrl.searchParams.set('dates', `${start}/${end}`)
	googleUrl.searchParams.set('details', description)
	if (event.location) {
		googleUrl.searchParams.set('location', event.location)
	}
	googleUrl.searchParams.set('trp', 'false')
	googleUrl.searchParams.set('sprop', pageUrl)

	return googleUrl.toString()
}

const app = new Hono()

function ensureTimezone(calendar: ReturnType<typeof ical>, timezone: string, cache: Set<string>) {
	if (cache.has(timezone)) {
		return
	}

	calendar.timezone({
		name: timezone,
		generator: getVtimezoneComponent,
	})
	cache.add(timezone)
}

// Create a new calendar subscription
app.post('/subscriptions', async (c) => {
	try {
		const userId = requireAuth(c)
		const body = (await c.req.json()) as {
			name?: string
			filters?: Record<string, unknown>
		}
		const { name, filters } = body

		if (!name) {
			return c.json({ error: 'Name is required' }, 400)
		}

		// Generate a secure random token
		const token = randomBytes(32).toString('hex')

		const subscription = await prisma.calendarSubscription.create({
			data: {
				userId,
				name,

				filters: (filters || {}) as Prisma.InputJsonValue,
				token,
			},
		})

		const feedUrl = resolveAppUrl(`/api/calendar/feed/${subscription.token}.ics`)

		return c.json({
			...subscription,
			feedUrl,
		})
	} catch (error) {
		console.error('Error creating subscription:', error)
		return c.json({ error: 'Internal server error' }, 500)
	}
})

// Serve a calendar subscription feed
app.get('/feed/:filename', async (c) => {
	try {
		const filename = c.req.param('filename')
		if (!filename.endsWith('.ics')) {
			return c.text('Invalid feed URL', 400)
		}
		const cleanToken = filename.replace(/\.ics$/, '')

		const subscription = await prisma.calendarSubscription.findUnique({
			where: { token: cleanToken },
		})

		if (!subscription) {
			return c.text('Calendar not found', 404)
		}

		// Update last accessed
		await prisma.calendarSubscription.update({
			where: { id: subscription.id },
			data: { lastAccessedAt: new Date() },
		})

		const filters = subscription.filters as Record<string, unknown>
		const eventFilter = buildEventFilter(
			{
				onlyMine: filters.onlyMine === true,
			},
			subscription.userId
		)

		// Fetch events using the subscription's filter AND user's visibility rights
		// Note: We authenticate as the subscription owner
		const events = await prisma.event.findMany({
			where: {
				...eventFilter,
				// Ensure we respect visibility even for the owner (e.g. if they shouldn't see something, though 'onlyMine' mostly implies they can)
				// But mostly we need to ensure we don't leak other people's private events if the filter is loose (like "all public")
				// For "onlyMine", it's events they are interacting with, so they should see them.
			},
			include: {
				user: {
					select: {
						username: true,
						name: true,
					},
				},
			},
			orderBy: { startTime: 'asc' },
			// Limit to reasonable window? For now, maybe last 30 days and future?
			// Or just future? Standard iCal feeds often include some history.
			// Let's settle on: started within last 3 months OR is future
			// where: { ...eventFilter, OR: [{ startTime: ... }, { endTime: ... }] }
			// For simplicity and performance, let's grab all future and recent past (3 months)
		})

		// Filter for visibility in memory if needed, or rely on query.
		// Since 'buildEventFilter' for 'onlyMine' selects based on attendance/ownership,
		// the user definitely has access to these events.
		// If we add other filters later (like "all public events with tag X"), we'd need 'buildVisibilityWhere'.

		const filteredEvents = []
		for (const event of events) {
			// Double check visibility just to be safe, reusing existing logic
			if (await canUserViewEvent(event, subscription.userId)) {
				filteredEvents.push(event)
			}
		}

		// Create calendar
		const calendar = ical({
			name: subscription.name,
			description: `Constellate Calendar Feed: ${subscription.name}`,
			url: resolveAppUrl(`/api/calendar/feed/${filename}`),
		})
		const usedTimezones = new Set<string>()

		// Add events
		for (const event of filteredEvents) {
			const { pageUrl, description } = getEventExportMetadata(event)
			const eventTimezone = normalizeTimeZone(event.timezone)
			ensureTimezone(calendar, eventTimezone, usedTimezones)

			calendar.createEvent({
				start: event.startTime,
				end: event.endTime || event.startTime,
				summary: event.title,
				description,
				location: event.location || undefined,
				url: pageUrl,
				timezone: eventTimezone,
				organizer: event.user
					? {
							name: event.user.name || event.user.username,
							email: `${event.user.username}@${APP_HOSTNAME}`,
						}
					: undefined,
				status:
					event.eventStatus === 'EventCancelled'
						? ICalEventStatus.CANCELLED
						: ICalEventStatus.CONFIRMED,
				repeating:
					event.recurrencePattern && event.recurrenceEndDate
						? ({
								freq: mapRecurrenceFrequency(
									event.recurrencePattern as RecurrenceFrequency
								),
								until: event.recurrenceEndDate,
							} as const)
						: undefined,
			})
		}

		return c.text(calendar.toString(), 200, {
			'Content-Type': 'text/calendar; charset=utf-8',
			'Content-Disposition': `attachment; filename="${subscription.name.replace(/[^a-z0-9]/gi, '_')}.ics"`,
		})
	} catch (error) {
		console.error('Error generating feed:', error)
		return c.text('Internal server error', 500)
	}
})

// Export single event as ICS
app.get('/:id/export.ics', async (c) => {
	try {
		const { id } = c.req.param()

		const event = await prisma.event.findUnique({
			where: { id },
			include: {
				user: {
					select: {
						username: true,
						name: true,
					},
				},
			},
		})

		if (!event) {
			return c.text('Event not found', 404)
		}

		const viewerId = c.get('userId') as string | undefined
		const canView = await canUserViewEvent(event, viewerId)
		if (!canView) {
			return c.text('Forbidden', 403)
		}

		// Create calendar
		const calendar = ical({ name: 'Constellate' })
		const usedTimezones = new Set<string>()

		const { pageUrl, description } = getEventExportMetadata(event)
		const organizer = event.user
			? {
					name: event.user.name || event.user.username,
					email: `${event.user.username}@${APP_HOSTNAME}`,
				}
			: undefined

		// Add event
		const eventTimezone = normalizeTimeZone(event.timezone)
		ensureTimezone(calendar, eventTimezone, usedTimezones)

		calendar.createEvent({
			start: event.startTime,
			end: event.endTime || event.startTime,
			summary: event.title,
			description,
			location: event.location || undefined,
			url: pageUrl,
			timezone: eventTimezone,
			organizer,
			status:
				event.eventStatus === 'EventCancelled'
					? ICalEventStatus.CANCELLED
					: ICalEventStatus.CONFIRMED,
			repeating:
				event.recurrencePattern && event.recurrenceEndDate
					? ({
							freq: mapRecurrenceFrequency(
								event.recurrencePattern as RecurrenceFrequency
							),
							until: event.recurrenceEndDate,
						} as const)
					: undefined,
		})

		// Return ICS file
		return c.text(calendar.toString(), 200, {
			'Content-Type': 'text/calendar; charset=utf-8',
			'Content-Disposition': `attachment; filename="${event.title.replace(/[^a-z0-9]/gi, '_')}.ics"`,
		})
	} catch (error) {
		console.error('Error exporting event:', error)
		return c.text('Internal server error', 500)
	}
})

// Export user's events as ICS
app.get('/user/:username/export.ics', async (c) => {
	try {
		const { username } = c.req.param()

		const user = await prisma.user.findUnique({
			where: { username },
			include: {
				events: {
					orderBy: { startTime: 'asc' },
					include: {
						user: {
							select: {
								id: true,
								username: true,
								name: true,
								displayColor: true,
								profileImage: true,
							},
						},
					},
				},
			},
		})

		if (!user) {
			return c.text('User not found', 404)
		}

		// Create calendar
		const calendar = ical({
			name: `${user.name || username}'s Events`,
			description: 'Events from Constellate',
		})
		const usedTimezones = new Set<string>()

		const viewerId = c.get('userId') as string | undefined
		const filteredEvents = []
		for (const event of user.events) {
			if (await canUserViewEvent(event, viewerId)) {
				filteredEvents.push(event)
			}
		}

		const organizer = {
			name: user.name || username,
			email: `${username}@${APP_HOSTNAME}`,
		}

		for (const event of filteredEvents) {
			const { pageUrl, description } = getEventExportMetadata(event)
			const eventTimezone = normalizeTimeZone(event.timezone)
			ensureTimezone(calendar, eventTimezone, usedTimezones)

			calendar.createEvent({
				start: event.startTime,
				end: event.endTime || event.startTime,
				summary: event.title,
				description,
				location: event.location || undefined,
				url: pageUrl,
				timezone: eventTimezone,
				organizer,
				status:
					event.eventStatus === 'EventCancelled'
						? ICalEventStatus.CANCELLED
						: ICalEventStatus.CONFIRMED,
				repeating:
					event.recurrencePattern && event.recurrenceEndDate
						? ({
								freq: mapRecurrenceFrequency(
									event.recurrencePattern as RecurrenceFrequency
								),
								until: event.recurrenceEndDate,
							} as const)
						: undefined,
			})
		}

		// Return ICS file
		return c.text(calendar.toString(), 200, {
			'Content-Type': 'text/calendar; charset=utf-8',
			'Content-Disposition': `attachment; filename="${username}_calendar.ics"`,
		})
	} catch (error) {
		console.error('Error exporting calendar:', error)
		return c.text('Internal server error', 500)
	}
})

// Generate Google Calendar link for a single event
app.get('/:id/export/google', async (c) => {
	try {
		const { id } = c.req.param()

		const event = await prisma.event.findUnique({
			where: { id },
		})

		if (!event) {
			return c.text('Event not found', 404)
		}

		const viewerId = c.get('userId') as string | undefined
		const canView = await canUserViewEvent(event, viewerId)
		if (!canView) {
			return c.text('Forbidden', 403)
		}

		const googleLink = buildGoogleCalendarLink(event)

		return c.json({ url: googleLink })
	} catch (error) {
		console.error('Error generating Google Calendar link:', error)
		return c.text('Internal server error', 500)
	}
})

// Export all public events as ICS feed
app.get('/feed.ics', async (c) => {
	try {
		const events = await prisma.event.findMany({
			where: {
				startTime: {
					gte: new Date(), // Only future events
				},
				visibility: 'PUBLIC',
			},
			include: {
				user: {
					select: {
						username: true,
						name: true,
					},
				},
			},
			orderBy: { startTime: 'asc' },
			take: 100, // Limit to 100 events
		})

		// Create calendar
		const calendar = ical({
			name: 'Constellate - Public Events',
			description: 'Public events from Constellate',
			url: resolveAppUrl('/api/calendar/feed.ics'),
		})
		const usedTimezones = new Set<string>()

		// Add all events
		for (const event of events) {
			const { pageUrl, description } = getEventExportMetadata(event)
			const eventTimezone = normalizeTimeZone(event.timezone)
			ensureTimezone(calendar, eventTimezone, usedTimezones)

			calendar.createEvent({
				start: event.startTime,
				end: event.endTime || event.startTime,
				summary: event.title,
				description,
				location: event.location || undefined,
				url: pageUrl,
				timezone: eventTimezone,
				organizer: event.user
					? {
							name: event.user.name || event.user.username,
							email: `${event.user.username}@${APP_HOSTNAME}`,
						}
					: undefined,
				status:
					event.eventStatus === 'EventCancelled'
						? ICalEventStatus.CANCELLED
						: ICalEventStatus.CONFIRMED,
				repeating:
					event.recurrencePattern && event.recurrenceEndDate
						? ({
								freq: mapRecurrenceFrequency(
									event.recurrencePattern as RecurrenceFrequency
								),
								until: event.recurrenceEndDate,
							} as const)
						: undefined,
			})
		}

		// Return ICS file
		return c.text(calendar.toString(), 200, {
			'Content-Type': 'text/calendar; charset=utf-8',
		})
	} catch (error) {
		console.error('Error exporting feed:', error)
		return c.text('Internal server error', 500)
	}
})

export default app
