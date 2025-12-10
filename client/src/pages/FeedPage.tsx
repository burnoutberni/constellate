import { useMemo, useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Navbar } from '../components/Navbar'
import { CreateEventModal } from '../components/CreateEventModal'
import { MiniCalendar } from '../components/MiniCalendar'
import { ActivityFeedItem } from '../components/ActivityFeedItem'
import { LocationDiscoveryCard } from '../components/LocationDiscoveryCard'
import { useAuth } from '../contexts/AuthContext'
import { useEvents, useActivityFeed, useRecommendedEvents, useTrendingEvents } from '../hooks/queries'
import { useUIStore } from '../stores'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../hooks/queries/keys'
import type { EventVisibility } from '../types'
import { getVisibilityMeta } from '../lib/visibility'
import { eventsWithinRange } from '../lib/recurrence'

export function FeedPage() {
    const { user, logout } = useAuth()
    const location = useLocation()
    const { data: eventsData, isLoading: eventsLoading } = useEvents(100)
    const { data: activityData, isLoading: activityLoading } = useActivityFeed()
    const {
        data: recommendedData,
        isLoading: recommendationsLoading,
    } = useRecommendedEvents(5, { enabled: Boolean(user) })
    const { openCreateEventModal, closeCreateEventModal, createEventModalOpen, sseConnected } = useUIStore()
    const [selectedDate, setSelectedDate] = useState(new Date())
    const [activeTab, setActiveTab] = useState<'activity' | 'trending'>('activity')
    const [templateIdToUse, setTemplateIdToUse] = useState<string | undefined>(undefined)
    const {
        data: trendingData,
        isLoading: trendingLoading,
        isFetching: trendingFetching,
        refetch: refetchTrending,
        error: trendingError,
    } = useTrendingEvents(5, 7, { enabled: activeTab === 'trending' })
    const navigate = useNavigate()
    const queryClient = useQueryClient()

    const events = eventsData?.events || []
    const activities = activityData?.activities || []
    const recommendedEvents = recommendedData?.recommendations || []
    const trendingWindowLabel = trendingData ? `Last ${trendingData.windowDays} days` : 'Last 7 days'
    const trendingUpdatedAt = trendingData?.generatedAt ? new Date(trendingData.generatedAt) : null
    const trendingBusy = activeTab === 'trending' && (trendingLoading || (trendingFetching && !trendingData))
    const tabButtonClasses = (tab: 'activity' | 'trending') =>
        `px-4 py-2 font-semibold border-b-2 transition-colors ${
            activeTab === tab ? 'text-blue-600 border-blue-600' : 'text-gray-500 border-transparent hover:text-gray-700'
        }`
    const trendingEvents = trendingData?.events || []

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

    const formatDateTime = (dateString: string) => {
        return new Date(dateString).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        })
    }

    // Handle template from location state
    useEffect(() => {
        const state = location.state as { useTemplate?: { id: string } } | null
        if (state?.useTemplate?.id) {
            setTemplateIdToUse(state.useTemplate.id)
            openCreateEventModal()
            // Clear the state so it doesn't reopen on navigation
            navigate('/feed', { replace: true, state: {} })
        }
    }, [location.state, navigate, openCreateEventModal])

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

    const renderActivityFeed = () => {
        if (activityLoading) {
            return (
                <div className="card p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mx-auto" />
                </div>
            )
        }

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

        return activities.map((activity) => (
            <ActivityFeedItem key={activity.id} activity={activity} />
        ))
    }

    const renderTrendingEvents = () => {
        if (trendingBusy) {
            return (
                <div className="card p-8 text-center text-gray-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-orange-500 border-t-transparent mx-auto" />
                    <p className="mt-3 text-sm">Surfacing trending events…</p>
                </div>
            )
        }

        if (trendingError) {
            return (
                <div className="card p-6 text-center text-error-600 space-y-3">
                    <p>We couldn&apos;t load trending events.</p>
                    <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => refetchTrending()}
                    >
                        Try again
                    </button>
                </div>
            )
        }

        if (trendingEvents.length === 0) {
            return (
                <div className="card p-8 text-center text-gray-500">
                    <p className="mb-2">No trending events yet</p>
                    <p className="text-sm">
                        Likes, comments, and RSVPs will lift events into this tab.
                    </p>
                </div>
            )
        }

        return trendingEvents.map((event) => {
            const visibilityMeta = getVisibilityMeta(event.visibility as EventVisibility | undefined)
            return (
                <button
                    key={event.id}
                    type="button"
                    onClick={() => handleEventClick(event)}
                    className="card p-4 hover:border-blue-500 cursor-pointer transition-colors text-left w-full"
                >
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-3 text-sm text-gray-500">
                                <span className="font-semibold text-gray-400">
                                    #{event.trendingRank ?? '—'}
                                </span>
                                <span>{formatDateTime(event.startTime)}</span>
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900">
                                {event.title}
                            </h3>
                            {event.user && (
                                <p className="text-sm text-gray-500">
                                    @{event.user.username}
                                </p>
                            )}
                        </div>
                        <div className="text-right">
                            <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-sm font-semibold text-orange-700">
                                🔥 {event.trendingScore?.toFixed(1) ?? '—'}
                            </span>
                            <div className="text-xs text-gray-500 mt-2">
                                <span className={`badge ${visibilityMeta.badgeClass}`}>
                                    {visibilityMeta.icon} {visibilityMeta.label}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-600">
                        <span>👍 {event.trendingMetrics?.likes ?? 0} likes</span>
                        <span>💬 {event.trendingMetrics?.comments ?? 0} comments</span>
                        <span>👥 {event.trendingMetrics?.attendance ?? 0} RSVPs</span>
                    </div>
                    {event.tags?.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                            {event.tags.slice(0, 4).map((tag) => (
                                <span
                                    key={tag.id}
                                    className="badge badge-outline text-xs uppercase tracking-wide"
                                >
                                    #{tag.tag}
                                </span>
                            ))}
                            {event.tags.length > 4 && (
                                <span className="text-xs text-gray-400">
                                    +{event.tags.length - 4} more
                                </span>
                            )}
                        </div>
                    ) : null}
                </button>
            )
        })
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
                            <div className="flex items-center gap-4" role="tablist">
                                <button
                                    type="button"
                                    id="activity-tab"
                                    role="tab"
                                    aria-selected={activeTab === 'activity'}
                                    aria-controls="activity-tabpanel"
                                    className={tabButtonClasses('activity')}
                                    onClick={() => setActiveTab('activity')}
                                >
                                    Activity
                                </button>
                                <button
                                    type="button"
                                    id="trending-tab"
                                    role="tab"
                                    aria-selected={activeTab === 'trending'}
                                    aria-controls="trending-tabpanel"
                                    className={tabButtonClasses('trending')}
                                    onClick={() => setActiveTab('trending')}
                                >
                                    Trending
                                </button>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-500">
                                {activeTab === 'activity' ? (
                                    !user && (
                                        <p>
                                            <Link to="/login" className="text-blue-600 hover:underline">
                                                Sign in
                                            </Link>{' '}
                                            to see activities from people you follow
                                        </p>
                                    )
                                ) : (
                                    <>
                                        <span>
                                            {trendingUpdatedAt
                                                ? `Updated ${trendingUpdatedAt.toLocaleTimeString('en-US', {
                                                    hour: 'numeric',
                                                    minute: '2-digit',
                                                })}`
                                                : 'Awaiting data'}{' '}
                                            · {trendingWindowLabel}
                                        </span>
                                        <button
                                            type="button"
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => refetchTrending()}
                                            disabled={trendingFetching}
                                            aria-label={trendingFetching ? "Refreshing trending events" : "Refresh trending events"}
                                        >
                                            Refresh
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {activeTab === 'activity' ? (
                            <div role="tabpanel" id="activity-tabpanel" aria-labelledby="activity-tab">
                                {renderActivityFeed()}
                            </div>
                        ) : (
                            <div role="tabpanel" id="trending-tabpanel" aria-labelledby="trending-tab" className="space-y-4">
                                {renderTrendingEvents()}
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-4">
                        {/* Mini Calendar */}
                        <MiniCalendar
                            selectedDate={selectedDate}
                            onDateSelect={setSelectedDate}
                        />

                        {user && (
                            <div className="card p-4">
                                <h2 className="font-bold text-lg mb-3">Recommended events</h2>
                                {(() => {
                                    if (recommendationsLoading) {
                                        return (
                                            <div className="flex items-center justify-center py-4">
                                                <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent" />
                                            </div>
                                        )
                                    }
                                    if (recommendedEvents.length === 0) {
                                        return (
                                            <div className="text-sm text-gray-500 text-center py-4">
                                                Attend, like, or follow to personalize this list.
                                            </div>
                                        )
                                    }
                                    return (
                                        <div className="space-y-2">
                                            {recommendedEvents.map((item) => (
                                                <button
                                                    key={item.event.id}
                                                    type="button"
                                                    onClick={() => handleEventClick(item.event)}
                                                    className="p-2 rounded hover:bg-gray-50 cursor-pointer transition-colors border border-transparent hover:border-blue-200 text-left w-full"
                                                >
                                                    <div className="font-medium text-sm text-gray-900 truncate">
                                                        {item.event.title}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {new Date(item.event.startTime).toLocaleDateString('en-US', {
                                                            month: 'short',
                                                            day: 'numeric',
                                                        })}
                                                        {item.event.location && ` • ${item.event.location}`}
                                                    </div>
                                                    {item.reasons.length > 0 && (
                                                        <div className="text-[11px] text-teal-700 mt-1">
                                                            {item.reasons[0]}
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    )
                                })()}
                            </div>
                        )}

                        {/* Today's Events */}
                        <div className="card p-4">
                            <h2 className="font-bold text-lg mb-4">Today's Events</h2>
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
                                            <button
                                                key={event.id}
                                                type="button"
                                                onClick={() => handleEventClick(event)}
                                                className="p-2 rounded hover:bg-gray-50 cursor-pointer transition-colors text-left w-full"
                                            >
                                                <div className="font-medium text-sm text-gray-900">
                                                    {event.title}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {formatTime(event.startTime)}
                                                    {event.location && ` • ${event.location}`}
                                                </div>
                                            </button>
                                        ))}
                                        {todayEvents.length > 5 && (
                                            <div className="text-xs text-gray-400 text-center pt-2">
                                                +{todayEvents.length - 5} more
                                            </div>
                                        )}
                                    </div>
                                )
                            })()}
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
                                            {selectedDateEvents.map((event) => {
                                                const visibilityMeta = getVisibilityMeta(event.visibility as EventVisibility | undefined)
                                                return (
                                                    <button
                                                        key={event.id}
                                                        type="button"
                                                        onClick={() => handleEventClick(event)}
                                                        className="p-2 rounded hover:bg-gray-50 cursor-pointer transition-colors text-left w-full"
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
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )
                                })()}
                            </div>
                        )}

                        <LocationDiscoveryCard />

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
                initialTemplateId={templateIdToUse}
                onSuccess={() => {
                    closeCreateEventModal()
                    setTemplateIdToUse(undefined)
                    // Invalidate feed query
                    queryClient.invalidateQueries({ queryKey: queryKeys.activity.feed() })
                    queryClient.invalidateQueries({ queryKey: queryKeys.events.lists() })
                }}
            />
        </div>
    )

}
