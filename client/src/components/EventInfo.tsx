import { useMemo } from 'react'

import type { EventVisibility, RecurrencePattern } from '@/types'

import { formatDate, formatTime } from '../lib/formatUtils'
import { getRecurrenceLabel } from '../lib/recurrence'
import { getVisibilityMeta } from '../lib/visibility'

import { Badge, SafeHTML } from './ui'

interface EventInfoProps {
	/**
	 * Event details to display
	 */
	event: {
		title: string
		summary?: string | null
		startTime: string
		endTime?: string | null
		location?: string | null
		url?: string | null
		visibility?: EventVisibility
		timezone?: string | null
		recurrencePattern?: RecurrencePattern | null
		recurrenceEndDate?: string | null
		tags?: Array<{ id: string; tag: string }>
	}
	/**
	 * Viewer's timezone for displaying dates/times
	 */
	viewerTimezone: string
	/**
	 * Event's timezone (if different from viewer)
	 */
	eventTimezone?: string
}

/**
 * EventInfo component displays all event details including
 * date, time, location, recurrence, and tags.
 *
 * Handles timezone display and formatting.
 */
export function EventInfo({ event, viewerTimezone, eventTimezone }: EventInfoProps) {
	const visibilityMeta = useMemo(() => {
		// Ensure we always have a valid visibility meta, defaulting to PUBLIC
		return getVisibilityMeta(event.visibility || 'PUBLIC')
	}, [event.visibility])

	const formatDateWithTimezone = useMemo(
		() => (dateString: string) =>
			formatDate(dateString, {
				weekday: 'long',
				year: 'numeric',
				month: 'long',
				day: 'numeric',
				timeZone: viewerTimezone,
			}),
		[viewerTimezone]
	)

	const formatTimeWithTimezone = useMemo(
		() => (dateString: string) =>
			formatTime(dateString, {
				hour: 'numeric',
				minute: '2-digit',
				timeZone: viewerTimezone,
			}),
		[viewerTimezone]
	)

	return (
		<div className="space-y-6">
			{/* Event Title and Visibility */}
			<div>
				<div className="flex flex-wrap items-center gap-3 mb-2">
					<h1 className="text-3xl font-bold text-text-primary">{event.title}</h1>
					<Badge variant="secondary" size="md">
						{visibilityMeta.icon} {visibilityMeta.label}
					</Badge>
				</div>
				{visibilityMeta.helper && (
					<p className="text-sm text-text-secondary">{visibilityMeta.helper}</p>
				)}
			</div>

			{/* Event Description */}
			{event.summary && (
				<div>
					<SafeHTML
						html={event.summary}
						className="text-text-primary text-lg"
						tag="div"
					/>
				</div>
			)}

			{/* Event Details */}
			<div className="space-y-3">
				{/* Date */}
				<div className="flex items-center gap-3 text-text-primary">
					<span className="text-xl" aria-hidden="true">
						📅
					</span>
					<span>{formatDateWithTimezone(event.startTime)}</span>
				</div>

				{/* Time */}
				<div className="flex items-center gap-3 text-text-primary">
					<span className="text-xl" aria-hidden="true">
						🕐
					</span>
					<span>
						{formatTimeWithTimezone(event.startTime)}
						{event.endTime && ` - ${formatTimeWithTimezone(event.endTime)}`}
					</span>
				</div>

				{/* Timezone Info */}
				<div className="flex items-center gap-3 text-text-secondary text-sm">
					<span className="text-xl" aria-hidden="true">
						🌐
					</span>
					<span>
						Times shown in {viewerTimezone}
						{eventTimezone &&
							viewerTimezone !== eventTimezone &&
							` (event scheduled in ${eventTimezone})`}
					</span>
				</div>

				{/* Location */}
				{event.location && (
					<div className="flex items-center gap-3 text-text-primary">
						<span className="text-xl" aria-hidden="true">
							📍
						</span>
						<span>{event.location}</span>
					</div>
				)}

				{/* URL */}
				{event.url && (
					<div className="flex items-center gap-3 text-text-primary">
						<span className="text-xl" aria-hidden="true">
							🔗
						</span>
						<a
							href={event.url}
							target="_blank"
							rel="noopener noreferrer"
							className="text-primary-600 hover:text-primary-700 hover:underline">
							{event.url}
						</a>
					</div>
				)}

				{/* Recurrence */}
				{event.recurrencePattern && (
					<div className="flex items-center gap-3 text-text-primary">
						<span className="text-xl" aria-hidden="true">
							🔁
						</span>
						<span>
							Repeats {getRecurrenceLabel(event.recurrencePattern)}
							{event.recurrenceEndDate &&
								` until ${formatDateWithTimezone(event.recurrenceEndDate)}`}
						</span>
					</div>
				)}
			</div>

			{/* Tags */}
			{event.tags && event.tags.length > 0 && (
				<div className="flex flex-wrap gap-2">
					{event.tags.map((tag) => (
						<Badge key={tag.id} variant="primary" size="md">
							#{tag.tag}
						</Badge>
					))}
				</div>
			)}
		</div>
	)
}
