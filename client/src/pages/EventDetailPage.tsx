import { useState, useEffect, useMemo } from 'react'
import { useLocation, Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import {
    useEventDetail,
    useRSVP,
    useLikeEvent,
    useAddComment,
    useDeleteEvent,
    useShareEvent,
    useEventReminder,
} from '../hooks/queries/events'
import { queryKeys } from '../hooks/queries/keys'
import { SignupModal } from '../components/SignupModal'
import { EventHeader } from '../components/EventHeader'
import { EventInfo } from '../components/EventInfo'
import { AttendanceWidget } from '../components/AttendanceWidget'
import { AttendeeList } from '../components/AttendeeList'
import { ReminderSelector } from '../components/ReminderSelector'
import { CalendarExport } from '../components/CalendarExport'
import { CommentList } from '../components/CommentList'
import { Button } from '../components/ui/Button'
import { Card, CardContent } from '../components/ui/Card'
import { Container } from '../components/layout/Container'
import { setSEOMetadata } from '../lib/seo'
import { getDefaultTimezone } from '../lib/timezones'
import { useUIStore } from '../stores'
import { formatDate } from '../lib/formatUtils'

export function EventDetailPage() {
    const location = useLocation()
    const navigate = useNavigate()
    const { user } = useAuth()
    const addErrorToast = useUIStore((state) => state.addErrorToast)
    const [username, setUsername] = useState<string>('')
    const [eventId, setEventId] = useState<string>('')
    const [signupModalOpen, setSignupModalOpen] = useState(false)
    const [pendingAction, setPendingAction] = useState<'rsvp' | 'like' | 'comment' | 'share' | null>(null)
    const [pendingRSVPStatus, setPendingRSVPStatus] = useState<string | null>(null)
    const [selectedReminder, setSelectedReminder] = useState<number | null>(null)
    const [hasShared, setHasShared] = useState(false)

    // Extract username and eventId from pathname
    useEffect(() => {
        // Path format: /@username/eventId or /@username@domain/eventId
        const pathParts = location.pathname.split('/').filter(Boolean)
        if (pathParts.length >= 2 && pathParts[0].startsWith('@')) {
            const extractedUsername = pathParts[0].slice(1) // Remove @
            const extractedEventId = pathParts[1]
            setUsername(extractedUsername)
            setEventId(extractedEventId)
        }
    }, [location.pathname])

    // Fetch event
    const { data: event, isLoading } = useEventDetail(username, eventId)
    const { data: viewerProfile } = useQuery({
        queryKey: queryKeys.users.currentProfile(user?.id),
        queryFn: async () => {
            if (!user?.id) return null
            const response = await fetch('/api/users/me/profile', {
                credentials: 'include',
            })
            if (!response.ok) {
                return null
            }
            return response.json()
        },
        enabled: !!user?.id,
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
        if (!event || !user) return null
        return event.attendance?.find((a) => a.user.id === user.id)?.status || null
    }, [event, user])

    const userLiked = useMemo(() => {
        if (!event || !user) return false
        return !!event.likes?.find((l) => l.user.id === user.id)
    }, [event, user])
    
    // Check if user has already shared this event
    // This checks if the current event is a share by this user, or if the user has shared the original event
    const displayedEventId = useMemo(() => {
        return event?.sharedEvent?.id ?? event?.id
    }, [event])

    const userHasShared = useMemo(() => {
        if (!event || !user || !displayedEventId) return false
        return (event.userId === user.id && !!event.sharedEvent) || (event.userHasShared === true)
    }, [event, user, displayedEventId])

    // Note: viewerReminders is an array from the API, but the schema enforces a unique constraint
    // on [eventId, userId], so there should only ever be one reminder per user per event.
    // Accessing [0] is safe and semantically correct, but we add defensive code for robustness.
    const activeReminderMinutes = (event?.viewerReminders && Array.isArray(event.viewerReminders) && event.viewerReminders.length > 0)
        ? event.viewerReminders[0]?.minutesBeforeStart ?? null
        : null

    useEffect(() => {
        setSelectedReminder(activeReminderMinutes)
    }, [activeReminderMinutes])

    const handleRSVP = async (status: string) => {
        if (!user) {
            setPendingAction('rsvp')
            setPendingRSVPStatus(status)
            setSignupModalOpen(true)
            return
        }
        try {
            if (userAttendance === status) {
                await rsvpMutation.mutateAsync(null)
                setSelectedReminder(null)
            } else {
                await rsvpMutation.mutateAsync({ status, reminderMinutesBeforeStart: selectedReminder })
            }
        } catch (error) {
            console.error('RSVP failed:', error)
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
            addErrorToast({ id: crypto.randomUUID(), message: 'RSVP as Going or Maybe to enable reminders.' })
            return
        }

        const previousValue = selectedReminder
        setSelectedReminder(nextValue)
        try {
            await reminderMutation.mutateAsync(nextValue)
        } catch (error) {
            console.error('Failed to update reminder:', error)
            setSelectedReminder(previousValue !== undefined ? previousValue : null)
            addErrorToast({ id: crypto.randomUUID(), message: 'Failed to update reminder. Please try again.' })
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
            console.error('Like failed:', error)
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
            console.error('Share failed:', error)
            let errorMessage = 'Failed to share event'
            if (error instanceof Error) {
                errorMessage = error.message
            }
            addErrorToast({ id: crypto.randomUUID(), message: errorMessage })
        }
    }

    const handleAddComment = async (content: string) => {
        try {
            await addCommentMutation.mutateAsync({ content })
        } catch (error) {
            console.error('Comment failed:', error)
            addErrorToast({ id: crypto.randomUUID(), message: 'Failed to post comment. Please try again.' })
        }
    }

    const handleReply = async (parentId: string, content: string) => {
        try {
            await addCommentMutation.mutateAsync({ content, inReplyToId: parentId })
        } catch (error) {
            console.error('Reply failed:', error)
            addErrorToast({ id: crypto.randomUUID(), message: 'Failed to post reply. Please try again.' })
        }
    }

    const handleSignupPrompt = () => {
        setPendingAction('comment')
        setSignupModalOpen(true)
    }

    const handleSignupSuccess = () => {
        // User is now authenticated, pending actions are cleared
        setPendingAction(null)
        setPendingRSVPStatus(null)
    }


    const handleDeleteComment = async (commentId: string) => {
        if (!user) return
        if (!confirm('Are you sure you want to delete this comment?')) return

        try {
            const response = await fetch(`/api/events/comments/${commentId}`, {
                method: 'DELETE',
                credentials: 'include',
            })

            if (!response.ok) {
                throw new Error('Failed to delete comment')
            }

            // Invalidate event detail query
            queryClient.invalidateQueries({
                queryKey: queryKeys.events.detail(username, eventId),
            })
        } catch (error) {
            console.error('Delete comment failed:', error)
            addErrorToast({ id: crypto.randomUUID(), message: 'Failed to delete comment. Please try again.' })
        }
    }

    const handleDeleteEvent = async () => {
        if (!user) return
        if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) return

        try {
            await deleteEventMutation.mutateAsync(user.id)
            // Redirect to feed after successful deletion
            navigate('/feed', { replace: true })
        } catch (error) {
            console.error('Delete event failed:', error)
            addErrorToast({ id: crypto.randomUUID(), message: 'Failed to delete event. Please try again.' })
        }
    }

    const handleDuplicateEvent = () => {
        if (!event) return
        // Navigate to edit page with duplicate intent - we'll handle this in EditEventPage
        // For now, just navigate to create event modal (would need to open modal with pre-filled data)
        addErrorToast({ id: crypto.randomUUID(), message: 'Duplicate functionality coming soon!' })
    }

    const defaultTimezone = useMemo(() => getDefaultTimezone(), [])
    const viewerTimezone = viewerProfile?.timezone || defaultTimezone

    // Set SEO metadata when event data is available
    useEffect(() => {
        if (event) {
            const displayedEvent = event.sharedEvent ?? event
            const eventDate = formatDate(displayedEvent.startTime)
            
            let description: string
            if (displayedEvent.summary) {
                const summaryText = displayedEvent.summary.slice(0, 150)
                const ellipsis = displayedEvent.summary.length > 150 ? '...' : ''
                description = `${summaryText}${ellipsis}`
            } else {
                const locationText = displayedEvent.location ? ` at ${displayedEvent.location}` : ''
                description = `Event on ${eventDate}${locationText}`
            }
            
            setSEOMetadata({
                title: displayedEvent.title,
                description,
                ogType: 'event',
                canonicalUrl: window.location.href,
            })
        }
    }, [event])

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background-secondary flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent" />
            </div>
        )
    }

    if (!event) {
        return (
            <div className="min-h-screen bg-background-secondary flex items-center justify-center">
                <Card padding="lg" className="text-center">
                    <CardContent>
                        <h2 className="text-2xl font-bold mb-4 text-text-primary">Event not found</h2>
                        <Link to="/feed">
                            <Button variant="primary">Back to Feed</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const displayedEvent = useMemo(() => event.sharedEvent ?? event, [event])
    const eventTimezone = useMemo(() => displayedEvent.timezone || getDefaultTimezone(), [displayedEvent])
    const originalOwner = useMemo(() => event.sharedEvent?.user, [event])
    const attending = useMemo(() => event.attendance?.filter((a) => a.status === 'attending').length || 0, [event])
    const maybe = useMemo(() => event.attendance?.filter((a) => a.status === 'maybe').length || 0, [event])
    const eventStartDate = useMemo(() => new Date(displayedEvent.startTime), [displayedEvent])
    const eventHasStarted = useMemo(() => eventStartDate.getTime() <= Date.now(), [eventStartDate])
    const canManageReminder = useMemo(() => Boolean(user && (userAttendance === 'attending' || userAttendance === 'maybe')), [user, userAttendance])

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
                        <Card variant="flat" padding="md" className="mb-4 bg-primary-50 border-primary-200">
                            <CardContent>
                                <div className="flex items-center gap-2 font-semibold text-primary-900">
                                    <span>🔁</span>
                                    Shared from
                                    <Link
                                        to={`/@${originalOwner.username}`}
                                        className="text-primary-700 hover:underline"
                                    >
                                        @{originalOwner.username}
                                    </Link>
                                </div>
                                {event.user && (
                                    <p className="mt-1 text-xs text-primary-800">
                                        {event.user.name || event.user.username} reshared this event.
                                    </p>
                                )}
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
                                id: event.user!.id,
                                username: event.user!.username,
                                name: event.user!.name,
                                profileImage: event.user!.profileImage,
                                displayColor: event.user!.displayColor,
                            }}
                            eventId={eventId}
                            isOwner={user?.id === event.user!.id}
                            onDelete={handleDeleteEvent}
                            isDeleting={deleteEventMutation.isPending}
                            onDuplicate={handleDuplicateEvent}
                            isDuplicating={false}
                        />

                        <div className="mt-6">
                            <EventInfo
                                event={{
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
                            />
                        </div>

                        {/* Attendance Widget */}
                        <div className="mt-6">
                            <AttendanceWidget
                                userAttendance={userAttendance}
                                attendingCount={attending}
                                maybeCount={maybe}
                                likeCount={event.likes?.length || 0}
                                userLiked={userLiked}
                                userHasShared={hasShared || userHasShared}
                                isAuthenticated={!!user}
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
                            isAuthenticated={!!user}
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
                        <AttendeeList attendees={event.attendance || []} />
                    </CardContent>
                </Card>

                {/* Comments Section */}
                <Card variant="elevated" padding="lg">
                    <CardContent>
                        <CommentList
                            comments={event.comments || []}
                            currentUserId={user?.id}
                            isAuthenticated={!!user}
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
                    setPendingRSVPStatus(null)
                }}
                action={pendingAction && pendingAction !== 'share' ? pendingAction : undefined}
                onSuccess={handleSignupSuccess}
            />
        </div>
    )
}
