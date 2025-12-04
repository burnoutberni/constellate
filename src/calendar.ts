/**
 * Calendar Export (ICS)
 * Generate iCalendar files for events
 */

import { Hono } from 'hono'
import ical, { ICalEventStatus } from 'ical-generator'
import { prisma } from './lib/prisma.js'
import { canUserViewEvent } from './lib/eventVisibility.js'

const app = new Hono()

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

        // Add event
        calendar.createEvent({
            start: event.startTime,
            end: event.endTime || event.startTime,
            summary: event.title,
            description: event.summary || undefined,
            location: event.location || undefined,
            url: event.url || `${process.env.BETTER_AUTH_URL}/events/${id}`,
            organizer: {
                name: event.user?.name || event.user?.username || 'Unknown',
                email: `${event.user?.username}@${new URL(process.env.BETTER_AUTH_URL || 'http://localhost:3000').hostname}`,
            },
            status: event.eventStatus === 'EventCancelled' ? ICalEventStatus.CANCELLED : ICalEventStatus.CONFIRMED,
            repeating: event.recurrencePattern && event.recurrenceEndDate
                ? {
                    freq: event.recurrencePattern as 'DAILY' | 'WEEKLY' | 'MONTHLY',
                    until: event.recurrenceEndDate,
                }
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

        const viewerId = c.get('userId') as string | undefined
        const filteredEvents = []
        for (const event of user.events) {
            if (await canUserViewEvent(event, viewerId)) {
                filteredEvents.push(event)
            }
        }

        for (const event of filteredEvents) {
            calendar.createEvent({
                start: event.startTime,
                end: event.endTime || event.startTime,
                summary: event.title,
                description: event.summary || undefined,
                location: event.location || undefined,
                url: event.url || `${process.env.BETTER_AUTH_URL}/events/${event.id}`,
                organizer: {
                    name: user.name || username,
                    email: `${username}@${new URL(process.env.BETTER_AUTH_URL || 'http://localhost:3000').hostname}`,
                },
                status: event.eventStatus === 'EventCancelled' ? ICalEventStatus.CANCELLED : ICalEventStatus.CONFIRMED,
                repeating: event.recurrencePattern && event.recurrenceEndDate
                    ? {
                        freq: event.recurrencePattern as 'DAILY' | 'WEEKLY' | 'MONTHLY',
                        until: event.recurrenceEndDate,
                    }
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
            url: `${process.env.BETTER_AUTH_URL}/api/calendar/feed.ics`,
        })

        // Add all events
        for (const event of events) {
            calendar.createEvent({
                start: event.startTime,
                end: event.endTime || event.startTime,
                summary: event.title,
                description: event.summary || undefined,
                location: event.location || undefined,
                url: event.url || `${process.env.BETTER_AUTH_URL}/events/${event.id}`,
                organizer: event.user
                    ? {
                        name: event.user.name || event.user.username,
                        email: `${event.user.username}@${new URL(process.env.BETTER_AUTH_URL || 'http://localhost:3000').hostname}`,
                    }
                    : undefined,
                status: event.eventStatus === 'EventCancelled' ? ICalEventStatus.CANCELLED : ICalEventStatus.CONFIRMED,
                repeating: event.recurrencePattern && event.recurrenceEndDate
                    ? {
                        freq: event.recurrencePattern as 'DAILY' | 'WEEKLY' | 'MONTHLY',
                        until: event.recurrenceEndDate,
                    }
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
