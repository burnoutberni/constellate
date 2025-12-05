import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Navbar } from '../components/Navbar'
import { CreateEventModal } from '../components/CreateEventModal'
import { MiniCalendar } from '../components/MiniCalendar'
import { ActivityFeedItem } from '../components/ActivityFeedItem'
import { useAuth } from '../contexts/AuthContext'
import { useEvents, useActivityFeed } from '../hooks/queries'
import { useUIStore } from '../stores'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../hooks/queries/keys'
import type { EventVisibility } from '../types'
import { getVisibilityMeta } from '../lib/visibility'
import { eventsWithinRange } from '../lib/recurrence'

export function FeedPage() {
    const { user, logout } = useAuth()
    const { data: eventsData, isLoading: eventsLoading } = useEvents(100)
    const { data: activityData, isLoading: activityLoading } = useActivityFeed()
    const { openCreateEventModal, closeCreateEventModal, createEventModalOpen, sseConnected } = useUIStore()
    const [selectedDate, setSelectedDate] = useState(new Date())
    const navigate = useNavigate()
    const queryClient = useQueryClient()

    const events = eventsData?.events || []
    const activities = activityData?.activities || []

    // Get events for selected date
    const selectedDateStart = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
        0,
        0,
        0,
        0
    )
    const selectedDateEnd = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
        23,
        59,
        59,
        999
    )
    const selectedDateEvents = useMemo(
        () => eventsWithinRange(events, selectedDateStart, selectedDateEnd),
        [events, selectedDateStart.getTime(), selectedDateEnd.getTime()]
    )

    // Get today's events
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    const todayEvents = useMemo(
        () => eventsWithinRange(events, todayStart, todayEnd),
        [events, todayStart.getTime(), todayEnd.getTime()]
    )

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
        })
    }



    const handleEventClick = (event: typeof events[0]) => {
        if (event.user?.username) {
            const eventId = event.originalEventId || event.id
            navigate(`/@${event.user.username}/${eventId}`)
        }
    }

    const isToday = (date: Date) => {
        const today = new Date()
        return (
            date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear()
        )
    }


    const renderTodayEvents = () => {
        if (eventsLoading) {
            return (
                <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent" />
                </div>
            )
        }

        if (todayEvents.length === 0) {
            return (
                <div className="text-center py-4 text-gray-500 text-sm">
                    No events today
                </div>
            )
        }

        return (
            <div className="space-y-2">
                {todayEvents.slice(0, 5).map((event) => {
                    const visibilityMeta = getVisibilityMeta(event.visibility as EventVisibility | undefined)
                    return (
                        <div
                            key={event.id}
                            onClick={() => handleEventClick(event)}
                            className="p-2 rounded hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                            <div className="font-medium text-sm text-gray-900">
                                {event.title}
                            </div>
                            <div className="text-xs text-gray-500">
                                {formatTime(event.startTime)}
                                {event.location && ` • ${event.location}`}
                            </div>
                            <div className="mt-1">
                                <span className={`badge ${visibilityMeta.badgeClass}`}>
                                    {visibilityMeta.icon} {visibilityMeta.label}
                                </span>
                            </div>
                        </div>
                    )
                })}
                {todayEvents.length > 5 && (
                    <div className="text-xs text-gray-400 text-center pt-2">
                        +{todayEvents.length - 5} more
                    </div>
                )}
            </div>
        )
    }

    const renderSelectedDateEvents = () => {
        if (eventsLoading) {
            return (
                <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent" />
                </div>
            )
        }

        if (selectedDateEvents.length === 0) {
            return (
                <div className="text-center py-4 text-gray-500 text-sm">
                    No events on this date
                </div>
            )
        }

        return (
            <div className="space-y-2">
                {selectedDateEvents.map((event) => {
                    const visibilityMeta = getVisibilityMeta(event.visibility as EventVisibility | undefined)
                    return (
                        <div
                            key={event.id}
                            onClick={() => handleEventClick(event)}
                            className="p-2 rounded hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                            <div className="font-medium text-sm text-gray-900">
                                {event.title}
                            </div>
                            <div className="text-xs text-gray-500">
                                {formatTime(event.startTime)}
                                {event.location && ` • ${event.location}`}
                            </div>
                            {event.user && (
                                <div className="text-xs text-gray-400 mt-1">
                                    by @{event.user.username}
                                </div>
                            )}
                            <div className="mt-1">
                                <span className={`badge ${visibilityMeta.badgeClass}`}>
                                    {visibilityMeta.icon} {visibilityMeta.label}
                                </span>
                            </div>
                        </div>
                    )
                })}
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-100">
            <Navbar isConnected={sseConnected} user={user} onLogout={logout} />
            {/* Create Event Button */}
            <div className="max-w-6xl mx-auto px-4 py-4 flex justify-end">
                <button
                    onClick={openCreateEventModal}
                    className="btn btn-primary"
                >
                    Create Event
                </button>
            </div>

            {/* Main Content */}
            <div className="max-w-6xl mx-auto px-4 py-6">
                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Main Feed - Activity Feed */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-2xl font-bold text-gray-900">Activity Feed</h2>
                            {!user && (
                                <p className="text-sm text-gray-500">
                                    <Link to="/login" className="text-blue-600 hover:underline">
                                        Sign in
                                    </Link>{' '}
                                    to see activities from people you follow
                                </p>
                            )}
                        </div>

                        {activityLoading ? (
                            <div className="card p-8 text-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mx-auto" />
                            </div>
                        ) : (() => {
                            if (activities.length === 0) {
                                return (
                                    <div className="card p-8 text-center text-gray-500">
                                        {user ? (
                                            <>
                                                <p className="mb-2">No activity yet</p>
                                                <p className="text-sm">
                                                    Follow people to see their activities in your feed
                                                </p>
                                            </>
                                        ) : (
                                            <>
                                                <p className="mb-2">Sign in to see your activity feed</p>
                                                <Link to="/login" className="btn btn-primary mt-4">
                                                    Sign In
                                                </Link>
                                            </>
                                        )}
                                    </div>
                                )
                            }
                            return (
                                activities.map((activity) => (
                                    <ActivityFeedItem key={activity.id} activity={activity} />
                                ))
                            )
                        })()}
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-4">
                        {/* Mini Calendar */}
                        <MiniCalendar
                            selectedDate={selectedDate}
                            onDateSelect={setSelectedDate}
                        />

                        {/* Today's Events */}
                        <div className="card p-4">
                            <h2 className="font-bold text-lg mb-4">Today's Events</h2>
<<<<<<< HEAD
                            {renderTodayEvents()}
=======
                            {eventsLoading ? (
                                <div className="flex items-center justify-center py-4">
                                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent" />
                                </div>
                            ) : (() => {
                                if (todayEvents.length === 0) {
                                    return (
                                        <div className="text-center py-4 text-gray-500 text-sm">
                                            No events today
                                        </div>
                                    )
                                }
                                return (
                                <div className="space-y-2">
                                    {todayEvents.slice(0, 5).map((event) => (
                                        <div
                                            key={event.id}
                                            onClick={() => handleEventClick(event)}
                                            className="p-2 rounded hover:bg-gray-50 cursor-pointer transition-colors"
                                        >
                                            <div className="font-medium text-sm text-gray-900">
                                                {event.title}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {formatTime(event.startTime)}
                                                {event.location && ` • ${event.location}`}
                                            </div>
                                        </div>
                                    ))}
                                    {todayEvents.length > 5 && (
                                        <div className="text-xs text-gray-400 text-center pt-2">
                                            +{todayEvents.length - 5} more
                                        </div>
                                    )}
                                </div>
                                )
                            })()}
>>>>>>> 5aec5b7 (Refactor conditional rendering to use IIFEs)
                        </div>

                        {/* Selected Date Events */}
                        {!isToday(selectedDate) && (
                            <div className="card p-4">
                                <h2 className="font-bold text-lg mb-4">
                                    {selectedDate.toLocaleDateString('en-US', {
                                        weekday: 'long',
                                        month: 'short',
                                        day: 'numeric',
                                    })}
                                </h2>
<<<<<<< HEAD
                                {renderSelectedDateEvents()}
=======
                                {eventsLoading ? (
                                    <div className="flex items-center justify-center py-4">
                                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent" />
                                    </div>
                                ) : (() => {
                                    if (selectedDateEvents.length === 0) {
                                        return (
                                            <div className="text-center py-4 text-gray-500 text-sm">
                                                No events on this date
                                            </div>
                                        )
                                    }
                                    return (
                                    <div className="space-y-2">
                                        {selectedDateEvents.map((event) => (
                                            <div
                                                key={event.id}
                                                onClick={() => handleEventClick(event)}
                                                className="p-2 rounded hover:bg-gray-50 cursor-pointer transition-colors"
                                            >
                                                <div className="font-medium text-sm text-gray-900">
                                                    {event.title}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {formatTime(event.startTime)}
                                                    {event.location && ` • ${event.location}`}
                                                </div>
                                                {event.user && (
                                                    <div className="text-xs text-gray-400 mt-1">
                                                        by @{event.user.username}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    )
                                })()}
>>>>>>> 5aec5b7 (Refactor conditional rendering to use IIFEs)
                            </div>
                        )}

                        {/* Suggestions */}
                        <div className="card p-4">
                            <h2 className="font-bold text-lg mb-4">Discover</h2>
                            <div className="space-y-2">
                                <Link to="/" className="block text-sm text-blue-600 hover:underline">
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
                isOpen={createEventModalOpen}
                onClose={closeCreateEventModal}
                onSuccess={() => {
                    closeCreateEventModal()
                    // Invalidate feed query
                    queryClient.invalidateQueries({ queryKey: queryKeys.activity.feed() })
                    queryClient.invalidateQueries({ queryKey: queryKeys.events.lists() })
                }}
            />
        </div>
    )

}
