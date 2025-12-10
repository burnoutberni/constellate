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
import { CommentList } from '../components/CommentList'
import { Button } from '../components/ui/Button'
import { Card, CardContent } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Select } from '../components/ui/Select'
import { Container } from '../components/layout/Container'
import { setSEOMetadata } from '../lib/seo'
import { getDefaultTimezone } from '../lib/timezones'
import { useUIStore } from '../stores'
import { formatDate } from '../lib/formatUtils'

const REMINDER_OPTIONS: Array<{ label: string; value: number | null }> = [
    { label: 'No reminder', value: null },
    { label: '5 minutes before', value: 5 },
    { label: '15 minutes before', value: 15 },
    { label: '30 minutes before', value: 30 },
    { label: '1 hour before', value: 60 },
    { label: '2 hours before', value: 120 },
    { label: '1 day before', value: 1440 },
]

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

    const handleReminderChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const nextValue = e.target.value === '' ? null : Number(e.target.value)

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

    const shouldShowRsvpSpinner = (status: 'attending' | 'maybe') => {
        if (!rsvpMutation.isPending) {
            return false
        }
        if (status === 'attending') {
            return userAttendance === 'attending' || !userAttendance
        }
        return userAttendance === 'maybe'
    }

    const getReminderHelperText = () => {
        if (!user) {
            return 'Sign up to save reminder notifications.'
        }
        if (canManageReminder) {
            return 'We will send reminder notifications and email (if configured).'
        }
        return 'RSVP as Going or Maybe to enable reminders.'
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
                            isOwner={user?.id === event.user!.id}
                            onDelete={handleDeleteEvent}
                            isDeleting={deleteEventMutation.isPending}
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

                        {/* RSVP Buttons */}
                        <div className="flex flex-wrap gap-3 mb-6 pb-6 border-b border-border-default mt-6">
                            <Button
                                variant={userAttendance === 'attending' ? 'primary' : 'secondary'}
                                size="md"
                                onClick={() => handleRSVP('attending')}
                                disabled={rsvpMutation.isPending}
                                loading={shouldShowRsvpSpinner('attending')}
                                className="flex-1 min-w-[120px]"
                            >
                                {shouldShowRsvpSpinner('attending') ? 'Updating...' : `👍 Going (${attending})`}
                            </Button>
                            <Button
                                variant={userAttendance === 'maybe' ? 'primary' : 'secondary'}
                                size="md"
                                onClick={() => handleRSVP('maybe')}
                                disabled={rsvpMutation.isPending}
                                loading={shouldShowRsvpSpinner('maybe')}
                                className="flex-1 min-w-[120px]"
                            >
                                {shouldShowRsvpSpinner('maybe') ? 'Updating...' : `🤔 Maybe (${maybe})`}
                            </Button>
                            <Button
                                variant={userLiked ? 'primary' : 'secondary'}
                                size="md"
                                onClick={handleLike}
                                disabled={likeMutation.isPending}
                                loading={likeMutation.isPending}
                                className="flex-1 min-w-[100px]"
                            >
                                ❤️ {event.likes?.length || 0}
                            </Button>
                            <Button
                                variant={(hasShared || userHasShared) ? 'primary' : 'secondary'}
                                size="md"
                                onClick={handleShare}
                                disabled={shareMutation.isPending || hasShared || userHasShared}
                                loading={shareMutation.isPending}
                                className="flex-1 min-w-[100px]"
                            >
                                {(() => {
                                    if (shareMutation.isPending) {
                                        return 'Sharing...'
                                    }
                                    if (hasShared || userHasShared) {
                                        return '✅ Shared'
                                    }
                                    return '🔁 Share'
                                })()}
                            </Button>
                        </div>
                        {!user && (
                            <div className="mb-6 pb-4 border-b border-border-default">
                                <SignUpPrompt variant="inline" />
                            </div>
                        )}
                        {!eventHasStarted && (
                            <div className="mb-6 pb-4 border-b border-border-default">
                                <div className="flex items-center gap-3">
                                    <Select
                                        label="Reminder"
                                        value={selectedReminder !== null ? String(selectedReminder) : ''}
                                        onChange={handleReminderChange}
                                        disabled={!user || !canManageReminder || reminderMutation.isPending}
                                        aria-label="Reminder notification timing"
                                        helperText={getReminderHelperText()}
                                        className="flex-1"
                                    >
                                        {REMINDER_OPTIONS.map((option) => (
                                            <option
                                                key={option.label}
                                                value={option.value !== null ? option.value : ''}
                                            >
                                                {option.label}
                                            </option>
                                        ))}
                                    </Select>
                                    {reminderMutation.isPending && (
                                        <span className="text-sm text-text-secondary">Saving...</span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Attendees */}
                        {event.attendance && event.attendance.length > 0 && (
                            <div className="mb-6">
                                <h3 className="font-bold mb-3 text-text-primary">Attendees</h3>
                                <div className="flex flex-wrap gap-2">
                                    {event.attendance.slice(0, 10).map((a, i) => (
                                        <Badge key={i} variant="primary" size="md">
                                            {a.user.name || a.user.username}
                                            {a.status === 'maybe' && ' (Maybe)'}
                                        </Badge>
                                    ))}
                                    {event.attendance.length > 10 && (
                                        <Badge variant="secondary" size="md">
                                            +{event.attendance.length - 10} more
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        )}
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
