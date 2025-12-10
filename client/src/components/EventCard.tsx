import { Link } from 'react-router-dom'
import { Card } from './ui/Card'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { useAuth } from '../contexts/AuthContext'
import { getVisibilityMeta } from '../lib/visibility'
import type { Event } from '../types'

interface EventCardProps {
    event: Event
    formatter: Intl.DateTimeFormat
    viewMode?: 'grid' | 'list'
}

export function EventCard({ event, formatter, viewMode = 'grid' }: EventCardProps) {
    const { user } = useAuth()
    const eventPath = event.user?.username
        ? `/@${event.user.username}/${event.originalEventId || event.id}`
        : undefined
    const visibilityMeta = getVisibilityMeta(event.visibility)
    
    // Map visibility to badge variant
    const visibilityBadgeVariant = event.visibility === 'PUBLIC' ? 'primary' : 'default'

    const formatEventDateTime = (isoString: string) => {
        const date = new Date(isoString)
        if (Number.isNaN(date.getTime())) {
            return isoString
        }
        return formatter.format(date)
    }

    if (viewMode === 'list') {
        return (
            <Card className="p-5 space-y-3 hover:shadow-md transition-shadow">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">{event.title}</h3>
                        <p className="text-sm text-gray-500">
                            {formatEventDateTime(event.startTime)}
                            {event.location && <span> • {event.location}</span>}
                        </p>
                        {event.user && (
                            <p className="text-xs text-gray-500">Hosted by @{event.user.username}</p>
                        )}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <Badge variant={visibilityBadgeVariant}>
                            {visibilityMeta.icon} {visibilityMeta.label}
                        </Badge>
                        {event.eventStatus && (
                            <Badge variant="default">{event.eventStatus.replace('Event', '')}</Badge>
                        )}
                        {event.eventAttendanceMode && (
                            <Badge variant="default">
                                {event.eventAttendanceMode.replace('EventAttendanceMode', '')}
                            </Badge>
                        )}
                    </div>
                </div>

                {event.summary && (
                    <p className="text-sm text-gray-700 line-clamp-3">{event.summary}</p>
                )}

                {event.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {event.tags.map((tag) => (
                            <Badge key={tag.id} variant="default">
                                #{tag.tag}
                            </Badge>
                        ))}
                    </div>
                )}

                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                    {typeof event._count?.attendance === 'number' && (
                        <span>👥 {event._count.attendance} attending</span>
                    )}
                    {typeof event._count?.likes === 'number' && <span>❤️ {event._count.likes} likes</span>}
                    {typeof event._count?.comments === 'number' && <span>💬 {event._count.comments} comments</span>}
                </div>

                <div className="flex gap-2">
                    {eventPath && (
                        <Link to={eventPath}>
                            <Button variant="primary">View event</Button>
                        </Link>
                    )}
                    {!user && (
                        <Link to="/login">
                            <Button variant="secondary">Sign up to RSVP</Button>
                        </Link>
                    )}
                </div>
            </Card>
        )
    }

    // Grid view
    return (
        <Card className="p-5 space-y-3 hover:shadow-md transition-shadow flex flex-col h-full">
            {event.headerImage && (
                <div className="w-full h-32 overflow-hidden rounded-lg mb-2">
                    <img
                        src={event.headerImage}
                        alt={event.title}
                        className="w-full h-full object-cover"
                    />
                </div>
            )}
            
            <div className="flex-1 space-y-2">
                <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">{event.title}</h3>
                <p className="text-sm text-gray-500">
                    {formatEventDateTime(event.startTime)}
                </p>
                {event.location && (
                    <p className="text-sm text-gray-500">📍 {event.location}</p>
                )}
                {event.user && (
                    <p className="text-xs text-gray-500">by @{event.user.username}</p>
                )}

                {event.summary && (
                    <p className="text-sm text-gray-700 line-clamp-2">{event.summary}</p>
                )}

                {event.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {event.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag.id} variant="default" size="sm">
                                #{tag.tag}
                            </Badge>
                        ))}
                        {event.tags.length > 3 && (
                            <Badge variant="default" size="sm" aria-label={`${event.tags.length - 3} more tags`}>
                                +{event.tags.length - 3}
                            </Badge>
                        )}
                    </div>
                )}

                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    {typeof event._count?.attendance === 'number' && (
                        <span>👥 {event._count.attendance}</span>
                    )}
                    {typeof event._count?.likes === 'number' && <span>❤️ {event._count.likes}</span>}
                </div>
            </div>

            <div className="flex flex-col gap-2 mt-auto pt-3">
                {eventPath && (
                    <Link to={eventPath} className="w-full">
                        <Button variant="primary" className="w-full">View event</Button>
                    </Link>
                )}
                {!user && (
                    <Link to="/login" className="w-full">
                        <Button variant="secondary" className="w-full">Sign up to RSVP</Button>
                    </Link>
                )}
            </div>
        </Card>
    )
}
