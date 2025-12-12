import { Link } from 'react-router-dom'
import { Card, Badge, Button, Avatar } from './ui'
import { Stack } from './layout'
import { useAuth } from '../hooks/useAuth'
import { formatTime, formatRelativeDate } from '../lib/formatUtils'
import { AttendeesIcon, LikeIcon, CommentIcon, LocationIcon, CalendarIcon } from './icons'
import { getVisibilityMeta } from '../lib/visibility'
import type { Event } from '@/types'

interface EventCardPropsBase {
	event: Event
}

// Legacy API: formatter + viewMode
interface EventCardPropsLegacy extends EventCardPropsBase {
	formatter: Intl.DateTimeFormat
	viewMode?: 'grid' | 'list'
	variant?: never
	isAuthenticated?: never
}

// New API: variant + isAuthenticated
interface EventCardPropsNew extends EventCardPropsBase {
	variant?: 'full' | 'compact'
	isAuthenticated?: boolean
	formatter?: never
	viewMode?: never
}

type EventCardProps = EventCardPropsLegacy | EventCardPropsNew

export function EventCard(props: EventCardProps) {
	const { event } = props
	const { user } = useAuth()

	// Determine which API is being used
	const isLegacyAPI = 'formatter' in props && props.formatter !== undefined
	const viewMode = isLegacyAPI ? props.viewMode || 'grid' : undefined
	const variant = isLegacyAPI ? undefined : props.variant || 'full'
	const isAuthenticated = isLegacyAPI ? Boolean(user) : (props.isAuthenticated ?? false)

	const eventPath = event.user?.username
		? `/@${event.user.username}/${event.originalEventId || event.id}`
		: `/events/${event.id}`

	// Legacy date formatting
	const formatEventDateTime = (isoString: string) => {
		if (!isLegacyAPI || !props.formatter) {
			return isoString
		}
		const date = new Date(isoString)
		if (Number.isNaN(date.getTime())) {
			return isoString
		}
		return props.formatter.format(date)
	}

	// Legacy API: List view
	if (isLegacyAPI && viewMode === 'list') {
		const visibilityMeta = getVisibilityMeta(event.visibility)
		const visibilityBadgeVariant = event.visibility === 'PUBLIC' ? 'primary' : 'default'

		return (
			<Card className="p-5 space-y-3 hover:shadow-md transition-shadow">
				<Stack
					direction="column"
					directionMd="row"
					alignMd="center"
					justifyMd="between"
					gap="sm">
					<div>
						<h3 className="text-lg font-semibold text-text-primary">{event.title}</h3>
						<p className="text-sm text-text-secondary">
							{formatEventDateTime(event.startTime)}
							{event.location && <span> • {event.location}</span>}
						</p>
						{event.user && (
							<p className="text-xs text-text-secondary">
								Hosted by @{event.user.username}
							</p>
						)}
					</div>
					<div className="flex gap-2 flex-wrap">
						<Badge variant={visibilityBadgeVariant}>
							{visibilityMeta.icon} {visibilityMeta.label}
						</Badge>
						{event.eventStatus && (
							<Badge variant="default">
								{event.eventStatus.replace('Event', '')}
							</Badge>
						)}
						{event.eventAttendanceMode && (
							<Badge variant="default">
								{event.eventAttendanceMode.replace('EventAttendanceMode', '')}
							</Badge>
						)}
					</div>
				</Stack>

				{event.summary && (
					<p className="text-sm text-text-secondary line-clamp-3">{event.summary}</p>
				)}

				{event.tags && event.tags.length > 0 && (
					<div className="flex flex-wrap gap-2">
						{event.tags.map((tag) => (
							<Badge key={tag.id} variant="default">
								#{tag.tag}
							</Badge>
						))}
					</div>
				)}

				<div className="flex flex-wrap items-center gap-4 text-sm text-text-secondary">
					{typeof event._count?.attendance === 'number' && (
						<div className="flex items-center gap-1">
							<AttendeesIcon className="w-4 h-4" aria-label="Attendees" />
							<span>{event._count.attendance} attending</span>
						</div>
					)}
					{typeof event._count?.likes === 'number' && (
						<div className="flex items-center gap-1">
							<LikeIcon className="w-4 h-4" aria-label="Likes" />
							<span>{event._count.likes} likes</span>
						</div>
					)}
					{typeof event._count?.comments === 'number' && (
						<div className="flex items-center gap-1">
							<CommentIcon className="w-4 h-4" aria-label="Comments" />
							<span>{event._count.comments} comments</span>
						</div>
					)}
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

	// Legacy API: Grid view
	if (isLegacyAPI && viewMode === 'grid') {
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
					<h3 className="text-lg font-semibold text-text-primary line-clamp-2">
						{event.title}
					</h3>
					<p className="text-sm text-text-secondary">
						{formatEventDateTime(event.startTime)}
					</p>
					{event.location && (
						<div className="flex items-center gap-2 text-sm text-text-secondary">
							<LocationIcon className="w-4 h-4" aria-label="Location" />
							<span>{event.location}</span>
						</div>
					)}
					{event.user && (
						<p className="text-xs text-text-secondary">by @{event.user.username}</p>
					)}

					{event.summary && (
						<p className="text-sm text-text-secondary line-clamp-2">{event.summary}</p>
					)}

					{event.tags && event.tags.length > 0 && (
						<div className="flex flex-wrap gap-1">
							{event.tags.slice(0, 3).map((tag) => (
								<Badge key={tag.id} variant="default" size="sm">
									#{tag.tag}
								</Badge>
							))}
							{event.tags.length > 3 && (
								<Badge
									variant="default"
									size="sm"
									aria-label={`${event.tags.length - 3} more tags`}>
									+{event.tags.length - 3}
								</Badge>
							)}
						</div>
					)}

					<div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary">
						{typeof event._count?.attendance === 'number' && (
							<div className="flex items-center gap-1">
								<AttendeesIcon className="w-4 h-4" aria-label="Attendees" />
								<span>{event._count.attendance}</span>
							</div>
						)}
						{typeof event._count?.likes === 'number' && (
							<div className="flex items-center gap-1">
								<LikeIcon className="w-4 h-4" aria-label="Likes" />
								<span>{event._count.likes}</span>
							</div>
						)}
					</div>
				</div>

				<Stack className="mt-auto pt-3" gap="sm">
					{eventPath && (
						<Link to={eventPath} className="w-full">
							<Button variant="primary" className="w-full">
								View event
							</Button>
						</Link>
					)}
					{!user && (
						<Link to="/login" className="w-full">
							<Button variant="secondary" className="w-full">
								Sign up to RSVP
							</Button>
						</Link>
					)}
				</Stack>
			</Card>
		)
	}

	// New API: Compact variant
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

	// New API: Full variant (default)
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
