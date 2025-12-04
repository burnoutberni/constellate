import { useState, useEffect } from 'react'
import { useLocation, Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import {
    useEventDetail,
    useRSVP,
    useLikeEvent,
    useAddComment,
    useDeleteEvent,
} from '../hooks/queries/events'
import { queryKeys } from '../hooks/queries/keys'
import { SignupModal } from '../components/SignupModal'

export function EventDetailPage() {
    const location = useLocation()
    const navigate = useNavigate()
    const { user } = useAuth()
    const [comment, setComment] = useState('')
    const [username, setUsername] = useState<string>('')
    const [eventId, setEventId] = useState<string>('')
    const [signupModalOpen, setSignupModalOpen] = useState(false)
    const [pendingAction, setPendingAction] = useState<'rsvp' | 'like' | 'comment' | null>(null)
    const [pendingRSVPStatus, setPendingRSVPStatus] = useState<string | null>(null)

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

    // Mutations
    const queryClient = useQueryClient()
    const rsvpMutation = useRSVP(eventId, user?.id)
    const likeMutation = useLikeEvent(eventId, user?.id)
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

    const handleRSVP = async (status: string) => {
        if (!user) {
            setPendingAction('rsvp')
            setPendingRSVPStatus(status)
            setSignupModalOpen(true)
            return
        }
        try {
            // If clicking the same status, remove attendance (toggle off)
            if (userAttendance === status) {
                await rsvpMutation.mutateAsync(null)
            } else {
                // Set or change attendance
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
        } catch (error) {
            console.error('Comment failed:', error)
        }
    }

    // Handle successful signup - perform the pending action
    const handleSignupSuccess = async () => {
        if (!pendingAction) return

        // The modal will close, and we'll wait for user state to update
        // The useEffect below will handle executing the action
    }

    // Execute pending action when user becomes available
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
    }, [user, pendingAction, pendingRSVPStatus, comment, rsvpMutation, likeMutation, addCommentMutation])

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

    const attending = event.attendance?.filter((a) => a.status === 'attending').length || 0
    const maybe = event.attendance?.filter((a) => a.status === 'maybe').length || 0

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
                    <h1 className="text-3xl font-bold mb-4">{event.title}</h1>

                    {/* Event Details */}
                    <div className="space-y-3 mb-6">
                        <div className="flex items-center gap-3 text-gray-700">
                            <span className="text-xl">📅</span>
                            <span>{formatDate(event.startTime)}</span>
                        </div>
                        <div className="flex items-center gap-3 text-gray-700">
                            <span className="text-xl">🕐</span>
                            <span>
                                {formatTime(event.startTime)}
                                {event.endTime && ` - ${formatTime(event.endTime)}`}
                            </span>
                        </div>
                        {event.location && (
                            <div className="flex items-center gap-3 text-gray-700">
                                <span className="text-xl">📍</span>
                                <span>{event.location}</span>
                            </div>
                        )}
                        {event.url && (
                            <div className="flex items-center gap-3 text-gray-700">
                                <span className="text-xl">🔗</span>
                                <a
                                    href={event.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline"
                                >
                                    {event.url}
                                </a>
                            </div>
                        )}
                    </div>

                    {/* Event Description */}
                    {event.summary && (
                        <div className="mb-6">
                            <p className="text-gray-700 text-lg">{event.summary}</p>
                        </div>
                    )}

                    {/* Tags */}
                    {event.tags && event.tags.length > 0 && (
                        <div className="mb-6">
                            <div className="flex flex-wrap gap-2">
                                {event.tags.map((tagObj, index) => (
                                    <span
                                        key={index}
                                        className="badge badge-primary cursor-pointer hover:opacity-80"
                                        onClick={() => {
                                            // Navigate to search with tag filter
                                            window.location.href = `/feed?tags=${encodeURIComponent(tagObj.tag)}`
                                        }}
                                    >
                                        #{tagObj.tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* RSVP Buttons */}
                    <div className="flex gap-3 mb-6 pb-6 border-b border-gray-200">
                        <button
                            onClick={() => handleRSVP('attending')}
                            disabled={rsvpMutation.isPending}
                            className={`btn flex-1 flex items-center justify-center gap-2 ${userAttendance === 'attending'
                                ? 'btn-primary ring-2 ring-blue-600 ring-offset-2'
                                : user
                                    ? 'btn-secondary'
                                    : 'btn-secondary hover:bg-blue-50 border-blue-300'
                                }`}
                            title={!user ? 'Sign up to RSVP' : ''}
                        >
                            {rsvpMutation.isPending && (userAttendance === 'attending' || !userAttendance) ? (
                                <>
                                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>Updating...</span>
                                </>
                            ) : (
                                <>👍 Going ({attending})</>
                            )}
                        </button>
                        <button
                            onClick={() => handleRSVP('maybe')}
                            disabled={rsvpMutation.isPending}
                            className={`btn flex-1 flex items-center justify-center gap-2 ${userAttendance === 'maybe'
                                ? 'btn-primary ring-2 ring-blue-600 ring-offset-2'
                                : user
                                    ? 'btn-secondary'
                                    : 'btn-secondary hover:bg-blue-50 border-blue-300'
                                }`}
                            title={!user ? 'Sign up to RSVP' : ''}
                        >
                            {rsvpMutation.isPending && userAttendance === 'maybe' ? (
                                <>
                                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>Updating...</span>
                                </>
                            ) : (
                                <>🤔 Maybe ({maybe})</>
                            )}
                        </button>
                        <button
                            onClick={handleLike}
                            disabled={likeMutation.isPending}
                            className={`btn flex-1 ${userLiked
                                ? 'btn-primary ring-2 ring-red-600 ring-offset-2'
                                : user
                                    ? 'btn-secondary'
                                    : 'btn-secondary hover:bg-blue-50 border-blue-300'
                                }`}
                            title={!user ? 'Sign up to like this event' : ''}
                        >
                            ❤️ {event.likes?.length || 0}
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
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="Add a comment..."
                                className="textarea mb-3"
                                rows={3}
                            />
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
                                        <p className="text-gray-700">{c.content}</p>
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
                action={pendingAction || undefined}
                onSuccess={handleSignupSuccess}
            />
        </div>
    )
}
