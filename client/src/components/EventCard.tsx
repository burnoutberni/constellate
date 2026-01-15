import React from 'react'
import { Link } from 'react-router-dom'

import {
	/* Icons */
	LocationIcon,
	CalendarIcon,
	CommentIcon,
	/* Components */
	Card,
	Badge,
	Avatar,
	SafeHTML,
} from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { cn, getInitials, normalizeHandleForComparison } from '@/lib/utils'
import type { Event } from '@/types'

import { formatTime, formatDate } from '../lib/formatUtils'

import { AttendeeFacepile } from './AttendeeFacepile'
import { CardOptionsMenu } from './CardOptionsMenu'
import { RSVPButton } from './RSVPButton'

const TWO_HOURS_IN_MS = 2 * 60 * 60 * 1000

interface EventCardProps {
	event: Event
	variant?: 'full' | 'compact'
	isAuthenticated?: boolean
}

export function EventCard(props: EventCardProps) {
	const { event, variant = 'full', isAuthenticated = false } = props
	const { user } = useAuth()
	const [isMenuOpen, setMenuOpen] = React.useState(false)
	const isOwner = Boolean(user?.id) && user?.id === event.user?.id

	// Determine visual status style
	// Owner > Attending > Maybe > None
	let statusStripColor = ''
	if (isOwner) {
		statusStripColor = 'bg-primary-500'
	} else if (event.viewerStatus === 'attending') {
		statusStripColor = 'bg-success-500'
	} else if (event.viewerStatus === 'maybe') {
		statusStripColor = 'bg-warning-500'
	}

	// Determine if event is remote and get the appropriate link
	const isRemote = !event.user && (Boolean(event.url) || Boolean(event.externalId))

	// Use local paths for all events
	// - If we have a local user, use the vanity URL /@username/eventId
	// - If it's a remote event (no local user), use the generic /events/eventId
	// - If we have organizers, prefer the first organizer's username for the vanity URL
	let eventLink = `/events/${event.id}`
	if (event.user?.username) {
		eventLink = `/@${event.user.username}/${event.id}`
	}
	
	// If we have organizers, try to construct a better link
	if (event.organizers && event.organizers.length > 0) {
		// Prefer the first organizer if they have a valid username (not 'unknown')
		const primaryOrg = event.organizers[0]
		if (primaryOrg.username && primaryOrg.username !== 'unknown') {
			// If event.user is present, only override if organizer is different
			// Use explicit null/undefined checks to avoid comparing null with strings
			const userUsername = event.user?.username
			if (!userUsername || userUsername !== primaryOrg.username) {
				eventLink = `/@${primaryOrg.username}/${event.id}`
			}
		}
	}

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

	const now = new Date()
	const start = new Date(event.startTime)
	const end = event.endTime ? new Date(event.endTime) : null
	// Event is ongoing if it started in the past AND (has an end time in future OR has no end time but started less than 2h ago)
	const isOngoing = start <= now && (end ? end > now : (now.getTime() - start.getTime() < TWO_HOURS_IN_MS))

		const renderOrganizers = () => {
		const { organizers } = event
		const hasOrganizers = organizers && organizers.length > 0

		// If we have a local user and explicit organizers, determine if they are effectively the same person.
		// If they are the same, we prefer the "User" block (nicer UI).
		// If they are different (e.g. event.user is 'julia' but organizer is 'sozial'), we MUST show organizers.
		let isOrganizerDifferent = false
		if (hasOrganizers && event.user) {
			const org = organizers[0]
			if (!org) {
				return null
			}
			// Normalize both handles for robust comparison
			// event.user.username is like 'julia@domain' or 'julia'
			// org.display is like '@julia@domain'
			// org.username is 'julia'
			const userHandle = event.user.username
			const orgHandle = org.display.replace(/^@/, '')

			// Normalize both to local parts for comparison
			const normalizedUserHandle = normalizeHandleForComparison(userHandle)
			const normalizedOrgHandle = normalizeHandleForComparison(orgHandle)
			const normalizedOrgUsername = normalizeHandleForComparison(org.username)

			// Handles match if either normalized handles match, or if org.username normalized matches userHandle
			const isSameHandle =
				normalizedUserHandle === normalizedOrgHandle ||
				normalizedUserHandle === normalizedOrgUsername ||
				normalizedOrgHandle === normalizedOrgUsername

			isOrganizerDifferent = !isSameHandle
		} else if (hasOrganizers && !event.user) {
			isOrganizerDifferent = true
		}

		if (hasOrganizers && (organizers.length > 1 || isOrganizerDifferent)) {
			return (
				<div className="pt-2 border-t border-border-default space-y-2">
					<div className="text-xs text-text-secondary font-medium">Organized by</div>
					{organizers.map((org) => {
                        const profileLink = org.username ? `/@${org.username}` : org.url;
                        const isExternal = !org.username || org.username === 'unknown';
                        
                        const Content = (
                            <div className="flex items-center gap-2">
                                <Avatar
                                    src={org.profileImage || undefined}
                                    fallback={getInitials(org.name || org.display, org.username)}
                                    alt={org.name || org.display}
                                    size="sm"
                                    className="w-6 h-6 text-xs"
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm text-text-primary truncate">
                                        {org.name || org.display}
                                    </div>
                                    {org.name && (
                                        <div className="text-xs text-text-secondary truncate">
                                            {org.display}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )

                        // If we have a username, it's a local or properly resolved remote user -> internal link
                        if (!isExternal) {
                            return (
                                <Link key={org.url || org.username} to={profileLink} className="block hover:underline decoration-text-primary relative z-20">
                                    {Content}
                                </Link>
                            )
                        }

                        // Otherwise it's an external URL
                        return (
                            <a 
                                key={org.url || org.username} 
                                href={profileLink} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="block hover:underline decoration-text-primary relative z-20"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {Content}
                            </a>
                        )
                    })}
				</div>
			)
		}

		// 2. Local User
		if (event.user) {
            const profileLink = `/@${event.user.username}`
			return (
                <div className="pt-2 border-t border-border-default">
                    <Link to={profileLink} className="flex items-center gap-2 hover:underline decoration-text-primary relative z-20">
                        <Avatar
                            src={event.user.profileImage || undefined}
                            fallback={getInitials(event.user.name, event.user.username)}
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
                    </Link>
                </div>
			)
		}

		// 3. Fallback to attributedTo
		if (event.attributedTo) {
            // Try to make this a link if it looks like a profile URL
            const isUrl = event.attributedTo.startsWith('http');
			return (
				<div className="flex items-center gap-2 pt-2 border-t border-border-default">
					<Avatar
						fallback={getInitials(getAttributedToName(event.attributedTo), undefined)}
						size="sm"
					/>
					<div className="flex-1 min-w-0">
						<div className="text-sm font-medium text-text-primary truncate">
                            {isUrl ? (
                                <a 
                                    href={event.attributedTo}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:underline decoration-text-primary relative z-20"
                                    onClick={(e) => e.stopPropagation()}
                                >
							        {getAttributedToName(event.attributedTo)}
                                </a>
                            ) : (
                                <span>{getAttributedToName(event.attributedTo)}</span>
                            )}
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
		<Card padding={variant === 'full' ? 'none' : 'md'} className="h-full relative overflow-visible group/card">
			{statusStripColor && (
				<div className={cn("absolute left-0 top-0 bottom-0 w-1 z-10 rounded-l-lg", statusStripColor)} />
			)}
			{/* Compact Variant Content */}
			{variant === 'compact' && (
				<div className="space-y-1">
					<div className="flex items-start justify-between gap-2">
						<h3 className="font-semibold text-text-primary line-clamp-2 flex-1 text-sm">
							<Link to={eventLink} className="hover:underline decoration-text-primary focus:outline-none after:absolute after:inset-0">
								{event.title}
							</Link>
						</h3>
						<div className="flex items-center gap-1 flex-shrink-0 relative z-20">
							{isAuthenticated && (
								<RSVPButton
									eventId={event.id}
									currentStatus={event.viewerStatus}
									size="sm"
									onOpenChange={setMenuOpen}
									variant="icon"
								/>
							)}
						</div>
					</div>

					<div className="flex items-center gap-2 text-xs text-text-secondary pointer-events-none">
						<CalendarIcon className="w-3.5 h-3.5" aria-label="Date" />
						<span>{formatDate(event.startTime, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
					</div>

					{event.location && (
						<div className="flex items-center gap-2 text-xs text-text-secondary pointer-events-none">
							<LocationIcon className="w-3.5 h-3.5" aria-label="Location" />
							<span className="truncate">{event.location}</span>
						</div>
					)}

					{/* Ongoing Badge for Compact View */}
					{isOngoing && (
						<div className="pt-1 pointer-events-none">
							<Badge variant="success" size="sm" className="animate-pulse">
								Happening Now
							</Badge>
						</div>
					)}

					{/* Attendance Facepile - Only show when there are attendees */}
					{(event._count?.attendance ? event._count.attendance > 0 : (event.attendance && event.attendance.length > 0)) && (
						<div className="pt-1 relative z-20">
							<AttendeeFacepile attendance={event.attendance} counts={event._count} alwaysShowCounts />
						</div>
					)}
					<div className="relative z-20">
						{renderOrganizers()}
					</div>
				</div>
			)}

			{/* Full Variant Content */}
			{variant === 'full' && (
				<div className="flex flex-col h-full">
					{event.headerImage && (
						<div className="relative w-full h-48 bg-background-tertiary">
							<img
								src={event.headerImage}
								alt={event.title}
								className="w-full h-full object-cover"
							/>
						</div>
					)}

					<div className="p-4 space-y-3 flex-1 flex flex-col">
						<div className="space-y-2">
							<div className="flex justify-between items-start gap-2">
								<h3 className="text-xl font-bold text-text-primary line-clamp-2 flex-1">
									<Link to={eventLink} className="hover:underline decoration-text-primary focus:outline-none after:absolute after:inset-0">
										{event.title}
										{isRemote && <span className="ml-2 text-xs font-normal text-text-tertiary border border-border-default rounded px-1.5 align-middle inline-block">Remote</span>}
									</Link>
								</h3>

								<div className="flex items-center gap-2 flex-shrink-0 z-20 relative">
									{/* RSVP Button - Available at all times if authenticated */}
									{isAuthenticated && (
										<RSVPButton
											eventId={event.id}
											currentStatus={event.viewerStatus}
											size="sm"
											onOpenChange={setMenuOpen}
										/>
									)}

									{/* Hamburger Menu (Report, Edit, Delete provided by CardOptionsMenu) */}
									{isAuthenticated && (
										<CardOptionsMenu event={event} onOpenChange={setMenuOpen} />
									)}
								</div>
							</div>

							{(isOngoing || (event.tags && event.tags.length > 0)) && (
								<div className="flex flex-wrap gap-2 relative z-20">
									{isOngoing && (
										<Badge variant="success" size="sm" className="animate-pulse">
											Happening Now
										</Badge>
									)}
									{event.tags && event.tags.slice(0, 3).map((tag) => (
										<Badge key={tag.id} variant="primary" size="sm">
											{tag.tag}
										</Badge>
									))}
									{event.tags && event.tags.length > 3 && (
										<Badge variant="default" size="sm">
											+{event.tags.length - 3}
										</Badge>
									)}
								</div>
							)}
						</div>

						{event.summary ? (
							<div className="text-sm text-text-secondary line-clamp-2 relative z-10">
								<SafeHTML html={event.summary} />
							</div>
						) : null}

						<div className="flex items-center gap-2 text-sm text-text-secondary mt-auto pointer-events-none">
							<CalendarIcon className="w-4 h-4" aria-label="Date" />
							<span className="font-medium">
								{formatDate(event.startTime, { weekday: 'long', month: 'long', day: 'numeric' })}
							</span>
							<span>•</span>
							<span>{formatTime(event.startTime)}</span>
						</div>

						{event.location && (
							<div className="flex items-center gap-1 pointer-events-none">
								<LocationIcon className="w-4 h-4" aria-label="Location" />
								<span className="truncate max-w-[150px]">{event.location}</span>
							</div>
						)}

						{(event._count || (event.attendance && event.attendance.length > 0)) && (
							<div className="flex items-center gap-4 pt-2 border-t border-border-default text-sm text-text-secondary relative z-20">
								{/* Facepile for Attendance */}
								<div className="mr-auto">
									<AttendeeFacepile attendance={event.attendance} counts={event._count} alwaysShowCounts />
								</div>
								{event._count && event._count.comments > 0 && (
									<div className="flex items-center gap-1">
										<CommentIcon className="w-4 h-4" aria-label="Comments" />
										<span>{event._count.comments}</span>
									</div>
								)}
							</div>
						)}

						{/* Always show organizer section */}
						<div className="relative z-20">
							{renderOrganizers()}
						</div>
					</div>
				</div>
			)}
		</Card>
	)

	return (
		<div className={cn("h-full relative group hover:z-10 focus-within:z-20", isMenuOpen && "z-30")}>
			{renderCardContent()}

			{!isAuthenticated && !isRemote && (
				<div className="pt-2 px-4 pb-4">
					<div className="text-xs text-text-secondary text-center relative z-20">
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
