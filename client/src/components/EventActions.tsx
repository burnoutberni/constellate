import { Link } from 'react-router-dom'

import { Button } from './ui'

interface EventActionsProps {
	/**
	 * Event username (organizer)
	 */
	username: string
	/**
	 * Event ID
	 */
	eventId: string
	/**
	 * Whether the current user is the event owner
	 */
	isOwner: boolean
	/**
	 * Callback for delete action
	 */
	onDelete?: () => void
	/**
	 * Whether delete is in progress
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
 * EventActions component provides event management actions for owners.
 * Shows edit, delete, and duplicate buttons.
 */
export function EventActions({
	username,
	eventId,
	isOwner,
	onDelete,
	isDeleting = false,
	onDuplicate,
	isDuplicating = false,
}: EventActionsProps) {
	if (!isOwner) {
		return null
	}

	return (
		<div className="flex flex-wrap gap-2">
			<Link to={`/edit/@${username}/${eventId}`}>
				<Button variant="secondary" size="sm" leftIcon={<span>✏️</span>}>
					Edit
				</Button>
			</Link>
			{onDuplicate && (
				<Button
					variant="secondary"
					size="sm"
					onClick={onDuplicate}
					disabled={isDuplicating}
					loading={isDuplicating}
					leftIcon={<span>📋</span>}>
					Duplicate
				</Button>
			)}
			{onDelete && (
				<Button
					variant="danger"
					size="sm"
					onClick={onDelete}
					disabled={isDeleting}
					loading={isDeleting}
					leftIcon={<span>🗑️</span>}>
					Delete
				</Button>
			)}
		</div>
	)
}
