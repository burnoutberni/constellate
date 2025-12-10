import { Card, CardContent } from './ui/Card'
import type { Event } from '../types'

interface UserEventListProps {
    events: Event[]
    onEventClick: (eventId: string) => void
}

/**
 * UserEventList component displays a list of events created by a user.
 */
export function UserEventList({ events, onEventClick }: UserEventListProps) {
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString(navigator.language || 'en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        })
    }

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleTimeString(navigator.language || 'en-US', {
            hour: 'numeric',
            minute: '2-digit',
        })
    }

    if (events.length === 0) {
        return (
            <div className="text-center">
                <Card variant="default" padding="lg">
                    <CardContent className="py-8">
                        <div className="text-5xl mb-3">📅</div>
                        <p className="text-text-secondary">No events yet</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {events.map((event) => (
                <Card
                    key={event.id}
                    variant="default"
                    padding="lg"
                    interactive
                    onClick={() => onEventClick(event.id)}
                    className="hover:shadow-md"
                >
                    {/* Event Header Image */}
                    {event.headerImage && (
                        <img
                            src={event.headerImage}
                            alt={event.title}
                            className="w-full h-48 object-cover rounded-lg mb-4 -mt-6 -mx-6"
                            style={{ width: 'calc(100% + 3rem)' }}
                        />
                    )}

                    {/* Event Title */}
                    <h3 className="text-lg font-semibold text-text-primary mb-2">
                        {event.title}
                    </h3>

                    {/* Event Summary */}
                    {event.summary && (
                        <p className="text-text-secondary mb-3 line-clamp-2">
                            {event.summary}
                        </p>
                    )}

                    {/* Event Metadata */}
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm text-text-tertiary mb-3">
                        {/* Date and Time */}
                        <div className="flex items-center gap-1.5">
                            <svg
                                className="w-4 h-4 flex-shrink-0"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                            </svg>
                            <span>
                                {formatDate(event.startTime)} at {formatTime(event.startTime)}
                            </span>
                        </div>

                        {/* Location */}
                        {event.location && (
                            <div className="flex items-center gap-1.5">
                                <svg
                                    className="w-4 h-4 flex-shrink-0"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                    />
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                    />
                                </svg>
                                <span className="truncate">{event.location}</span>
                            </div>
                        )}
                    </div>

                    {/* Event Stats */}
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm text-text-tertiary">
                        <div className="flex items-center gap-1.5">
                            <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                />
                            </svg>
                            <span>{event._count?.attendance || 0} attending</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                                />
                            </svg>
                            <span>{event._count?.likes || 0} likes</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                                />
                            </svg>
                            <span>{event._count?.comments || 0} comments</span>
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    )
}
