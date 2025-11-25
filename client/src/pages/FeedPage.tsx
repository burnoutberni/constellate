import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Navbar } from '../components/Navbar'
import { useRealtime } from '../hooks/useRealtime'
import { CreateEventModal } from '../components/CreateEventModal'
import { useAuth } from '../contexts/AuthContext'

interface Event {
    id: string
    title: string
    summary?: string
    location?: string
    startTime: string
    endTime?: string
    user: {
        id: string
        username: string
        name?: string
        displayColor?: string
    }
    _count?: {
        attendance: number
        likes: number
        comments: number
    }
}

export function FeedPage() {
    const [events, setEvents] = useState<Event[]>([])
    const [loading, setLoading] = useState(true)
    const [showCreateModal, setShowCreateModal] = useState(false)

    const { user, logout } = useAuth();

    // Real-time updates
    const { isConnected } = useRealtime({
        onEvent: (event) => {
            if (event.type === 'event:created') {
                setEvents((prev) => [event.data.event, ...prev])
            } else if (event.type === 'event:updated') {
                setEvents((prev) =>
                    prev.map((e) => (e.id === event.data.event.id ? event.data.event : e))
                )
            } else if (event.type === 'event:deleted') {
                setEvents((prev) => prev.filter((e) => e.id !== event.data.eventId))
            }
        },
    })

    useEffect(() => {
        fetchEvents()
    }, [])

    const fetchEvents = async () => {
        try {
            setLoading(true)
            const response = await fetch('/api/events?limit=50')
            const data = await response.json()
            setEvents(data.events || [])
        } catch (error) {
            console.error('Error fetching events:', error)
        } finally {
            setLoading(false)
        }
    }

    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        const now = new Date()
        const diff = date.getTime() - now.getTime()
        const days = Math.floor(diff / (1000 * 60 * 60 * 24))

        if (days === 0) return 'Today'
        if (days === 1) return 'Tomorrow'
        if (days > 1 && days < 7) return `In ${days} days`

        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
        })
    }

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
        })
    }

    return (
        <div className="min-h-screen bg-gray-100">
            <Navbar isConnected={isConnected} user={user} onLogout={logout} />
            {/* Create Event Button */}
            <div className="max-w-6xl mx-auto px-4 py-4 flex justify-end">
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="btn btn-primary"
                >
                    Create Event
                </button>
            </div>

            {/* Main Content */}
            <div className="max-w-6xl mx-auto px-4 py-6">
                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Main Feed */}
                    <div className="lg:col-span-2 space-y-4">
                        {loading ? (
                            <div className="card p-8 text-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mx-auto" />
                            </div>
                        ) : events.length === 0 ? (
                            <div className="card p-8 text-center text-gray-500">
                                No events yet. Create one to get started!
                            </div>
                        ) : (
                            events
                                .filter((event) => event.user !== null) // Skip events without user data
                                .map((event) => (
                                    <Link
                                        key={event.id}
                                        to={`/@${event.user.username}/${event.id}`}
                                        className="block"
                                    >
                                        <div className="card-hover p-6 animate-fade-in">
                                            {/* Event Header */}
                                            <div className="flex items-start gap-3 mb-4">
                                                <div
                                                    className="avatar w-12 h-12 flex-shrink-0"
                                                    style={{ backgroundColor: event.user.displayColor || '#3b82f6' }}
                                                >
                                                    {event.user.name?.[0] || event.user.username[0].toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-semibold text-gray-900">
                                                        {event.user.name || event.user.username}
                                                    </div>
                                                    <div className="text-sm text-gray-500">
                                                        @{event.user.username}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Event Content */}
                                            <div className="mb-4">
                                                <h3 className="text-xl font-bold text-gray-900 mb-2">
                                                    {event.title}
                                                </h3>
                                                {event.summary && (
                                                    <p className="text-gray-700 mb-3">{event.summary}</p>
                                                )}

                                                {/* Event Details */}
                                                <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                                                    <div className="flex items-center gap-2">
                                                        <span>📅</span>
                                                        <span>{formatDate(event.startTime)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span>🕐</span>
                                                        <span>{formatTime(event.startTime)}</span>
                                                    </div>
                                                    {event.location && (
                                                        <div className="flex items-center gap-2">
                                                            <span>📍</span>
                                                            <span>{event.location}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Event Actions */}
                                            <div className="flex items-center gap-6 pt-3 border-t border-gray-100">
                                                <button className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors">
                                                    <span>👍</span>
                                                    <span className="text-sm">
                                                        {event._count?.attendance || 0} Going
                                                    </span>
                                                </button>
                                                <button className="flex items-center gap-2 text-gray-600 hover:text-red-600 transition-colors">
                                                    <span>❤️</span>
                                                    <span className="text-sm">
                                                        {event._count?.likes || 0}
                                                    </span>
                                                </button>
                                                <button className="flex items-center gap-2 text-gray-600 hover:text-green-600 transition-colors">
                                                    <span>💬</span>
                                                    <span className="text-sm">
                                                        {event._count?.comments || 0}
                                                    </span>
                                                </button>
                                                <button className="flex items-center gap-2 text-gray-600 hover:text-purple-600 transition-colors ml-auto">
                                                    <span>🔗</span>
                                                    <span className="text-sm">Share</span>
                                                </button>
                                            </div>
                                        </div>
                                    </Link>
                                ))
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-4">
                        {/* Upcoming Events */}
                        <div className="card p-4">
                            <h2 className="font-bold text-lg mb-4">Upcoming Events</h2>
                            <div className="space-y-3">
                                {events
                                    .filter((e) => new Date(e.startTime) > new Date())
                                    .slice(0, 5)
                                    .map((event) => (
                                        <div
                                            key={event.id}
                                            className="flex gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
                                        >
                                            <div
                                                className="w-12 h-12 rounded flex items-center justify-center text-white font-bold flex-shrink-0"
                                                style={{ backgroundColor: event.user.displayColor || '#3b82f6' }}
                                            >
                                                {new Date(event.startTime).getDate()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-sm truncate">
                                                    {event.title}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {formatDate(event.startTime)}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>

                        {/* Suggestions */}
                        <div className="card p-4">
                            <h2 className="font-bold text-lg mb-4">Discover</h2>
                            <div className="space-y-2">
                                <Link to="/discover" className="block text-sm text-blue-600 hover:underline">
                                    Browse all events
                                </Link>
                                <Link to="/calendar" className="block text-sm text-blue-600 hover:underline">
                                    View calendar
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Create Event Modal */}
            <CreateEventModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSuccess={fetchEvents}
            />
        </div>
    )
}
