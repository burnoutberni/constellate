import { Link } from 'react-router-dom'
import { Card } from './ui/Card'
import { Badge } from './ui/Badge'
import { Avatar } from './ui/Avatar'
import type { Event } from '../types'

interface EventCardProps {
  /**
   * Event data to display
   */
  event: Event
  /**
   * Whether to show the full card or compact version
   */
  variant?: 'full' | 'compact'
  /**
   * Whether the user is authenticated
   */
  isAuthenticated?: boolean
}

/**
 * EventCard component - Displays event information in a card format
 * Used for featured events, event lists, and event grids
 */
export function EventCard({ event, variant = 'full', isAuthenticated = false }: EventCardProps) {
  const eventLink = event.user?.username 
    ? `/@${event.user.username}/${event.id}`
    : `/events/${event.id}`

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = date.getTime() - now.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return 'Today'
    if (days === 1) return 'Tomorrow'
    if (days > 1 && days < 7) return `In ${days} days`

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    })
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  if (variant === 'compact') {
    return (
      <Link to={eventLink}>
        <Card interactive padding="md" className="h-full">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-text-primary line-clamp-2 flex-1">
                {event.title}
              </h3>
              {event._count && event._count.attendance > 0 && (
                <Badge variant="primary" size="sm">
                  {event._count.attendance} attending
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <span>📅</span>
              <span>{formatDate(event.startTime)}</span>
              <span>•</span>
              <span>{formatTime(event.startTime)}</span>
            </div>

            {event.location && (
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <span>📍</span>
                <span className="truncate">{event.location}</span>
              </div>
            )}

            {event.user && (
              <div className="flex items-center gap-2 pt-2 border-t border-border-default">
                <Avatar 
                  src={event.user.profileImage || undefined}
                  name={event.user.name || event.user.username}
                  size="sm"
                />
                <span className="text-sm text-text-secondary truncate">
                  @{event.user.username}
                </span>
              </div>
            )}
          </div>
        </Card>
      </Link>
    )
  }

  return (
    <Link to={eventLink}>
      <Card interactive padding="none" className="h-full overflow-hidden">
        {/* Header Image */}
        {event.headerImage && (
          <div className="relative w-full h-48 bg-background-tertiary">
            <img 
              src={event.headerImage} 
              alt={event.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="p-4 space-y-3">
          {/* Title and Tags */}
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-text-primary line-clamp-2">
              {event.title}
            </h3>
            {event.tags && event.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {event.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag.id} variant="primary" size="sm">
                    {tag.tag}
                  </Badge>
                ))}
                {event.tags.length > 3 && (
                  <Badge variant="default" size="sm">
                    +{event.tags.length - 3}
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Summary */}
          {event.summary && (
            <p className="text-sm text-text-secondary line-clamp-2">
              {event.summary}
            </p>
          )}

          {/* Date and Time */}
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <span>📅</span>
            <span className="font-medium">{formatDate(event.startTime)}</span>
            <span>•</span>
            <span>{formatTime(event.startTime)}</span>
          </div>

          {/* Location */}
          {event.location && (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <span>📍</span>
              <span className="truncate">{event.location}</span>
            </div>
          )}

          {/* Stats */}
          {event._count && (
            <div className="flex items-center gap-4 pt-2 border-t border-border-default text-sm text-text-secondary">
              {event._count.attendance > 0 && (
                <div className="flex items-center gap-1">
                  <span>👥</span>
                  <span>{event._count.attendance}</span>
                </div>
              )}
              {event._count.likes > 0 && (
                <div className="flex items-center gap-1">
                  <span>❤️</span>
                  <span>{event._count.likes}</span>
                </div>
              )}
              {event._count.comments > 0 && (
                <div className="flex items-center gap-1">
                  <span>💬</span>
                  <span>{event._count.comments}</span>
                </div>
              )}
            </div>
          )}

          {/* Organizer */}
          {event.user && (
            <div className="flex items-center gap-2 pt-2 border-t border-border-default">
              <Avatar 
                src={event.user.profileImage || undefined}
                name={event.user.name || event.user.username}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text-primary truncate">
                  {event.user.name || event.user.username}
                </div>
                <div className="text-xs text-text-secondary truncate">
                  @{event.user.username}
                </div>
              </div>
            </div>
          )}

          {/* Sign Up CTA for unauthenticated users */}
          {!isAuthenticated && (
            <div className="pt-2">
              <div className="text-xs text-text-secondary text-center">
                <Link to="/login" className="text-primary-600 dark:text-primary-400 hover:underline">
                  Sign up to RSVP
                </Link>
              </div>
            </div>
          )}
        </div>
      </Card>
    </Link>
  )
}
