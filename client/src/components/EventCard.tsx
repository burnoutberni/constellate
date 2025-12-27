import { Link } from 'react-router-dom'

import {
	AttendeesIcon,
	LikeIcon,
	CommentIcon,
	LocationIcon,
	CalendarIcon,
	Card,
	Badge,
	Avatar,
	SafeHTML,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import type { Event } from '@/types'

import { formatTime, formatRelativeDate } from '../lib/formatUtils'

import { ReportButton } from './ReportButton'

interface EventCardProps {
	event: Event
	variant?: 'full' | 'compact'
	isAuthenticated?: boolean
}

function EventReportButton({ event, className }: { event: Event; className?: string }) {
	if (!event.id || !event.title) {
		return null
	}

	return (
		<div
			className={cn(
				'absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity',
				className
			)}>
			<ReportButton
				targetType="event"
				targetId={event.id}
				contentTitle={event.title}
				variant="ghost"
				size="sm"
				className="bg-background-primary/80 backdrop-blur-sm shadow-sm hover:bg-background-primary p-1.5 h-auto rounded-full"
			/>
		</div>
	)
}

export function EventCard(props: EventCardProps) {
	const { event, variant = 'full', isAuthenticated = false } = props

	// Determine if event is remote and get the appropriate link
	const isRemote = !event.user && (Boolean(event.url) || Boolean(event.externalId))

	// Use local paths for all events
	// - If we have a local user, use the vanity URL /@username/eventId
	// - If it's a remote event (no local user), use the generic /events/eventId
	const eventLink = event.user?.username
		? `/@${event.user.username}/${event.id}`
		: `/events/${event.id}`



	// Helper to extract a display name from attributedTo URL if user is missing
	const getAttributedToName = (url?: string | null) => {
		if (!url) { return 'Remote User' }
		try {
			const u = new URL(url)
			// Try to get username from path (e.g. /@luca)
			const pathParts = u.pathname.split('/').filter(Boolean)
			const userPart = pathParts.find(p => p.startsWith('@')) || pathParts[pathParts.length - 1]
			return userPart ? `${userPart}@${u.hostname}` : u.hostname
		} catch {
			return 'Remote User'
		}
	}

	const renderOrganizers = () => {
		// 1. Local User
		if (event.user) {
			return (
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
			)
		}

		// 2. Multiple Organizers (Remote)
		if (event.organizers && event.organizers.length > 0) {
			return (
				<div className="pt-2 border-t border-border-default space-y-2">
					<div className="text-xs text-text-secondary font-medium">Organized by</div>
					{event.organizers.map((org) => (
						<div key={org.url || org.username} className="flex items-center gap-2">
							<Avatar
								fallback={org.username}
								size="sm"
								className="w-6 h-6 text-xs"
							/>
							<div className="flex-1 min-w-0">
								<div className="text-sm text-text-primary truncate">
									{org.display}
								</div>
							</div>
						</div>
					))}
				</div>
			)
		}

		// 3. Fallback to attributedTo
		if (event.attributedTo) {
			return (
				<div className="flex items-center gap-2 pt-2 border-t border-border-default">
					<Avatar
						fallback="?"
						size="sm"
					/>
					<div className="flex-1 min-w-0">
						<div className="text-sm font-medium text-text-primary truncate">
							{getAttributedToName(event.attributedTo)}
						</div>
						<div className="text-xs text-text-secondary truncate opacity-70">
							Remote Source
						</div>
					</div>
				</div>
			)
		}

		return null
	}


	const renderCardContent = () => (
		<Card interactive padding={variant === 'full' ? 'none' : 'md'} className={cn("h-full", variant === 'full' && "overflow-hidden")}>
			{/* Compact Variant Content */}
			{variant === 'compact' && (
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

					{renderOrganizers()}
				</div>
			)}

			{/* Full Variant Content */}
			{variant === 'full' && (
				<>
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
						<div className="space-y-2">
							<h3 className="text-xl font-bold text-text-primary line-clamp-2">
								{event.title}
								{isRemote && <span className="ml-2 text-xs font-normal text-text-tertiary border border-border-default rounded px-1.5 align-middle">Remote</span>}
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

						{event.summary ? (
							<div className="text-sm text-text-secondary line-clamp-2">
								<SafeHTML html={event.summary} />
							</div>
						) : null}

						<div className="flex items-center gap-2 text-sm text-text-secondary">
							<CalendarIcon className="w-4 h-4" aria-label="Date" />
							<span className="font-medium">
								{formatRelativeDate(event.startTime)}
							</span>
							<span>•</span>
							<span>{formatTime(event.startTime)}</span>
						</div>

						{event.location && (
							<div className="flex items-center gap-2 text-sm text-text-secondary">
								<LocationIcon className="w-4 h-4" aria-label="Location" />
								<span className="truncate">{event.location}</span>
							</div>
						)}

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

						{renderOrganizers()}
					</div>
				</>
			)}
		</Card>
	)

	return (
		<div className="h-full relative group">
			<Link to={eventLink} className="block h-full">
				{renderCardContent()}
			</Link>

			{isAuthenticated && <EventReportButton event={event} className="z-10" />}

			{!isAuthenticated && !isRemote && (
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
