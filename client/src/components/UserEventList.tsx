import { tokens } from '@/design-system'
import type { Event } from '@/types'

import { formatDate, formatTime } from '../lib/formatUtils'

import { CalendarIcon, LocationIcon, AttendeesIcon, LikeIcon, CommentIcon } from './icons'
import { Card, CardContent } from './ui'

interface UserEventListProps {
	events: Event[]
	onEventClick: (eventId: string) => void
}

/**
 * UserEventList component displays a list of events created by a user.
 */
export function UserEventList({ events, onEventClick }: UserEventListProps) {
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
					className="hover:shadow-md">
					{/* Event Header Image */}
					{event.headerImage && (
						<img
							src={event.headerImage}
							alt={event.title}
							className="w-full h-48 object-cover rounded-lg mb-4 -mt-6 -mx-6"
							style={{ width: `calc(100% + ${tokens.spacing[12]})` }}
						/>
					)}

					{/* Event Title */}
					<h3 className="text-lg font-semibold text-text-primary mb-2">{event.title}</h3>

					{/* Event Summary */}
					{event.summary && (
						<p className="text-text-secondary mb-3 line-clamp-2">{event.summary}</p>
					)}

					{/* Event Metadata */}
					<div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm text-text-tertiary mb-3">
						{/* Date and Time */}
						<div className="flex items-center gap-1.5">
							<CalendarIcon className="w-4 h-4 flex-shrink-0" />
							<span>
								{formatDate(event.startTime)} at {formatTime(event.startTime)}
							</span>
						</div>

						{/* Location */}
						{event.location && (
							<div className="flex items-center gap-1.5">
								<LocationIcon className="w-4 h-4 flex-shrink-0" />
								<span className="truncate">{event.location}</span>
							</div>
						)}
					</div>

					{/* Event Stats */}
					<div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm text-text-tertiary">
						<div className="flex items-center gap-1.5">
							<AttendeesIcon className="w-4 h-4" />
							<span>{event._count?.attendance || 0} attending</span>
						</div>
						<div className="flex items-center gap-1.5">
							<LikeIcon className="w-4 h-4" />
							<span>{event._count?.likes || 0} likes</span>
						</div>
						<div className="flex items-center gap-1.5">
							<CommentIcon className="w-4 h-4" />
							<span>{event._count?.comments || 0} comments</span>
						</div>
					</div>
				</Card>
			))}
		</div>
	)
}
