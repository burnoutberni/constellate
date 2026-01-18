import {
	CalendarIcon,
	LocationIcon,
	AttendeesIcon,
	LikeIcon,
	CommentIcon,
	Card,
	CardContent,
	SafeHTML,
} from '@/components/ui'
import type { Event } from '@/types'

import { formatDate, formatTime } from '../lib/formatUtils'

interface UserEventListProps {
	events: Event[]
	onEventClick: (eventId: string) => void
}

function isPast(event: Event): boolean {
	const now = new Date()
	const end = event.endTime ? new Date(event.endTime) : new Date(event.startTime)
	if (!event.endTime) {
		return new Date(event.startTime) < now
	}
	return end < now
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
				{events.map((event, index) => {
					const currentIsPast = isPast(event)
				const prevIsPast = index > 0 ? isPast(events[index - 1]) : false
				const showSeparator = index > 0 && currentIsPast && !prevIsPast

				return (
					<div key={event.id}>
						{showSeparator && (
							<div className="flex items-center gap-4 my-6">
								<div className="h-px bg-border flex-1" />
								<span className="text-sm font-medium text-text-tertiary uppercase tracking-wider">
									Past Events
								</span>
								<div className="h-px bg-border flex-1" />
							</div>
						)}
						<Card
							variant="default"
							padding="lg"
							interactive
							onClick={() => onEventClick(event.id)}
							className="hover:shadow-md overflow-hidden">
							{/* Event Header Image */}
							{event.headerImage && (
								<div className="-mt-6 -mx-6 mb-4">
									<img
										src={event.headerImage}
										alt={event.title}
										className="w-full h-48 object-cover"
									/>
								</div>
							)}

							{/* Event Title */}
							<h3 className="text-lg font-semibold text-text-primary mb-2">{event.title}</h3>

							{/* Event Summary */}
							{event.summary && (
								<div className="text-text-secondary mb-3 line-clamp-2">
									<SafeHTML html={event.summary} />
								</div>
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
					</div>
				)
			})}
		</div>
	)
}
