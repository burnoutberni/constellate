import { Link } from 'react-router-dom'

import { EventActions } from './EventActions'
import { Avatar } from './ui'

interface EventHeaderProps {
	/**
	 * Event organizer/owner information
	 */
	organizers: Array<{
		id: string
		username: string
		name?: string | null
		profileImage?: string | null
		displayColor?: string | null
		isRemote?: boolean
	}>
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
	organizers,
	eventId,
	isOwner = false,
	onDelete,
	isDeleting = false,
	onDuplicate,
	isDuplicating = false,
}: EventHeaderProps) {
	// Use the first organizer for actions/links if multiple
	const primaryOrganizer = organizers[0]

	if (!primaryOrganizer) {
		return null
	}

	return (
		<div className="flex items-start justify-between">
			<div className="space-y-4">
				{organizers.map((organizer) => (
					<Link
						key={organizer.id || organizer.username}
						to={`/@${organizer.username}`}
						className="flex items-start gap-4 hover:opacity-80 transition-opacity">
						<Avatar
							src={organizer.profileImage || undefined}
							alt={organizer.name || organizer.username}
							fallback={(organizer.name || organizer.username).charAt(0).toUpperCase()}
							size="lg"
						/>
						<div>
							<div className="font-semibold text-lg text-text-primary">
								{organizer.name || organizer.username}
							</div>
							<div className="text-text-secondary">@{organizer.username}</div>
						</div>
					</Link>
				))}
			</div>
			{eventId && (
				<EventActions
					username={primaryOrganizer.username}
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
