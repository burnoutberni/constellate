import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import {
    useEventDetail,
    useRSVP,
    useLikeEvent,
    useAddComment,
    useDeleteEvent,
    useShareEvent,
} from '../hooks/queries/events'
import { queryKeys } from '../hooks/queries/keys'
import { SignupModal } from '../components/SignupModal'
import { getVisibilityMeta } from '../lib/visibility'
import type { EventVisibility } from '../types'
import { getRecurrenceLabel } from '../lib/recurrence'
import type { CommentMention } from '../types'

interface MentionSuggestion {
    id: string
    username: string
    name?: string | null
    profileImage?: string | null
    displayColor?: string | null
}

const mentionTriggerRegex = /(^|[\s({[]])@([\w.-]+(?:@[\w.-]+)?)$/i
const mentionSplitRegex = /(@[\w.-]+(?:@[\w.-]+)?)/g

export function EventDetailPage() {
    const location = useLocation()
    const navigate = useNavigate()
    const { user } = useAuth()
    const [comment, setComment] = useState('')
    const [username, setUsername] = useState<string>('')
    const [eventId, setEventId] = useState<string>('')
    const [signupModalOpen, setSignupModalOpen] = useState(false)
    const [pendingAction, setPendingAction] = useState<'rsvp' | 'like' | 'comment' | 'share' | null>(null)
    const [pendingRSVPStatus, setPendingRSVPStatus] = useState<string | null>(null)
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

    // Mutations
    const queryClient = useQueryClient()
    const rsvpMutation = useRSVP(eventId, user?.id)
    const likeMutation = useLikeEvent(eventId, user?.id)
    const shareMutation = useShareEvent(eventId)
    const addCommentMutation = useAddComment(eventId)
    const deleteEventMutation = useDeleteEvent(eventId)

    // Derive user's attendance and like status from event data
    const userAttendance =
        event && user
            ? event.attendance?.find((a) => a.user.id === user.id)?.status || null
            : null
    const userLiked =
        event && user
            ? !!event.likes?.find((l) => l.user.id === user.id)
            : false
    
    // Check if user has already shared this event
    // Check if the current event is a share by this user, or if there's a share of the original event
    const userHasShared = event && user
        ? (event.userId === user.id && !!event.sharedEvent)
        : false

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
            } else {
                await rsvpMutation.mutateAsync({ status })
            }
        } catch (error) {
            console.error('RSVP failed:', error)
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
            alert(errorMessage)
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

    useEffect(() => {
        if (user && pendingAction) {
            const executeAction = async () => {
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
            }

            // Small delay to ensure mutations are ready
            const timer = setTimeout(executeAction, 100)
            return () => clearTimeout(timer)
        }
    }, [user, pendingAction, pendingRSVPStatus, comment, rsvpMutation, likeMutation, addCommentMutation, shareMutation])

    useEffect(() => {
        // Check if user has already shared this event when event data loads
        if (event && user) {
            // If the current event is a share by this user, mark as shared
            setHasShared(event.userId === user.id && !!event.sharedEvent)
        } else {
            setHasShared(false)
        }
    }, [eventId, event, user])

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
            alert('Failed to delete comment')
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
            alert('Failed to delete event')
        }
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        })
    }

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
        })
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent" />
            </div>
        )
    }

    if (!event) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="card p-8 text-center">
                    <h2 className="text-2xl font-bold mb-4">Event not found</h2>
                    <Link to="/feed" className="btn btn-primary">
                        Back to Feed
                    </Link>
                </div>
            </div>
        )
    }

    const displayedEvent = event.sharedEvent ?? event
    const originalOwner = event.sharedEvent?.user
    const attending = event.attendance?.filter((a) => a.status === 'attending').length || 0
    const maybe = event.attendance?.filter((a) => a.status === 'maybe').length || 0
    const visibilityMeta = getVisibilityMeta(displayedEvent.visibility as EventVisibility | undefined)

    const buildRsvpButtonClass = (status: 'attending' | 'maybe') => {
        const baseClass = 'btn flex-1 flex items-center justify-center gap-2'
        const selectedClass = 'btn-primary ring-2 ring-blue-600 ring-offset-2'
        const authedClass = 'btn-secondary'
        const guestClass = 'btn-secondary hover:bg-blue-50 border-blue-300'

        if (userAttendance === status) {
            return `${baseClass} ${selectedClass}`
        }
        if (user) {
            return `${baseClass} ${authedClass}`
        }
        return `${baseClass} ${guestClass}`
    }

    const buildLikeButtonClass = () => {
        const baseClass = 'btn flex-1'
        if (userLiked) {
            return `${baseClass} btn-primary ring-2 ring-red-600 ring-offset-2`
        }
        if (user) {
            return `${baseClass} btn-secondary`
        }
        return `${baseClass} btn-secondary hover:bg-blue-50 border-blue-300`
    }

    const buildShareButtonClass = () => {
        const baseClass = 'btn flex-1'
        if (hasShared || userHasShared) {
            return `${baseClass} btn-primary ring-2 ring-indigo-600 ring-offset-2`
        }
        if (user) {
            return `${baseClass} btn-secondary`
        }
        return `${baseClass} btn-secondary hover:bg-blue-50 border-blue-300`
    }

    const guestTooltip = (message: string) => (!user ? message : undefined)
    const shouldShowRsvpSpinner = (status: 'attending' | 'maybe') => {
        if (!rsvpMutation.isPending) {
            return false
        }
        if (status === 'attending') {
            return userAttendance === 'attending' || !userAttendance
        }
        return userAttendance === 'maybe'
    }

    const renderSpinner = (label: string) => (
        <>
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>{label}</span>
        </>
    )

    const renderRsvpButtonContent = (status: 'attending' | 'maybe') => {
        if (shouldShowRsvpSpinner(status)) {
            return renderSpinner('Updating...')
        }

        if (status === 'attending') {
            return <>👍 Going ({attending})</>
        }

        return <>🤔 Maybe ({maybe})</>
    }

    const renderShareButtonContent = () => {
        if (shareMutation.isPending) {
            return renderSpinner('Sharing...')
        }

        if (hasShared || userHasShared) {
            return '✅ Shared'
        }

        return '🔁 Share'
    }

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Navigation */}
            <nav className="bg-white border-b border-gray-200">
                <div className="max-w-4xl mx-auto px-4">
                    <div className="flex items-center justify-between h-16">
                        <button onClick={() => navigate(-1)} className="btn btn-ghost">
                            ← Back
                        </button>
                        <Link to="/" className="text-xl font-bold text-blue-600">
                            Constellate
                        </Link>
                        <div className="w-20" />
                    </div>

                    {event.sharedEvent && originalOwner && (
                        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                            <div className="flex items-center gap-2 font-semibold">
                                <span>🔁</span>
                                Shared from
                                <Link
                                    to={`/@${originalOwner.username}`}
                                    className="text-blue-700 hover:underline"
                                >
                                    @{originalOwner.username}
                                </Link>
                            </div>
                            {event.user && (
                                <p className="mt-1 text-xs text-blue-800">
                                    {event.user.name || event.user.username} reshared this event.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </nav>

            {/* Event Content */}
            <div className="max-w-4xl mx-auto px-4 py-6">
                <div className="card p-8 mb-6">
                    {/* Event Header */}
                    <div className="flex items-start justify-between mb-6">
                        <Link
                            to={`/@${event.user!.username}`}
                            className="flex items-start gap-4 hover:opacity-80 transition-opacity"
                        >
                            {event.user!.profileImage ? (
                                <img
                                    src={event.user!.profileImage}
                                    alt={event.user!.name || event.user!.username}
                                    className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                                />
                            ) : (
                                <div
                                    className="avatar w-16 h-16"
                                    style={{ backgroundColor: event.user!.displayColor || '#3b82f6' }}
                                >
                                    {event.user!.name?.[0] || event.user!.username[0].toUpperCase()}
                                </div>
                            )}
                            <div>
                                <div className="font-semibold text-lg">
                                    {event.user!.name || event.user!.username}
                                </div>
                                <div className="text-gray-500">@{event.user!.username}</div>
                            </div>
                        </Link>
                        {user && event.user!.id === user.id && (
                            <button
                                onClick={(e) => {
                                    e.preventDefault()
                                    handleDeleteEvent()
                                }}
                                className="btn btn-secondary text-red-600 hover:text-red-700"
                                title="Delete event"
                            >
                                🗑️ Delete
                            </button>
                        )}
                    </div>

                    {/* Event Title */}
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                        <h1 className="text-3xl font-bold">{displayedEvent.title}</h1>
                        <span className={`badge ${visibilityMeta.badgeClass}`}>
                            {visibilityMeta.icon} {visibilityMeta.label}
                        </span>
                    </div>
                    <p className="text-sm text-gray-500 mb-4">{visibilityMeta.helper}</p>

                    {/* Event Details */}
                    <div className="space-y-3 mb-6">
                        <div className="flex items-center gap-3 text-gray-700">
                            <span className="text-xl">📅</span>
                            <span>{formatDate(displayedEvent.startTime)}</span>
                        </div>
                        <div className="flex items-center gap-3 text-gray-700">
                            <span className="text-xl">🕐</span>
                            <span>
                                {formatTime(displayedEvent.startTime)}
                                {displayedEvent.endTime && ` - ${formatTime(displayedEvent.endTime)}`}
                            </span>
                        </div>
                        {displayedEvent.location && (
                            <div className="flex items-center gap-3 text-gray-700">
                                <span className="text-xl">📍</span>
                                <span>{displayedEvent.location}</span>
                            </div>
                        )}
                        {displayedEvent.url && (
                            <div className="flex items-center gap-3 text-gray-700">
                                <span className="text-xl">🔗</span>
                                <a
                                    href={displayedEvent.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline"
                                >
                                    {displayedEvent.url}
                                </a>
                            </div>
                        )}
                        {event.recurrencePattern && (
                            <div className="flex items-center gap-3 text-gray-700">
                                <span className="text-xl">🔁</span>
                                <span>
                                    Repeats {getRecurrenceLabel(event.recurrencePattern)}
                                    {event.recurrenceEndDate && ` until ${formatDate(event.recurrenceEndDate)}`}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Event Description */}
                    {displayedEvent.summary && (
                        <div className="mb-6">
                            <p className="text-gray-700 text-lg">{displayedEvent.summary}</p>
                        </div>
                    )}

                    {/* Tags */}
                    {event.tags && event.tags.length > 0 && (
                        <div className="mb-6 flex flex-wrap gap-2">
                            {event.tags.map((tag) => (
                                <span
                                    key={tag.id}
                                    className="badge badge-primary"
                                >
                                    #{tag.tag}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* RSVP Buttons */}
                    <div className="flex gap-3 mb-6 pb-6 border-b border-gray-200">
                        <button
                            onClick={() => handleRSVP('attending')}
                            disabled={rsvpMutation.isPending}
                            className={buildRsvpButtonClass('attending')}
                            title={!user ? 'Sign up to RSVP' : ''}
                        >
                            {renderRsvpButtonContent('attending')}
                        </button>
                        <button
                            onClick={() => handleRSVP('maybe')}
                            disabled={rsvpMutation.isPending}
                            className={buildRsvpButtonClass('maybe')}
                            title={!user ? 'Sign up to RSVP' : ''}
                        >
                            {renderRsvpButtonContent('maybe')}
                        </button>
                        <button
                            onClick={handleLike}
                            disabled={likeMutation.isPending}
                            className={buildLikeButtonClass()}
                            title={!user ? 'Sign up to like this event' : ''}
                        >
                            ❤️ {event.likes?.length || 0}
                        </button>
                        <button
                            onClick={handleShare}
                            disabled={shareMutation.isPending || hasShared || userHasShared}
                            className={buildShareButtonClass()}
                            title={guestTooltip('Sign up to share this event')}
                        >
                            {renderShareButtonContent()}
                        </button>
                    </div>
                    {!user && (
                        <div className="mb-6 pb-4 border-b border-gray-200">
                            <p className="text-sm text-gray-500 text-center">
                                💡 <Link to="/login" className="text-blue-600 hover:underline font-medium">Sign up</Link> to RSVP, like, and comment on events
                            </p>
                        </div>
                    )}

                    {/* Attendees */}
                    {event.attendance && event.attendance.length > 0 && (
                        <div className="mb-6">
                            <h3 className="font-bold mb-3">Attendees</h3>
                            <div className="flex flex-wrap gap-2">
                                {event.attendance.slice(0, 10).map((a, i) => (
                                    <div key={i} className="badge badge-primary">
                                        {a.user.name || a.user.username}
                                        {a.status === 'maybe' && ' (Maybe)'}
                                    </div>
                                ))}
                                {event.attendance.length > 10 && (
                                    <div className="badge">+{event.attendance.length - 10} more</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Comments Section */}
                <div className="card p-6">
                    <h2 className="text-xl font-bold mb-4">
                        Comments ({event.comments?.length || 0})
                    </h2>

                    {/* Comment Form */}
                    {!user ? (
                        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-sm text-gray-700 mb-3">
                                Sign up to join the conversation and leave a comment
                            </p>
                            <button
                                onClick={() => {
                                    setPendingAction('comment')
                                    setSignupModalOpen(true)
                                }}
                                className="btn btn-primary w-full"
                            >
                                Sign Up to Comment
                            </button>
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
                                    className="textarea"
                                    rows={3}
                                />
                                {showMentionSuggestions && mentionSuggestions.length > 0 && (
                                    <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg">
                                        {mentionSuggestions.map((suggestion, index) => {
                                            const isActive = index === activeMentionIndex
                                            return (
                                                <button
                                                    type="button"
                                                    key={suggestion.id}
                                                    className={`flex w-full items-center gap-3 p-2 text-left transition-colors ${isActive ? 'bg-blue-50' : 'bg-white'}`}
                                                    onMouseDown={(e) => {
                                                        e.preventDefault()
                                                        applyMentionSuggestion(suggestion)
                                                    }}
                                                >
                                                    {suggestion.profileImage ? (
                                                        <img
                                                            src={suggestion.profileImage}
                                                            alt={suggestion.name || suggestion.username}
                                                            className="h-8 w-8 rounded-full object-cover"
                                                        />
                                                    ) : (
                                                        <div
                                                            className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold"
                                                            style={{ backgroundColor: suggestion.displayColor || '#3b82f6' }}
                                                        >
                                                            {suggestion.name?.[0] || suggestion.username[0]?.toUpperCase()}
                                                        </div>
                                                    )}
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-sm">{suggestion.name || suggestion.username}</span>
                                                        <span className="text-xs text-gray-500">@{suggestion.username}</span>
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                            <button
                                type="submit"
                                disabled={addCommentMutation.isPending || !comment.trim()}
                                className="btn btn-primary"
                            >
                                {addCommentMutation.isPending ? 'Posting...' : 'Post Comment'}
                            </button>
                        </form>
                    )}

                    {/* Comments List */}
                    <div className="space-y-4">
                        {event.comments?.map((c) => (
                            <div key={c.id} className="flex gap-3">
                                <div
                                    className="avatar w-10 h-10 flex-shrink-0"
                                    style={{ backgroundColor: c.author.displayColor || '#3b82f6' }}
                                >
                                    {c.author.name?.[0] || c.author.username[0].toUpperCase()}
                                </div>
                                <div className="flex-1">
                                    <div className="bg-gray-50 rounded-lg p-3">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="font-semibold text-sm">
                                                {c.author.name || c.author.username}
                                            </div>
                                            {user && c.author.id === user.id && (
                                                <button
                                                    onClick={() => handleDeleteComment(c.id)}
                                                    className="text-red-500 hover:text-red-700 text-xs"
                                                    title="Delete comment"
                                                >
                                                    🗑️
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-gray-700 break-words">
                                            {renderCommentContent(c.id, c.content, c.mentions)}
                                        </p>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        {new Date(c.createdAt).toLocaleString()}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

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
