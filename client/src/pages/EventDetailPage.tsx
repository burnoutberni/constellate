import { useState, useEffect } from 'react'
import { useLocation, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useRealtime } from '../hooks/useRealtime'

interface Event {
    id: string
    title: string
    summary?: string
    location?: string
    url?: string
    startTime: string
    endTime?: string
    eventStatus: string
    user: {
        id: string
        username: string
        name?: string
        displayColor?: string
        profileImage?: string
        isRemote?: boolean
    }
    attendance?: Array<{
        status: string
        user: {
            id: string
            username: string
            name?: string
            isRemote?: boolean
        }
    }>
    likes?: Array<{
        user: {
            username: string
            name?: string
        }
    }>
    comments?: Array<{
        id: string
        content: string
        createdAt: string
        author: {
            id: string
            username: string
            name?: string
            displayColor?: string
        }
    }>
}

export function EventDetailPage() {
    const location = useLocation()
    const navigate = useNavigate()
    const { user } = useAuth()
    const [event, setEvent] = useState<Event | null>(null)
    const [loading, setLoading] = useState(true)
    const [comment, setComment] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [userAttendance, setUserAttendance] = useState<string | null>(null)
    const [userLiked, setUserLiked] = useState<boolean>(false)
    const [username, setUsername] = useState<string>('')
    const [eventId, setEventId] = useState<string>('')

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

    // Real-time updates
    useRealtime({
        onEvent: (realtimeEvent) => {
            console.log('[EventDetail] Received SSE event:', realtimeEvent)
            console.log('[EventDetail] Current eventId:', eventId)
            console.log('[EventDetail] Event data.eventId:', realtimeEvent.data?.eventId)
            if (
                (realtimeEvent.type === 'attendance:updated' ||
                    realtimeEvent.type === 'attendance:removed' ||
                    realtimeEvent.type === 'like:added' ||
                    realtimeEvent.type === 'like:removed' ||
                    realtimeEvent.type === 'comment:added' ||
                    realtimeEvent.type === 'comment:deleted' ||
                    realtimeEvent.type === 'event:updated')
            ) {
                if (realtimeEvent.data?.eventId === eventId) {
                    console.log(`[EventDetail] ✅ EventId matches! Fetching event due to ${realtimeEvent.type}`)
                    fetchEvent()
                } else {
                    console.log(`[EventDetail] ⏭️  EventId mismatch (${realtimeEvent.data?.eventId} !== ${eventId}), skipping`)
                }
            } else if (realtimeEvent.type === 'event:deleted') {
                if (realtimeEvent.data?.eventId === eventId || realtimeEvent.data?.externalId?.includes(eventId)) {
                    console.log(`[EventDetail] Event was deleted, redirecting...`)
                    // Event was deleted, redirect to feed
                    navigate('/feed', { replace: true })
                }
            }
        },
    })

    useEffect(() => {
        if (username && eventId) {
            fetchEvent()
        }
    }, [username, eventId])

    const fetchEvent = async () => {
        try {
            setLoading(true)
            const response = await fetch(`/api/events/by-user/${encodeURIComponent(username)}/${encodeURIComponent(eventId)}`)
            const data = await response.json()
            setEvent(data)

            // Update user's attendance status and like status
            if (user) {
                const myAttendance = data.attendance?.find((a: any) => a.user.id === user.id)
                setUserAttendance(myAttendance?.status || null)
                const myLike = data.likes?.find((l: any) => l.user.id === user.id)
                setUserLiked(!!myLike)
            }
        } catch (error) {
            console.error('Error fetching event:', error)
        } finally {
            setLoading(false)
        }
    }

    // Update attendance status and like status when event or user changes
    useEffect(() => {
        if (event && user) {
            const myAttendance = event.attendance?.find((a: any) => a.user.id === user.id)
            setUserAttendance(myAttendance?.status || null)
            const myLike = event.likes?.find((l: any) => l.user.id === user.id)
            setUserLiked(!!myLike)
        }
    }, [event, user])

    const handleRSVP = async (status: string) => {
        if (!user) return
        try {
            // If clicking the same status, remove attendance (toggle off)
            if (userAttendance === status) {
                await fetch(`/api/events/${eventId}/attend`, {
                    method: 'DELETE',
                    credentials: 'include',
                })
                setUserAttendance(null)
            } else {
                // Set or change attendance
                await fetch(`/api/events/${eventId}/attend`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify({ status }),
                })
                setUserAttendance(status)
            }
            fetchEvent()
        } catch (error) {
            console.error('RSVP failed:', error)
        }
    }

    const handleLike = async () => {
        if (!user) return
        try {
            if (userLiked) {
                // Unlike
                await fetch(`/api/events/${eventId}/like`, {
                    method: 'DELETE',
                    credentials: 'include',
                })
                setUserLiked(false)
            } else {
                // Like
                await fetch(`/api/events/${eventId}/like`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                })
                setUserLiked(true)
            }
            fetchEvent()
        } catch (error) {
            console.error('Like failed:', error)
            // Revert on error
            setUserLiked(!userLiked)
        }
    }

    const handleCommentSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!comment.trim()) return

        try {
            if (!user) return
            setSubmitting(true)
            await fetch(`/api/events/${eventId}/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ content: comment }),
            })
            setComment('')
            fetchEvent()
        } catch (error) {
            console.error('Comment failed:', error)
        } finally {
            setSubmitting(false)
        }
    }

    const handleDeleteComment = async (commentId: string) => {
        if (!user) return
        if (!confirm('Are you sure you want to delete this comment?')) return

        try {
            await fetch(`/api/events/comments/${commentId}`, {
                method: 'DELETE',
                credentials: 'include',
            })
            fetchEvent()
        } catch (error) {
            console.error('Delete comment failed:', error)
            alert('Failed to delete comment')
        }
    }

    const handleDeleteEvent = async () => {
        if (!user) return
        if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) return

        try {
            const response = await fetch(`/api/events/${eventId}`, {
                method: 'DELETE',
                credentials: 'include',
                headers: {
                    'x-user-id': user.id,
                },
            })

            if (!response.ok) {
                const error = await response.json()
                alert(error.error || 'Failed to delete event')
                return
            }

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

    if (loading) {
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
                            Stellar Calendar
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
                            to={`/@${event.user.username}`}
                            className="flex items-start gap-4 hover:opacity-80 transition-opacity"
                        >
                            {event.user.profileImage ? (
                                <img
                                    src={event.user.profileImage}
                                    alt={event.user.name || event.user.username}
                                    className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                                />
                            ) : (
                                <div
                                    className="avatar w-16 h-16"
                                    style={{ backgroundColor: event.user.displayColor || '#3b82f6' }}
                                >
                                    {event.user.name?.[0] || event.user.username[0].toUpperCase()}
                                </div>
                            )}
                            <div>
                                <div className="font-semibold text-lg">
                                    {event.user.name || event.user.username}
                                </div>
                                <div className="text-gray-500">@{event.user.username}</div>
                            </div>
                        </Link>
                        {user && event.user.id === user.id && (
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

                    {/* RSVP Buttons */}
                    <div className="flex gap-3 mb-6 pb-6 border-b border-gray-200">
                        <button
                            onClick={() => handleRSVP('attending')}
                            className={`btn flex-1 ${userAttendance === 'attending'
                                ? 'btn-primary ring-2 ring-blue-600 ring-offset-2'
                                : 'btn-secondary'
                                }`}
                        >
                            👍 Going ({attending})
                        </button>
                        <button
                            onClick={() => handleRSVP('maybe')}
                            className={`btn flex-1 ${userAttendance === 'maybe'
                                ? 'btn-primary ring-2 ring-blue-600 ring-offset-2'
                                : 'btn-secondary'
                                }`}
                        >
                            🤔 Maybe ({maybe})
                        </button>
                        <button
                            onClick={handleLike}
                            className={`btn flex-1 ${userLiked
                                ? 'btn-primary ring-2 ring-red-600 ring-offset-2'
                                : 'btn-secondary'
                                }`}
                        >
                            ❤️ {event.likes?.length || 0}
                        </button>
                    </div>

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
                            disabled={submitting || !comment.trim()}
                            className="btn btn-primary"
                        >
                            {submitting ? 'Posting...' : 'Post Comment'}
                        </button>
                    </form>

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
        </div>
    )
}
