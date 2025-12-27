import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useMemo } from 'react'
import { useLocation, Link, useNavigate } from 'react-router-dom'

import { Container } from '@/components/layout'
import { Button, Card, CardContent, Spinner } from '@/components/ui'
import {
	useEventDetail,
	useRSVP,
	useLikeEvent,
	useAddComment,
	useDeleteEvent,
	useShareEvent,
	useEventReminder,
	queryKeys,
} from '@/hooks/queries'
import { useErrorHandler } from '@/hooks/useErrorHandler'
import { api } from '@/lib/api-client'
import { createLogger } from '@/lib/logger'
import type { UserProfile } from '@/types'

import { AttendanceWidget } from '../components/AttendanceWidget'
import { AttendeeList } from '../components/AttendeeList'
import { CalendarExport } from '../components/CalendarExport'
import { CommentList } from '../components/CommentList'
import { ConfirmationModal } from '../components/ConfirmationModal'
import { EventHeader } from '../components/EventHeader'
import { EventInfo } from '../components/EventInfo'
import { ReminderSelector } from '../components/ReminderSelector'
import { SignupModal } from '../components/SignupModal'
import { useAuth } from '../hooks/useAuth'
import { formatDate } from '../lib/formatUtils'
import { setSEOMetadata } from '../lib/seo'
import { getDefaultTimezone } from '../lib/timezones'

const log = createLogger('[EventDetailPage]')

export function EventDetailPage() {
	const location = useLocation()
	const navigate = useNavigate()
	const { user } = useAuth()
	const handleError = useErrorHandler()
	const [username, setUsername] = useState<string>('')
	const [eventId, setEventId] = useState<string>('')
	const [signupModalOpen, setSignupModalOpen] = useState(false)
	const [pendingAction, setPendingAction] = useState<
		'rsvp' | 'like' | 'comment' | 'share' | null
	>(null)
	const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null)
	const [showDeleteEventConfirm, setShowDeleteEventConfirm] = useState(false)
	const [selectedReminder, setSelectedReminder] = useState<number | null>(null)
	const [hasShared, setHasShared] = useState(false)

	// Extract username and eventId from pathname
	useEffect(() => {
		// Path format: 
		// 1. /@username/eventId (or /@username@domain/eventId)
		// 2. /events/eventId
		const pathParts = location.pathname.split('/').filter(Boolean)

		if (pathParts.length >= 2 && pathParts[0].startsWith('@')) {
			// Case 1: /@username/eventId
			const extractedUsername = pathParts[0].slice(1) // Remove @
			const extractedEventId = pathParts[1]
			setUsername(extractedUsername)
			setEventId(extractedEventId)
		} else if (pathParts.length >= 2 && pathParts[0] === 'events') {
			// Case 2: /events/eventId
			const extractedEventId = pathParts[1]
			setUsername('') // No username context
			setEventId(extractedEventId)
		}
	}, [location.pathname])

	// Fetch event
	const { data: event, isLoading } = useEventDetail(username, eventId)
	const { data: viewerProfile } = useQuery<UserProfile | null>({
		queryKey: queryKeys.users.currentProfile(user?.id),
		queryFn: async () => {
			if (!user?.id) {
				return null
			}
			try {
				return await api.get<UserProfile>(
					'/users/me/profile',
					undefined,
					undefined,
					'Failed to fetch profile'
				)
			} catch {
				return null
			}
		},
		enabled: Boolean(user?.id),
		staleTime: 5 * 60 * 1000,
	})

	// Mutations
	const queryClient = useQueryClient()
	const rsvpMutation = useRSVP(eventId, user?.id)
	const likeMutation = useLikeEvent(eventId, user?.id)
	const shareMutation = useShareEvent(eventId)
	const addCommentMutation = useAddComment(eventId)
	const deleteEventMutation = useDeleteEvent(eventId)
	const reminderMutation = useEventReminder(eventId, username)

	// Derive user's attendance and like status from event data
	const userAttendance = useMemo(() => {
		if (!event || !user) {
			return null
		}
		return event.attendance.find((a) => a.user.id === user.id)?.status || null
	}, [event, user])

	const userLiked = useMemo(() => {
		if (!event || !user) {
			return false
		}
		return Boolean(event.likes.find((l) => l.user.id === user.id))
	}, [event, user])

	// Check if user has already shared this event
	// This checks if the current event is a share by this user, or if the user has shared the original event
	const displayedEventId = useMemo(() => event?.sharedEvent?.id ?? event?.id, [event])

	const userHasShared = useMemo(() => {
		if (!event || !user || !displayedEventId) {
			return false
		}
		return (
			(event.userId === user.id && Boolean(event.sharedEvent)) || event.userHasShared === true
		)
	}, [event, user, displayedEventId])

	// Note: viewerReminders is an array from the API, but the schema enforces a unique constraint
	// on [eventId, userId], so there should only ever be one reminder per user per event.
	// Accessing [0] is safe and semantically correct, but we add defensive code for robustness.
	const activeReminderMinutes =
		event?.viewerReminders &&
			Array.isArray(event.viewerReminders) &&
			event.viewerReminders.length > 0
			? (event.viewerReminders[0]?.minutesBeforeStart ?? null)
			: null

	useEffect(() => {
		setSelectedReminder(activeReminderMinutes)
	}, [activeReminderMinutes])

	// Compute derived values before any early returns
	const displayedEvent = useMemo(() => event?.sharedEvent ?? event, [event])
	const eventTimezone = useMemo(
		() => displayedEvent?.timezone || getDefaultTimezone(),
		[displayedEvent]
	)
	const originalOwner = useMemo(() => event?.sharedEvent?.user, [event])
	const attending = useMemo(
		() => (event ? event.attendance.filter((a) => a.status === 'attending').length : 0),
		[event]
	)
	const maybe = useMemo(
		() => (event ? event.attendance.filter((a) => a.status === 'maybe').length : 0),
		[event]
	)
	const eventStartDate = useMemo(
		() => (displayedEvent ? new Date(displayedEvent.startTime) : null),
		[displayedEvent]
	)
	const [currentTime, setCurrentTime] = useState(() => Date.now())

	useEffect(() => {
		const interval = setInterval(() => {
			setCurrentTime(Date.now())
		}, 1000)
		return () => clearInterval(interval)
	}, [])

	const eventHasStarted = useMemo(
		() => (eventStartDate ? eventStartDate.getTime() <= currentTime : false),
		[eventStartDate, currentTime]
	)
	const canManageReminder = useMemo(
		() => Boolean(user && (userAttendance === 'attending' || userAttendance === 'maybe')),
		[user, userAttendance]
	)

	// Derive an organizer user object, falling back to parsed remote data if no local user exists
	const derivedUser = useMemo(() => {
		if (event?.user) { return event.user }

		// Try to construct from organizers
		if (event?.organizers && event.organizers.length > 0) {
			const org = event.organizers[0]
			return {
				id: 'remote',
				username: org.username,
				name: org.display,
				profileImage: null,
				displayColor: null,
				isRemote: true,
			}
		}

		// Fallback to attributedTo
		if (event?.attributedTo) {
			try {
				const u = new URL(event.attributedTo)
				const pathParts = u.pathname.split('/').filter(Boolean)
				const rawUsername = pathParts.find((p) => p.startsWith('@')) || pathParts[pathParts.length - 1] || 'remote'
				const cleanUsername = rawUsername.startsWith('@') ? rawUsername.slice(1) : rawUsername

				return {
					id: 'remote',
					username: cleanUsername,
					name: `@${cleanUsername}@${u.hostname}`,
					profileImage: null,
					displayColor: null,
					isRemote: true,
				}
			} catch (error) {
				console.error('Error parsing attributedTo URL:', error)
			}
		}

		return {
			id: 'unknown',
			username: 'unknown',
			name: 'Unknown Organizer',
			profileImage: null,
			displayColor: null,
			isRemote: true,
		}
	}, [event])

	const handleRSVP = async (status: string) => {
		if (!user) {
			setPendingAction('rsvp')
			setSignupModalOpen(true)
			return
		}
		try {
			if (userAttendance === status) {
				await rsvpMutation.mutateAsync(null)
				setSelectedReminder(null)
			} else {
				await rsvpMutation.mutateAsync({
					status,
					reminderMinutesBeforeStart: selectedReminder,
				})
			}
		} catch (error) {
			log.error('RSVP failed:', error)
		}
	}

	const handleReminderChange = async (nextValue: number | null) => {
		if (!user) {
			setPendingAction(null)
			setSignupModalOpen(true)
			return
		}

		if (!canManageReminder) {
			setSelectedReminder(activeReminderMinutes)
			handleError(
				new Error('RSVP as Going or Maybe to enable reminders.'),
				'Reminder not available',
				{ context: 'EventDetailPage.handleReminderChange' }
			)
			return
		}

		const previousValue = selectedReminder
		setSelectedReminder(nextValue)
		try {
			await reminderMutation.mutateAsync(nextValue)
		} catch (error) {
			// previousValue is always number | null, never undefined
			setSelectedReminder(previousValue)
			handleError(error, 'Failed to update reminder. Please try again.', {
				context: 'EventDetailPage.handleReminderChange',
			})
		}
	}

	const handleLike = async () => {
		if (!user) {
			setPendingAction('like')
			setSignupModalOpen(true)
			return
		}
		try {
			await likeMutation.mutateAsync(userLiked)
		} catch (error) {
			log.error('Like failed:', error)
		}
	}

	const handleShare = async () => {
		if (!user) {
			setPendingAction('share')
			setSignupModalOpen(true)
			return
		}
		try {
			await shareMutation.mutateAsync()
			setHasShared(true)
		} catch (error) {
			handleError(error, 'Failed to share event', { context: 'EventDetailPage.handleShare' })
		}
	}

	const handleAddComment = async (content: string) => {
		try {
			await addCommentMutation.mutateAsync({ content })
		} catch (error) {
			handleError(error, 'Failed to post comment. Please try again.', {
				context: 'EventDetailPage.handleAddComment',
			})
		}
	}

	const handleReply = async (parentId: string, content: string) => {
		try {
			await addCommentMutation.mutateAsync({ content, inReplyToId: parentId })
		} catch (error) {
			handleError(error, 'Failed to post reply. Please try again.', {
				context: 'EventDetailPage.handleReply',
			})
		}
	}

	const handleSignupPrompt = () => {
		setPendingAction('comment')
		setSignupModalOpen(true)
	}

	const handleSignupSuccess = () => {
		// User is now authenticated, pending actions are cleared
		setPendingAction(null)
	}

	const handleDeleteComment = async (commentId: string) => {
		if (!user) {
			return
		}
		setDeleteCommentId(commentId)
	}

	const confirmDeleteComment = async () => {
		if (!deleteCommentId) {
			return
		}
		const commentId = deleteCommentId
		setDeleteCommentId(null)

		try {
			await api.delete(`/events/comments/${commentId}`, undefined, 'Failed to delete comment')

			// Invalidate event detail query
			queryClient.invalidateQueries({
				queryKey: queryKeys.events.detail(username, eventId),
			})
		} catch (error) {
			handleError(error, 'Failed to delete comment. Please try again.', {
				context: 'EventDetailPage.confirmDeleteComment',
			})
		}
	}

	const handleDeleteEvent = () => {
		if (!user) {
			return
		}
		setShowDeleteEventConfirm(true)
	}

	const confirmDeleteEvent = async () => {
		if (!user) {
			return
		}
		setShowDeleteEventConfirm(false)
		try {
			await deleteEventMutation.mutateAsync(user.id)
			// Redirect to feed after successful deletion
			navigate('/feed', { replace: true })
		} catch (error) {
			handleError(error, 'Failed to delete event. Please try again.', {
				context: 'EventDetailPage.confirmDeleteEvent',
			})
		}
	}

	const handleDuplicateEvent = () => {
		if (!event) {
			return
		}
		// Navigate to edit page with duplicate intent - we'll handle this in EditEventPage
		// For now, just navigate to create event modal (would need to open modal with pre-filled data)
		handleError(new Error('Duplicate functionality coming soon!'), 'Feature not available', {
			context: 'EventDetailPage.handleDuplicateEvent',
		})
	}

	const defaultTimezone = useMemo(() => getDefaultTimezone(), [])
	const viewerTimezone = viewerProfile?.timezone || defaultTimezone

	// Set SEO metadata when event data is available
	useEffect(() => {
		if (event) {
			const eventForSEO = event.sharedEvent ?? event
			const eventDate = formatDate(eventForSEO.startTime)

			let description: string
			if (eventForSEO.summary) {
				const summaryText = eventForSEO.summary.slice(0, 150)
				const ellipsis = eventForSEO.summary.length > 150 ? '...' : ''
				description = `${summaryText}${ellipsis}`
			} else {
				const locationText = eventForSEO.location ? ` at ${eventForSEO.location}` : ''
				description = `Event on ${eventDate}${locationText}`
			}

			setSEOMetadata({
				title: eventForSEO.title,
				description,
				ogType: 'event',
				canonicalUrl: window.location.href,
			})
		}
	}, [event])

	if (isLoading) {
		return (
			<div className="min-h-screen bg-background-secondary flex items-center justify-center">
				<Spinner size="lg" />
			</div>
		)
	}

	if (!event) {
		return (
			<div className="min-h-screen bg-background-secondary flex items-center justify-center">
				<Card padding="lg" className="text-center">
					<CardContent>
						<h2 className="text-2xl font-bold mb-4 text-text-primary">
							Event not found
						</h2>
						<Link to="/feed">
							<Button variant="primary">Back to Feed</Button>
						</Link>
					</CardContent>
				</Card>
			</div>
		)
	}



	// Ensure displayedEvent exists before rendering
	if (!displayedEvent) {
		return (
			<div className="min-h-screen bg-background-secondary flex items-center justify-center">
				<Card padding="lg" className="text-center">
					<CardContent>
						<h2 className="text-2xl font-bold mb-4 text-text-primary">
							Event data incomplete
						</h2>
						<Link to="/feed">
							<Button variant="primary">Back to Feed</Button>
						</Link>
					</CardContent>
				</Card>
			</div>
		)
	}

	return (
		<div className="min-h-screen bg-background-secondary">
			{/* Navigation */}
			<nav className="bg-background-primary border-b border-border-default">
				<Container size="lg">
					<div className="flex items-center justify-between h-16">
						<Button variant="ghost" onClick={() => navigate(-1)}>
							← Back
						</Button>
						<Link to="/" className="text-xl font-bold text-primary-600">
							Constellate
						</Link>
						<div className="w-20" />
					</div>

					{event.sharedEvent && originalOwner && (
						<Card
							variant="flat"
							padding="md"
							className="mb-4 bg-primary-50 border-primary-200">
							<CardContent>
								<div className="flex items-center gap-2 font-semibold text-primary-900">
									<span>🔁</span>
									Shared from
									<Link
										to={`/@${originalOwner.username}`}
										className="text-primary-700 hover:underline">
										@{originalOwner.username}
									</Link>
								</div>
								{event.user ? (
									<p className="mt-1 text-xs text-primary-800">
										{event.user.name || event.user.username} reshared this
										event.
									</p>
								) : null}
							</CardContent>
						</Card>
					)}
				</Container>
			</nav>

			{/* Event Content */}
			<Container size="lg" className="py-6">
				<Card variant="elevated" padding="lg" className="mb-6">
					<CardContent>
						{/* Event Header */}
						<EventHeader
							organizer={{
								id: derivedUser.id,
								username: derivedUser.username,
								name: derivedUser.name,
								profileImage: derivedUser.profileImage,
								displayColor: derivedUser.displayColor,
							}}
							eventId={eventId}
							isOwner={user?.id === event.user?.id}
							onDelete={handleDeleteEvent}
							isDeleting={deleteEventMutation.isPending}
							onDuplicate={handleDuplicateEvent}
							isDuplicating={false}
						/>

						<div className="mt-6">
							<EventInfo
								event={{
									id: event.id,
									title: displayedEvent.title,
									summary: displayedEvent.summary,
									startTime: displayedEvent.startTime,
									endTime: displayedEvent.endTime,
									location: displayedEvent.location,
									url: displayedEvent.url,
									visibility: displayedEvent.visibility,
									timezone: displayedEvent.timezone,
									recurrencePattern: event.recurrencePattern,
									recurrenceEndDate: event.recurrenceEndDate,
									tags: event.tags,
								}}
								viewerTimezone={viewerTimezone}
								eventTimezone={eventTimezone}
								isAuthenticated={Boolean(user)}
							/>
						</div>

						{/* Attendance Widget */}
						<div className="mt-6">
							<AttendanceWidget
								userAttendance={userAttendance}
								attendingCount={attending}
								maybeCount={maybe}
								likeCount={event.likes.length}
								userLiked={userLiked}
								userHasShared={hasShared || userHasShared}
								isAuthenticated={Boolean(user)}
								isRSVPPending={rsvpMutation.isPending}
								isLikePending={likeMutation.isPending}
								isSharePending={shareMutation.isPending}
								onRSVP={handleRSVP}
								onLike={handleLike}
								onShare={handleShare}
								onSignUp={() => setSignupModalOpen(true)}
							/>
						</div>

						{/* Reminder Selector */}
						<ReminderSelector
							value={selectedReminder}
							onChange={handleReminderChange}
							isAuthenticated={Boolean(user)}
							canManageReminder={canManageReminder}
							isPending={reminderMutation.isPending}
							eventHasStarted={eventHasStarted}
						/>

						{/* Calendar Export */}
						<CalendarExport
							title={displayedEvent.title}
							description={displayedEvent.summary}
							location={displayedEvent.location}
							startTime={displayedEvent.startTime}
							endTime={displayedEvent.endTime}
							timezone={displayedEvent.timezone}
							url={window.location.href}
						/>

						{/* Attendee List */}
						<AttendeeList attendees={event.attendance} />
					</CardContent>
				</Card>

				{/* Comments Section */}
				<Card variant="elevated" padding="lg">
					<CardContent>
						<CommentList
							comments={event.comments}
							currentUserId={user?.id}
							isAuthenticated={Boolean(user)}
							onAddComment={handleAddComment}
							onReply={handleReply}
							onDelete={handleDeleteComment}
							isAddingComment={addCommentMutation.isPending}
							onSignUpPrompt={handleSignupPrompt}
						/>
					</CardContent>
				</Card>
			</Container>

			{/* Signup Modal */}
			<SignupModal
				isOpen={signupModalOpen}
				onClose={() => {
					setSignupModalOpen(false)
					setPendingAction(null)
				}}
				action={pendingAction && pendingAction !== 'share' ? pendingAction : undefined}
				onSuccess={handleSignupSuccess}
			/>

			{/* Delete Comment Confirmation */}
			<ConfirmationModal
				isOpen={deleteCommentId !== null}
				title="Delete Comment"
				message="Are you sure you want to delete this comment?"
				confirmLabel="Delete"
				cancelLabel="Cancel"
				variant="danger"
				onConfirm={confirmDeleteComment}
				onCancel={() => setDeleteCommentId(null)}
			/>

			{/* Delete Event Confirmation */}
			<ConfirmationModal
				isOpen={showDeleteEventConfirm}
				title="Delete Event"
				message="Are you sure you want to delete this event? This action cannot be undone."
				confirmLabel="Delete"
				cancelLabel="Cancel"
				variant="danger"
				onConfirm={confirmDeleteEvent}
				onCancel={() => setShowDeleteEventConfirm(false)}
				isPending={deleteEventMutation.isPending}
			/>
		</div>
	)
}
