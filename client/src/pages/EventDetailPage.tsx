import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
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
import { SignUpPrompt } from '../components/SignUpPrompt'
import { Button } from '../components/ui/Button'
import { Card, CardContent } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Avatar } from '../components/ui/Avatar'
import { Container } from '../components/layout/Container'
import { setSEOMetadata } from '../lib/seo'
import type { CommentMention } from '../types'
import { getDefaultTimezone } from '../lib/timezones'
import { useUIStore } from '../stores'
import { formatDate } from '../lib/formatUtils'

interface MentionSuggestion {
    id: string
    username: string
    name?: string | null
    profileImage?: string | null
    displayColor?: string | null
}

const mentionTriggerRegex = /(^|[\s({[]])@([\w.-]+(?:@[\w.-]+)?)$/i
const mentionSplitRegex = /(@[\w.-]+(?:@[\w.-]+)?)/g

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
    const [comment, setComment] = useState('')
    const [username, setUsername] = useState<string>('')
    const [eventId, setEventId] = useState<string>('')
    const [signupModalOpen, setSignupModalOpen] = useState(false)
    const [pendingAction, setPendingAction] = useState<'rsvp' | 'like' | 'comment' | 'share' | null>(null)
    const [pendingRSVPStatus, setPendingRSVPStatus] = useState<string | null>(null)
    const [selectedReminder, setSelectedReminder] = useState<number | null>(null)
    const textareaRef = useRef<HTMLTextAreaElement | null>(null)
    const [mentionQuery, setMentionQuery] = useState('')
    const [mentionSuggestions, setMentionSuggestions] = useState<MentionSuggestion[]>([])
    const [activeMentionIndex, setActiveMentionIndex] = useState(0)
    const [mentionRange, setMentionRange] = useState<{ start: number; end: number } | null>(null)
    const [showMentionSuggestions, setShowMentionSuggestions] = useState(false)
    const [hasShared, setHasShared] = useState(false)

    const resetMentionState = useCallback(() => {
        setMentionRange(null)
        setMentionQuery('')
        setMentionSuggestions([])
        setShowMentionSuggestions(false)
        setActiveMentionIndex(0)
    }, [])

    const updateMentionState = useCallback(
        (value: string, caretPosition: number) => {
            if (caretPosition < 0) {
                resetMentionState()
                return
            }

            const textBeforeCaret = value.slice(0, caretPosition)
            const match = textBeforeCaret.match(mentionTriggerRegex)

            if (match && match[2]) {
                const atIndex = textBeforeCaret.lastIndexOf('@')
                if (atIndex >= 0) {
                    setMentionRange({ start: atIndex, end: caretPosition })
                    setMentionQuery(match[2])
                    setShowMentionSuggestions(true)
                    return
                }
            }

            resetMentionState()
        },
        [resetMentionState]
    )

    const renderCommentContent = useCallback(
        (commentId: string, text: string, mentions?: CommentMention[]) => {
            if (!mentions || mentions.length === 0) {
                return text
            }

            const mentionMap = new Map<string, CommentMention>()
            mentions.forEach((mention) => {
                const normalizedHandle = mention.handle?.startsWith('@')
                    ? mention.handle.slice(1).toLowerCase()
                    : mention.handle.toLowerCase()
                mentionMap.set(normalizedHandle, mention)
                mentionMap.set(mention.user.username.toLowerCase(), mention)
            })

            return text.split(mentionSplitRegex).map((part, index) => {
                if (!part) {
                    return null
                }

                if (part.startsWith('@')) {
                    const normalized = part.slice(1).toLowerCase()
                    const mention = mentionMap.get(normalized)

                    if (mention) {
                        return (
                            <Link
                                key={`${commentId}-mention-${index}`}
                                to={`/@${mention.user.username}`}
                                className="text-blue-600 font-medium hover:underline"
                            >
                                {part}
                            </Link>
                        )
                    }
                }

                return (
                    <span key={`${commentId}-text-${index}`}>
                        {part}
                    </span>
                )
            })
        },
        []
    )

    const applyMentionSuggestion = useCallback(
        (suggestion: MentionSuggestion) => {
            if (!mentionRange || !textareaRef.current) {
                return
            }

            const currentValue = textareaRef.current.value
            const before = currentValue.slice(0, mentionRange.start)
            const after = currentValue.slice(mentionRange.end)
            const insertion = `@${suggestion.username}`
            const needsSpace = after.startsWith(' ') || after.length === 0 ? '' : ' '
            const nextValue = `${before}${insertion}${needsSpace}${after}`

            setComment(nextValue)
            const newCaret = before.length + insertion.length + needsSpace.length

            requestAnimationFrame(() => {
                if (textareaRef.current) {
                    textareaRef.current.selectionStart = newCaret
                    textareaRef.current.selectionEnd = newCaret
                }
            })

            resetMentionState()
        },
        [mentionRange, resetMentionState]
    )

    const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value
        setComment(value)
        const caret = e.target.selectionStart ?? value.length
        updateMentionState(value, caret)
    }

    const handleCommentKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (!showMentionSuggestions || mentionSuggestions.length === 0) {
            return
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActiveMentionIndex((prev) => (prev + 1) % mentionSuggestions.length)
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActiveMentionIndex((prev) =>
                prev === 0 ? mentionSuggestions.length - 1 : prev - 1
            )
        } else if (e.key === 'Enter') {
            e.preventDefault()
            if (activeMentionIndex >= 0 && activeMentionIndex < mentionSuggestions.length) {
                applyMentionSuggestion(mentionSuggestions[activeMentionIndex])
            }
        } else if (e.key === 'Escape') {
            e.preventDefault()
            resetMentionState()
        }
    }

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

    useEffect(() => {
        if (!mentionQuery || mentionQuery.length === 0) {
            setMentionSuggestions([])
            setShowMentionSuggestions(false)
            return
        }

        const controller = new AbortController()
        const timeout = setTimeout(async () => {
            try {
                const response = await fetch(
                    `/api/user-search?q=${encodeURIComponent(mentionQuery)}&limit=5`,
                    {
                        credentials: 'include',
                        signal: controller.signal,
                    }
                )

                if (!response.ok) {
                    return
                }

                const body = await response.json() as { users?: MentionSuggestion[] }
                const suggestions = Array.isArray(body.users) ? body.users.slice(0, 5) : []
                setMentionSuggestions(suggestions)
                setActiveMentionIndex(0)
                setShowMentionSuggestions(suggestions.length > 0)
            } catch (error) {
                if (!controller.signal.aborted) {
                    console.error('Failed to load mention suggestions:', error)
                }
            }
        }, 200)

        return () => {
            controller.abort()
            clearTimeout(timeout)
        }
    }, [mentionQuery])

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

    const handleCommentSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!comment.trim()) return

        if (!user) {
            setPendingAction('comment')
            setSignupModalOpen(true)
            return
        }

        try {
            await addCommentMutation.mutateAsync({ content: comment })
            setComment('')
            resetMentionState()
            textareaRef.current?.focus()
        } catch (error) {
            console.error('Comment failed:', error)
        }
    }

    const handleSignupSuccess = () => {
        // The pending action will be executed automatically by the useEffect
        // that watches for user and pendingAction changes
        // This callback is called after successful signup/login
    }

    const executePendingAction = useCallback(async () => {
        if (!pendingAction) return

        try {
            if (pendingAction === 'rsvp' && pendingRSVPStatus) {
                await rsvpMutation.mutateAsync({ status: pendingRSVPStatus })
            } else if (pendingAction === 'like') {
                await likeMutation.mutateAsync(false) // false = like (not unlike)
            } else if (pendingAction === 'comment' && comment.trim()) {
                await addCommentMutation.mutateAsync({ content: comment })
                setComment('')
            } else if (pendingAction === 'share') {
                await shareMutation.mutateAsync()
                setHasShared(true)
            }
        } catch (error) {
            console.error('Failed to perform action after signup:', error)
        } finally {
            setPendingAction(null)
            setPendingRSVPStatus(null)
        }
    }, [pendingAction, pendingRSVPStatus, comment, rsvpMutation, likeMutation, addCommentMutation, shareMutation])

    useEffect(() => {
        if (user && pendingAction) {
            // Small delay to ensure mutations are ready
            const timer = setTimeout(executePendingAction, 100)
            return () => clearTimeout(timer)
        }
    }, [user, pendingAction, executePendingAction])


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
                                {shareMutation.isPending ? 'Sharing...' : (hasShared || userHasShared) ? '✅ Shared' : '🔁 Share'}
                            </Button>
                        </div>
                        {!user && (
                            <div className="mb-6 pb-4 border-b border-border-default">
                                <SignUpPrompt variant="inline" />
                            </div>
                        )}
                        {!eventHasStarted && (
                            <div className="mb-6 pb-4 border-b border-border-default">
                                <label className="block text-sm font-semibold text-text-primary mb-2">
                                    Reminder
                                </label>
                                <div className="flex items-center gap-3">
                                    <select
                                        className="flex-1 px-3 py-2 border border-border-default rounded-lg bg-background-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                        value={selectedReminder !== null ? String(selectedReminder) : ''}
                                        onChange={handleReminderChange}
                                        disabled={!user || !canManageReminder || reminderMutation.isPending}
                                        aria-label="Reminder notification timing"
                                    >
                                        {REMINDER_OPTIONS.map((option) => (
                                            <option
                                                key={option.label}
                                                value={option.value !== null ? option.value : ''}
                                            >
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                    {reminderMutation.isPending && (
                                        <span className="text-sm text-text-secondary">Saving...</span>
                                    )}
                                </div>
                                <p className="text-xs text-text-secondary mt-2">
                                    {getReminderHelperText()}
                                </p>
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
                        <h2 className="text-xl font-bold mb-4 text-text-primary">
                            Comments ({event.comments?.length || 0})
                        </h2>

                        {/* Comment Form */}
                        {!user ? (
                            <div className="mb-6">
                                <SignUpPrompt
                                    action="comment"
                                    variant="card"
                                    onSignUp={() => {
                                        setPendingAction('comment')
                                        setSignupModalOpen(true)
                                    }}
                                />
                            </div>
                        ) : (
                            <form onSubmit={handleCommentSubmit} className="mb-6">
                                <div className="relative mb-3">
                                    <textarea
                                        ref={textareaRef}
                                        value={comment}
                                        onChange={handleCommentChange}
                                        onKeyDown={handleCommentKeyDown}
                                        onSelect={() => {
                                            if (textareaRef.current) {
                                                updateMentionState(
                                                    textareaRef.current.value,
                                                    textareaRef.current.selectionStart ?? textareaRef.current.value.length
                                                )
                                            }
                                        }}
                                        onClick={() => {
                                            if (textareaRef.current) {
                                                updateMentionState(
                                                    textareaRef.current.value,
                                                    textareaRef.current.selectionStart ?? textareaRef.current.value.length
                                                )
                                            }
                                        }}
                                        placeholder="Add a comment..."
                                        className="w-full px-3 py-2 border border-border-default rounded-lg bg-background-primary text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2 resize-y min-h-[80px]"
                                        rows={3}
                                    />
                                    {showMentionSuggestions && mentionSuggestions.length > 0 && (
                                        <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-border-default bg-background-primary shadow-lg">
                                            {mentionSuggestions.map((suggestion, index) => {
                                                const isActive = index === activeMentionIndex
                                                return (
                                                    <button
                                                        type="button"
                                                        key={suggestion.id}
                                                        className={`flex w-full items-center gap-3 p-2 text-left transition-colors ${isActive ? 'bg-primary-50' : 'bg-background-primary'}`}
                                                        onMouseDown={(e) => {
                                                            e.preventDefault()
                                                            applyMentionSuggestion(suggestion)
                                                        }}
                                                    >
                                                        <Avatar
                                                            src={suggestion.profileImage || undefined}
                                                            alt={suggestion.name || suggestion.username}
                                                            fallback={suggestion.name?.[0] || suggestion.username[0]}
                                                            size="sm"
                                                        />
                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-sm text-text-primary">{suggestion.name || suggestion.username}</span>
                                                            <span className="text-xs text-text-secondary">@{suggestion.username}</span>
                                                        </div>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    disabled={addCommentMutation.isPending || !comment.trim()}
                                    loading={addCommentMutation.isPending}
                                >
                                    {addCommentMutation.isPending ? 'Posting...' : 'Post Comment'}
                                </Button>
                            </form>
                        )}

                        {/* Comments List */}
                        <div className="space-y-4">
                            {event.comments?.map((c) => (
                                <div key={c.id} className="flex gap-3">
                                    <Avatar
                                        src={c.author.profileImage || undefined}
                                        alt={c.author.name || c.author.username}
                                        fallback={c.author.name?.[0] || c.author.username[0]}
                                        size="sm"
                                        className="flex-shrink-0"
                                    />
                                    <div className="flex-1">
                                        <div className="bg-background-secondary rounded-lg p-3">
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="font-semibold text-sm text-text-primary">
                                                    {c.author.name || c.author.username}
                                                </div>
                                                {user && c.author.id === user.id && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDeleteComment(c.id)}
                                                        className="text-error-500 hover:text-error-700 text-xs"
                                                    >
                                                        🗑️
                                                    </Button>
                                                )}
                                            </div>
                                            <p className="text-text-primary break-words">
                                                {renderCommentContent(c.id, c.content, c.mentions)}
                                            </p>
                                        </div>
                                        <div className="text-xs text-text-secondary mt-1">
                                            {new Date(c.createdAt).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
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
