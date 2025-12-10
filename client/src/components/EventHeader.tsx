import { Link } from 'react-router-dom'
import { Avatar } from './ui/Avatar'
import { EventActions } from './EventActions'

export interface EventHeaderProps {
  /**
   * Event organizer/owner information
   */
  organizer: {
    id: string
    username: string
    name?: string | null
    profileImage?: string | null
    displayColor?: string | null
  }
  /**
   * Event ID
   */
  eventId?: string
  /**
   * Whether the current user is the event owner
   */
  isOwner?: boolean
  /**
   * Callback for delete event action
   */
  onDelete?: () => void
  /**
   * Whether the delete action is in progress
   */
  isDeleting?: boolean
  /**
   * Callback for duplicate action
   */
  onDuplicate?: () => void
  /**
   * Whether duplicate is in progress
   */
  isDuplicating?: boolean
}

/**
 * EventHeader component displays the event organizer information
 * and provides event management actions for the owner.
 * 
 * Used on the event detail page to show who created the event.
 */
export function EventHeader({
  organizer,
  eventId,
  isOwner = false,
  onDelete,
  isDeleting = false,
  onDuplicate,
  isDuplicating = false,
}: EventHeaderProps) {
  return (
    <div className="flex items-start justify-between">
      <Link
        to={`/@${organizer.username}`}
        className="flex items-start gap-4 hover:opacity-80 transition-opacity"
      >
        <Avatar
          src={organizer.profileImage || undefined}
          alt={organizer.name || organizer.username}
<<<<<<< HEAD
          fallback={(organizer.name || organizer.username).charAt(0).toUpperCase()}
=======
          fallback={organizer.name?.[0] || organizer.username[0]}
>>>>>>> 0136c33 (WP-106: Add EventHeader, EventInfo, SignUpPrompt components and refactor EventDetailPage)
          size="lg"
        />
        <div>
          <div className="font-semibold text-lg text-text-primary">
            {organizer.name || organizer.username}
          </div>
          <div className="text-text-secondary">@{organizer.username}</div>
        </div>
      </Link>
      {isOwner && eventId && (
        <EventActions
          username={organizer.username}
          eventId={eventId}
          isOwner={isOwner}
          onDelete={onDelete}
          isDeleting={isDeleting}
          onDuplicate={onDuplicate}
          isDuplicating={isDuplicating}
        />
      )}
    </div>
  )
}
