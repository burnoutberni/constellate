import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Avatar, Badge, Button } from './ui'

export interface Attendee {
	user: {
		id: string
		username: string
		name?: string | null
		profileImage?: string | null
		displayColor?: string | null
	}
	status: string
}

interface AttendeeListProps {
	/**
	 * List of event attendees
	 */
	attendees: Attendee[]
	/**
	 * Maximum number of attendees to show initially
	 * @default 10
	 */
	initialDisplayCount?: number
	/**
	 * Whether to show attendee avatars
	 * @default true
	 */
	showAvatars?: boolean
	/**
	 * Whether the attendee list is publicly viewable
	 */
	isPublic?: boolean
}

/**
 * AttendeeList displays a list of event attendees with their status.
 * Supports showing a limited number initially with a "show more" button.
 */
export function AttendeeList({
	attendees,
	initialDisplayCount = 10,
	showAvatars = true,
}: AttendeeListProps) {
	const [showAll, setShowAll] = useState(false)

	if (attendees.length === 0) {
		return null
	}

	const displayedAttendees = showAll ? attendees : attendees.slice(0, initialDisplayCount)
	const hasMore = attendees.length > initialDisplayCount

	// Separate attendees by status
	const attending = attendees.filter((a) => a.status === 'attending')
	const maybe = attendees.filter((a) => a.status === 'maybe')

	return (
		<div className="mb-6">
			<h3 className="font-bold mb-3 text-text-primary">
				Attendees ({attending.length} going, {maybe.length} maybe)
			</h3>

			{showAvatars ? (
				<div className="space-y-4">
					{/* Going Section */}
					{attending.length > 0 && (
						<div>
							<h4 className="text-sm font-semibold text-text-secondary mb-2">
								Going
							</h4>
							<div className="flex flex-wrap gap-3">
								{(showAll
									? attending
									: attending.slice(0, initialDisplayCount)
								).map((a) => (
									<Link
										key={a.user.id}
										to={`/@${a.user.username}`}
										className="flex items-center gap-2 hover:opacity-80 transition-opacity"
										title={a.user.name || a.user.username}>
										<Avatar
											src={a.user.profileImage || undefined}
											alt={a.user.name || a.user.username}
											fallback={(a.user.name || a.user.username)[0]}
											size="sm"
										/>
										<span className="text-sm font-medium text-text-primary">
											{a.user.name || a.user.username}
										</span>
									</Link>
								))}
							</div>
						</div>
					)}

					{/* Maybe Section */}
					{maybe.length > 0 && (
						<div>
							<h4 className="text-sm font-semibold text-text-secondary mb-2">
								Maybe
							</h4>
							<div className="flex flex-wrap gap-3">
								{(showAll
									? maybe
									: maybe.slice(
											0,
											Math.max(1, initialDisplayCount - attending.length)
										)
								).map((a) => (
									<Link
										key={a.user.id}
										to={`/@${a.user.username}`}
										className="flex items-center gap-2 hover:opacity-80 transition-opacity"
										title={a.user.name || a.user.username}>
										<Avatar
											src={a.user.profileImage || undefined}
											alt={a.user.name || a.user.username}
											fallback={(a.user.name || a.user.username)[0]}
											size="sm"
										/>
										<span className="text-sm font-medium text-text-secondary">
											{a.user.name || a.user.username}
										</span>
									</Link>
								))}
							</div>
						</div>
					)}
				</div>
			) : (
				<div className="flex flex-wrap gap-2">
					{displayedAttendees.map((a) => (
						<Badge key={a.user.id} variant="primary" size="md">
							{a.user.name || a.user.username}
							{a.status === 'maybe' && ' (Maybe)'}
						</Badge>
					))}
				</div>
			)}

			{/* Show More Button */}
			{hasMore && !showAll && (
				<Button variant="ghost" size="sm" onClick={() => setShowAll(true)} className="mt-3">
					+{attendees.length - initialDisplayCount} more
				</Button>
			)}

			{/* Show Less Button */}
			{showAll && hasMore && (
				<Button
					variant="ghost"
					size="sm"
					onClick={() => setShowAll(false)}
					className="mt-3">
					Show less
				</Button>
			)}
		</div>
	)
}
