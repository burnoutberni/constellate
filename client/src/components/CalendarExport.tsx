import { Button } from './ui'

interface CalendarExportProps {
	/**
	 * Event title
	 */
	title: string
	/**
	 * Event description/summary
	 */
	description?: string | null
	/**
	 * Event location
	 */
	location?: string | null
	/**
	 * Event start time (ISO 8601 string)
	 */
	startTime: string
	/**
	 * Event end time (ISO 8601 string)
	 */
	endTime?: string | null
	/**
	 * Event timezone
	 */
	timezone?: string
	/**
	 * Event URL
	 */
	url?: string
}

/**
 * Format date for iCal (YYYYMMDDTHHMMSS format in UTC)
 */
function formatICalDate(dateString: string): string {
	const date = new Date(dateString)
	return `${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`
}

/**
 * Escape special characters for iCal format
 */
function escapeICalText(text: string): string {
	return text.replace(/[,;\\]/g, '\\$&').replace(/\n/g, '\\n')
}

/**
 * Generate iCal file content
 */
function generateICalContent({
	title,
	description,
	location,
	startTime,
	endTime,
	url,
}: CalendarExportProps): string {
	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Constellate//Event//EN',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		'BEGIN:VEVENT',
		`DTSTART:${formatICalDate(startTime)}`,
	]

	if (endTime) {
		lines.push(`DTEND:${formatICalDate(endTime)}`)
	}

	lines.push(`SUMMARY:${escapeICalText(title)}`)

	if (description) {
		lines.push(`DESCRIPTION:${escapeICalText(description)}`)
	}

	if (location) {
		lines.push(`LOCATION:${escapeICalText(location)}`)
	}

	if (url) {
		lines.push(`URL:${url}`)
	}

	lines.push(`DTSTAMP:${formatICalDate(new Date().toISOString())}`)
	lines.push(`UID:${crypto.randomUUID()}@constellate`)
	lines.push('STATUS:CONFIRMED')
	lines.push('SEQUENCE:0')
	lines.push('END:VEVENT')
	lines.push('END:VCALENDAR')

	return lines.join('\r\n')
}

/**
 * Generate Google Calendar URL
 */
function generateGoogleCalendarUrl({
	title,
	description,
	location,
	startTime,
	endTime,
}: CalendarExportProps): string {
	const baseUrl = 'https://calendar.google.com/calendar/render'
	const params = new URLSearchParams({
		action: 'TEMPLATE',
		text: title,
		dates: `${formatICalDate(startTime)}/${endTime ? formatICalDate(endTime) : formatICalDate(startTime)}`,
	})

	if (description) {
		params.set('details', description)
	}

	if (location) {
		params.set('location', location)
	}

	return `${baseUrl}?${params.toString()}`
}

/**
 * CalendarExport provides buttons to export event to calendar applications.
 * Supports iCal download and Google Calendar integration.
 */
export function CalendarExport(props: CalendarExportProps) {
	const handleICalExport = () => {
		const icalContent = generateICalContent(props)
		const blob = new Blob([icalContent], { type: 'text/calendar;charset=utf-8' })
		const url = URL.createObjectURL(blob)
		const link = document.createElement('a')
		link.href = url
		link.download = `${props.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`
		document.body.appendChild(link)
		link.click()
		document.body.removeChild(link)
		URL.revokeObjectURL(url)
	}

	const handleGoogleCalendar = () => {
		const url = generateGoogleCalendarUrl(props)
		window.open(url, '_blank', 'noopener,noreferrer')
	}

	return (
		<div className="mb-6 pb-4 border-b border-border-default">
			<h3 className="text-sm font-semibold text-text-primary mb-3">Add to Calendar</h3>
			<div className="flex flex-wrap gap-3">
				<Button variant="secondary" size="sm" onClick={handleICalExport} leftIcon="📅">
					Download iCal
				</Button>
				<Button variant="secondary" size="sm" onClick={handleGoogleCalendar} leftIcon="🗓️">
					Google Calendar
				</Button>
			</div>
		</div>
	)
}
