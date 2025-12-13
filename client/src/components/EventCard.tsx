import { Link } from 'react-router-dom'

import type { Event } from '@/types'

import { formatTime, formatRelativeDate } from '../lib/formatUtils'

import { AttendeesIcon, LikeIcon, CommentIcon, LocationIcon, CalendarIcon } from './icons'
import { Card, Badge, Avatar } from './ui'

interface EventCardProps {
	event: Event
	variant?: 'full' | 'compact'
	isAuthenticated?: boolean
}

export function EventCard(props: EventCardProps) {
	const { event, variant = 'full', isAuthenticated = false } = props

	const eventPath = event.user?.username
		? `/@${event.user.username}/${event.originalEventId || event.id}`
		: `/events/${event.id}`

	// Compact variant
	if (variant === 'compact') {
		return (
			<Link to={eventPath}>
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
							<CalendarIcon className="w-4 h-4" aria-label="Date" />
							<span>{formatRelativeDate(event.startTime)}</span>
							<span>•</span>
							<span>{formatTime(event.startTime)}</span>
						</div>

						{event.location && (
							<div className="flex items-center gap-2 text-sm text-text-secondary">
								<LocationIcon className="w-4 h-4" aria-label="Location" />
								<span className="truncate">{event.location}</span>
							</div>
						)}

						{event.user && (
							<div className="flex items-center gap-2 pt-2 border-t border-border-default">
								<Avatar
									src={event.user.profileImage || undefined}
									fallback={event.user.name || event.user.username}
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

	// Full variant (default)
	return (
		<div className="h-full">
			<Link to={eventPath} className="block h-full">
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
							{event.tags.length > 0 && (
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
						{event.summary ? (
							<p className="text-sm text-text-secondary line-clamp-2">
								{event.summary}
							</p>
						) : null}

						{/* Date and Time */}
						<div className="flex items-center gap-2 text-sm text-text-secondary">
							<CalendarIcon className="w-4 h-4" aria-label="Date" />
							<span className="font-medium">
								{formatRelativeDate(event.startTime)}
							</span>
							<span>•</span>
							<span>{formatTime(event.startTime)}</span>
						</div>

						{/* Location */}
						{event.location && (
							<div className="flex items-center gap-2 text-sm text-text-secondary">
								<LocationIcon className="w-4 h-4" aria-label="Location" />
								<span className="truncate">{event.location}</span>
							</div>
						)}

						{/* Stats */}
						{event._count && (
							<div className="flex items-center gap-4 pt-2 border-t border-border-default text-sm text-text-secondary">
								{event._count.attendance > 0 && (
									<div className="flex items-center gap-1">
										<AttendeesIcon className="w-4 h-4" aria-label="Attendees" />
										<span>{event._count.attendance}</span>
									</div>
								)}
								{event._count.likes > 0 && (
									<div className="flex items-center gap-1">
										<LikeIcon className="w-4 h-4" aria-label="Likes" />
										<span>{event._count.likes}</span>
									</div>
								)}
								{event._count.comments > 0 && (
									<div className="flex items-center gap-1">
										<CommentIcon className="w-4 h-4" aria-label="Comments" />
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
									fallback={event.user.name || event.user.username}
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
					</div>
				</Card>
			</Link>
			{/* Sign Up CTA for unauthenticated users - outside the Link to avoid nesting */}
			{!isAuthenticated && (
				<div className="pt-2 px-4 pb-4">
					<div className="text-xs text-text-secondary text-center">
						<Link
							to="/login"
							className="text-primary-600 dark:text-primary-400 hover:underline"
							onClick={(e) => e.stopPropagation()}>
							Sign up to RSVP
						</Link>
					</div>
				</div>
			)}
		</div>
	)
}
