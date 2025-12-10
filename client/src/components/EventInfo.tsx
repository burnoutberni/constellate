import { useMemo } from 'react'
import { Badge } from './ui/Badge'
import { getRecurrenceLabel } from '../lib/recurrence'
import { getVisibilityMeta } from '../lib/visibility'
<<<<<<< HEAD
import { formatDate, formatTime } from '../lib/formatUtils'
=======
>>>>>>> 0136c33 (WP-106: Add EventHeader, EventInfo, SignUpPrompt components and refactor EventDetailPage)
import type { EventVisibility, RecurrencePattern } from '../types'

export interface EventInfoProps {
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
export function EventInfo({
  event,
  viewerTimezone,
  eventTimezone,
}: EventInfoProps) {
  const visibilityMeta = useMemo(
    () => getVisibilityMeta(event.visibility),
    [event.visibility]
  )

<<<<<<< HEAD
  const formatDateWithTimezone = useMemo(() => {
    return (dateString: string) => {
      return formatDate(dateString, {
=======
  const formatDate = useMemo(() => {
    return (dateString: string) => {
      return new Intl.DateTimeFormat('en-US', {
>>>>>>> 0136c33 (WP-106: Add EventHeader, EventInfo, SignUpPrompt components and refactor EventDetailPage)
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: viewerTimezone,
<<<<<<< HEAD
      })
    }
  }, [viewerTimezone])

  const formatTimeWithTimezone = useMemo(() => {
    return (dateString: string) => {
      return formatTime(dateString, {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: viewerTimezone,
      })
=======
      }).format(new Date(dateString))
    }
  }, [viewerTimezone])

  const formatTime = useMemo(() => {
    return (dateString: string) => {
      return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: viewerTimezone,
      }).format(new Date(dateString))
>>>>>>> 0136c33 (WP-106: Add EventHeader, EventInfo, SignUpPrompt components and refactor EventDetailPage)
    }
  }, [viewerTimezone])

  return (
    <div className="space-y-6">
      {/* Event Title and Visibility */}
      <div>
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold text-text-primary">{event.title}</h1>
          {visibilityMeta && (
            <Badge variant="secondary" size="md">
              {visibilityMeta.icon} {visibilityMeta.label}
            </Badge>
          )}
        </div>
        {visibilityMeta?.helper && (
          <p className="text-sm text-text-secondary">{visibilityMeta.helper}</p>
        )}
      </div>

      {/* Event Description */}
      {event.summary && (
        <div>
          <p className="text-text-primary text-lg">{event.summary}</p>
        </div>
      )}

      {/* Event Details */}
      <div className="space-y-3">
        {/* Date */}
        <div className="flex items-center gap-3 text-text-primary">
          <span className="text-xl" aria-hidden="true">📅</span>
<<<<<<< HEAD
          <span>{formatDateWithTimezone(event.startTime)}</span>
=======
          <span>{formatDate(event.startTime)}</span>
>>>>>>> 0136c33 (WP-106: Add EventHeader, EventInfo, SignUpPrompt components and refactor EventDetailPage)
        </div>

        {/* Time */}
        <div className="flex items-center gap-3 text-text-primary">
          <span className="text-xl" aria-hidden="true">🕐</span>
          <span>
<<<<<<< HEAD
            {formatTimeWithTimezone(event.startTime)}
            {event.endTime && ` - ${formatTimeWithTimezone(event.endTime)}`}
=======
            {formatTime(event.startTime)}
            {event.endTime && ` - ${formatTime(event.endTime)}`}
>>>>>>> 0136c33 (WP-106: Add EventHeader, EventInfo, SignUpPrompt components and refactor EventDetailPage)
          </span>
        </div>

        {/* Timezone Info */}
        <div className="flex items-center gap-3 text-text-secondary text-sm">
          <span className="text-xl" aria-hidden="true">🌐</span>
          <span>
            Times shown in {viewerTimezone}
            {eventTimezone && viewerTimezone !== eventTimezone &&
              ` (event scheduled in ${eventTimezone})`}
          </span>
        </div>

        {/* Location */}
        {event.location && (
          <div className="flex items-center gap-3 text-text-primary">
            <span className="text-xl" aria-hidden="true">📍</span>
            <span>{event.location}</span>
          </div>
        )}

        {/* URL */}
        {event.url && (
          <div className="flex items-center gap-3 text-text-primary">
            <span className="text-xl" aria-hidden="true">🔗</span>
            <a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:text-primary-700 hover:underline"
            >
              {event.url}
            </a>
          </div>
        )}

        {/* Recurrence */}
        {event.recurrencePattern && (
          <div className="flex items-center gap-3 text-text-primary">
            <span className="text-xl" aria-hidden="true">🔁</span>
            <span>
              Repeats {getRecurrenceLabel(event.recurrencePattern)}
<<<<<<< HEAD
              {event.recurrenceEndDate && ` until ${formatDateWithTimezone(event.recurrenceEndDate)}`}
=======
              {event.recurrenceEndDate && ` until ${formatDate(event.recurrenceEndDate)}`}
>>>>>>> 0136c33 (WP-106: Add EventHeader, EventInfo, SignUpPrompt components and refactor EventDetailPage)
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
