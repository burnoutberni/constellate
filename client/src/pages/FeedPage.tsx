import { useMemo, useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Navbar } from '../components/Navbar'
import { CreateEventModal } from '../components/CreateEventModal'
import { MiniCalendar } from '../components/MiniCalendar'
import { ActivityFeedItem } from '../components/ActivityFeedItem'
import { ActivityFilters, type ActivityFilterType } from '../components/ActivityFilters'
import { LocationDiscoveryCard } from '../components/LocationDiscoveryCard'
import { useAuth } from '../hooks/useAuth'
import { useEvents, useActivityFeed, useRecommendedEvents, useTrendingEvents, queryKeys } from '@/hooks/queries'
import { useUIStore } from '@/stores'
import { useQueryClient } from '@tanstack/react-query'
import type { EventVisibility, Activity } from '@/types'
import { getVisibilityMeta } from '../lib/visibility'
import { eventsWithinRange } from '../lib/recurrence'
import { Button, Card, Badge, Spinner } from '@/components/ui'
import { Container, Stack } from '@/components/layout'
import { ErrorBoundary } from '../components/ErrorBoundary'

function getEmptyActivityMessage(filter: ActivityFilterType): string {
    if (filter === 'all') {
return 'No activity yet'
}
    if (filter === 'events') {
return 'No event activities'
}
    return 'No interactions yet'
}

function getBadgeVariant(badgeClass: string): 'success' | 'warning' | 'error' | 'default' {
    if (badgeClass.includes('success')) {
return 'success'
}
    if (badgeClass.includes('warning')) {
return 'warning'
}
    if (badgeClass.includes('error')) {
return 'error'
}
    return 'default'
}

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
    const [activityFilter, setActivityFilter] = useState<ActivityFilterType>('all')
    const {
        data: trendingData,
        isLoading: trendingLoading,
        isFetching: trendingFetching,
        refetch: refetchTrending,
        error: trendingError,
    } = useTrendingEvents(5, 7, { enabled: activeTab === 'trending' })
    const navigate = useNavigate()
    const queryClient = useQueryClient()

    const events = useMemo(() => eventsData?.events || [], [eventsData?.events])
    const allActivities = useMemo(() => activityData?.activities || [], [activityData?.activities])
    const recommendedEvents = recommendedData?.recommendations || []

    // Filter activities based on selected filter
    const activities = useMemo(() => {
        if (activityFilter === 'all') {
            return allActivities
        }
        if (activityFilter === 'events') {
            return allActivities.filter((a: Activity) => a.type === 'event_created' || a.type === 'event_shared')
        }
        if (activityFilter === 'interactions') {
            return allActivities.filter((a: Activity) => a.type === 'like' || a.type === 'rsvp' || a.type === 'comment')
        }
        return allActivities
    }, [allActivities, activityFilter])
    const trendingWindowLabel = trendingData ? `Last ${trendingData.windowDays} days` : 'Last 7 days'
    const trendingUpdatedAt = trendingData?.generatedAt ? new Date(trendingData.generatedAt) : null
    const trendingBusy = activeTab === 'trending' && (trendingLoading || (trendingFetching && !trendingData))
    const trendingEvents = trendingData?.events || []

    // Get events for selected date
    const selectedDateStart = useMemo(
        () => new Date(
            selectedDate.getFullYear(),
            selectedDate.getMonth(),
            selectedDate.getDate(),
            0,
            0,
            0,
            0,
        ),
        [selectedDate],
    )
    const selectedDateEnd = useMemo(
        () => new Date(
            selectedDate.getFullYear(),
            selectedDate.getMonth(),
            selectedDate.getDate(),
            23,
            59,
            59,
            999,
        ),
        [selectedDate],
    )
    const selectedDateEvents = useMemo(
        () => eventsWithinRange(events, selectedDateStart, selectedDateEnd),
        [events, selectedDateStart, selectedDateEnd],
    )

    // Get today's events
    const todayStart = useMemo(() => {
        const now = new Date()
        return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    }, [])
    const todayEnd = useMemo(() => {
        const now = new Date()
        return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    }, [])
    const todayEvents = useMemo(
        () => eventsWithinRange(events, todayStart, todayEnd),
        [events, todayStart, todayEnd],
    )

    const formatTime = (dateString: string) => new Date(dateString).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
        })

    const formatDateTime = (dateString: string) => new Date(dateString).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        })

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
                <Card variant="default" padding="lg" className="text-center">
                    <Spinner size="md" />
                </Card>
            )
        }

        if (activities.length === 0) {
            return (
                <Card variant="default" padding="lg" className="text-center">
                    {user ? (
                        <>
                            <p className="text-text-primary mb-2">
                                {getEmptyActivityMessage(activityFilter)}
                            </p>
                            <p className="text-sm text-text-secondary">
                                Follow people to see their activities in your feed
                            </p>
                        </>
                    ) : (
                        <>
                            <p className="text-text-primary mb-2">Sign in to see your activity feed</p>
                            <Link to="/login">
                                <Button variant="primary" size="md" className="mt-4">
                                    Sign In
                                </Button>
                            </Link>
                        </>
                    )}
                </Card>
            )
        }

        return activities.map((activity: Activity) => (
            <ActivityFeedItem key={activity.id} activity={activity} />
        ))
    }

    const renderTrendingEvents = () => {
        if (trendingBusy) {
            return (
                <Card variant="default" padding="lg" className="text-center">
                    <Spinner size="md" />
                    <p className="mt-3 text-sm text-text-secondary">Surfacing trending events�</p>
                </Card>
            )
        }

        if (trendingError) {
            return (
                <Card variant="default" padding="md" className="text-center space-y-3">
                    <p className="text-error-600">We couldn&apos;t load trending events.</p>
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={() => refetchTrending()}
                    >
                        Try again
                    </Button>
                </Card>
            )
        }

        if (trendingEvents.length === 0) {
            return (
                <Card variant="default" padding="lg" className="text-center">
                    <p className="text-text-primary mb-2">No trending events yet</p>
                    <p className="text-sm text-text-secondary">
                        Likes, comments, and RSVPs will lift events into this tab.
                    </p>
                </Card>
            )
        }

        return trendingEvents.map((event) => {
            const visibilityMeta = getVisibilityMeta(event.visibility as EventVisibility | undefined)
            return (
                <Card
                    key={event.id}
                    variant="default"
                    padding="md"
                    className="hover:border-border-hover cursor-pointer transition-colors"
                    onClick={() => handleEventClick(event)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            handleEventClick(event)
                        }
                    }}
                >
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 text-sm text-text-tertiary mb-1">
                                <span className="font-semibold">
                                    #{event.trendingRank ?? '�'}
                                </span>
                                <span>{formatDateTime(event.startTime)}</span>
                            </div>
                            <h3 className="text-xl font-semibold text-text-primary truncate">
                                {event.title}
                            </h3>
                            {event.user && (
                                <p className="text-sm text-text-secondary">
                                    @{event.user.username}
                                </p>
                            )}
                        </div>
                        <div className="text-right flex-shrink-0">
                            <Badge variant="warning" size="md" className="font-semibold">
                                ?? {event.trendingScore?.toFixed(1) ?? '�'}
                            </Badge>
                            <div className="mt-2">
                                <Badge
                                    variant={getBadgeVariant(visibilityMeta.badgeClass)}
                                    size="sm"
                                >
                                    {visibilityMeta.icon} {visibilityMeta.label}
                                </Badge>
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-4 text-xs text-text-secondary">
                        <span>?? {event.trendingMetrics?.likes ?? 0} likes</span>
                        <span>?? {event.trendingMetrics?.comments ?? 0} comments</span>
                        <span>?? {event.trendingMetrics?.attendance ?? 0} RSVPs</span>
                    </div>
                    {event.tags?.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                            {event.tags.slice(0, 4).map((tag) => (
                                <Badge
                                    key={tag.id}
                                    variant="primary"
                                    size="sm"
                                >
                                    #{tag.tag}
                                </Badge>
                            ))}
                            {event.tags.length > 4 && (
                                <span className="text-xs text-text-tertiary">
                                    +{event.tags.length - 4} more
                                </span>
                            )}
                        </div>
                    ) : null}
                </Card>
            )
        })
    }

    return (
        <div className="min-h-screen bg-background-primary">
            <Navbar isConnected={sseConnected} user={user} onLogout={logout} />

            <Container size="xl" className="py-4">
                {/* Create Event Button */}
                <div className="flex justify-end mb-4">
                    <Button
                        variant="primary"
                        size="md"
                        onClick={openCreateEventModal}
                    >
                        Create Event
                    </Button>
                </div>

                {/* Main Content */}
                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Main Feed - Activity Feed */}
                    <div className="lg:col-span-2 space-y-4">
                        <ErrorBoundary resetKeys={[activeTab, activityFilter]}>
                            {/* Tab Navigation */}
                            <Stack direction="column" directionSm="row" alignSm="center" justifySm="between" gap="md" className="mb-4">
                            <div className="flex items-center gap-2" role="tablist">
                                <Button
                                    variant={activeTab === 'activity' ? 'primary' : 'ghost'}
                                    size="md"
                                    onClick={() => setActiveTab('activity')}
                                    role="tab"
                                    aria-selected={activeTab === 'activity'}
                                    aria-controls="activity-tabpanel"
                                >
                                    Activity
                                </Button>
                                <Button
                                    variant={activeTab === 'trending' ? 'primary' : 'ghost'}
                                    size="md"
                                    onClick={() => setActiveTab('trending')}
                                    role="tab"
                                    aria-selected={activeTab === 'trending'}
                                    aria-controls="trending-tabpanel"
                                >
                                    Trending
                                </Button>
                            </div>

                            {/* Right side info/actions */}
                            <div className="flex items-center gap-3 text-sm text-text-secondary">
                                {activeTab === 'activity' ? (
                                    !user && (
                                        <p>
                                            <Link to="/login" className="text-primary-600 hover:underline">
                                                Sign in
                                            </Link>{' '}
                                            to see activities from people you follow
                                        </p>
                                    )
                                ) : (
                                    <>
                                        <span className="hidden sm:inline">
                                            {trendingUpdatedAt
                                                ? `Updated ${trendingUpdatedAt.toLocaleTimeString('en-US', {
                                                    hour: 'numeric',
                                                    minute: '2-digit',
                                                })}`
                                                : 'Awaiting data'}{' '}
                                            � {trendingWindowLabel}
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => refetchTrending()}
                                            loading={trendingFetching}
                                            disabled={trendingFetching}
                                            aria-label={trendingFetching ? 'Refreshing trending events' : 'Refresh trending events'}
                                        >
                                            Refresh
                                        </Button>
                                    </>
                                )}
                            </div>
                        </Stack>

                        {/* Activity Filters - Only show for activity tab */}
                        {activeTab === 'activity' && user && (
                            <div className="mb-4">
                                <ActivityFilters
                                    activeFilter={activityFilter}
                                    onFilterChange={setActivityFilter}
                                />
                            </div>
                        )}

                        {activeTab === 'activity' ? (
                            <div role="tabpanel" id="activity-tabpanel" aria-labelledby="activity-tab" className="space-y-4">
                                {renderActivityFeed()}
                            </div>
                        ) : (
                            <div role="tabpanel" id="trending-tabpanel" aria-labelledby="trending-tab" className="space-y-4">
                                {renderTrendingEvents()}
                            </div>
                        )}
                        </ErrorBoundary>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-4">
                        {/* Mini Calendar */}
                        <MiniCalendar
                            selectedDate={selectedDate}
                            onDateSelect={setSelectedDate}
                        />

                        {user && (
                            <Card variant="default" padding="md">
                                <h2 className="font-bold text-lg text-text-primary mb-3">Recommended events</h2>
                                {(() => {
                                    if (recommendationsLoading) {
                                        return (
                                            <div className="flex items-center justify-center py-4">
                                                <Spinner size="sm" />
                                            </div>
                                        )
                                    }
                                    if (recommendedEvents.length === 0) {
                                        return (
                                            <div className="text-sm text-text-secondary text-center py-4">
                                                Attend, like, or follow to personalize this list.
                                            </div>
                                        )
                                    }
                                    return (
                                        <div className="space-y-2">
                                            {recommendedEvents.map((item) => (
                                                <Button
                                                    key={item.event.id}
                                                    type="button"
                                                    onClick={() => handleEventClick(item.event)}
                                                    variant="ghost"
                                                    className="p-2 rounded hover:bg-background-secondary cursor-pointer transition-colors border border-transparent hover:border-border-hover justify-start w-full"
                                                >
                                                    <div className="font-medium text-sm text-text-primary truncate">
                                                        {item.event.title}
                                                    </div>
                                                    <div className="text-xs text-text-secondary">
                                                        {new Date(item.event.startTime).toLocaleDateString('en-US', {
                                                            month: 'short',
                                                            day: 'numeric',
                                                        })}
                                                        {item.event.location && ` � ${item.event.location}`}
                                                    </div>
                                                    {item.reasons.length > 0 && (
                                                        <div className="text-[11px] text-success-700 mt-1">
                                                            {item.reasons[0]}
                                                        </div>
                                                    )}
                                                </Button>
                                            ))}
                                        </div>
                                    )
                                })()}
                            </Card>
                        )}

                        {/* Today's Events */}
                        <Card variant="default" padding="md">
                            <h2 className="font-bold text-lg text-text-primary mb-4">Today&apos;s Events</h2>
                            {eventsLoading ? (
                                <div className="flex items-center justify-center py-4">
                                    <Spinner size="sm" />
                                </div>
                            ) : (() => {
                                if (todayEvents.length === 0) {
                                    return (
                                        <div className="text-center py-4 text-text-secondary text-sm">
                                            No events today
                                        </div>
                                    )
                                }
                                return (
                                    <div className="space-y-2">
                                        {todayEvents.slice(0, 5).map((event) => (
                                            <Button
                                                key={event.id}
                                                type="button"
                                                onClick={() => handleEventClick(event)}
                                                variant="ghost"
                                                className="p-2 rounded hover:bg-background-secondary cursor-pointer transition-colors justify-start w-full"
                                            >
                                                <div className="font-medium text-sm text-text-primary">
                                                    {event.title}
                                                </div>
                                                <div className="text-xs text-text-secondary">
                                                    {formatTime(event.startTime)}
                                                    {event.location && ` � ${event.location}`}
                                                </div>
                                            </Button>
                                        ))}
                                        {todayEvents.length > 5 && (
                                            <div className="text-xs text-text-tertiary text-center pt-2">
                                                +{todayEvents.length - 5} more
                                            </div>
                                        )}
                                    </div>
                                )
                            })()}
                        </Card>

                        {/* Selected Date Events */}
                        {!isToday(selectedDate) && (
                            <Card variant="default" padding="md">
                                <h2 className="font-bold text-lg text-text-primary mb-4">
                                    {selectedDate.toLocaleDateString('en-US', {
                                        weekday: 'long',
                                        month: 'short',
                                        day: 'numeric',
                                    })}
                                </h2>
                                {eventsLoading ? (
                                    <div className="flex items-center justify-center py-4">
                                        <Spinner size="sm" />
                                    </div>
                                ) : (() => {
                                    if (selectedDateEvents.length === 0) {
                                        return (
                                            <div className="text-center py-4 text-text-secondary text-sm">
                                                No events on this date
                                            </div>
                                        )
                                    }
                                    return (
                                        <div className="space-y-2">
                                            {selectedDateEvents.map((event) => {
                                                const visibilityMeta = getVisibilityMeta(event.visibility as EventVisibility | undefined)
                                                return (
                                                    <Button
                                                        key={event.id}
                                                        type="button"
                                                        onClick={() => handleEventClick(event)}
                                                        variant="ghost"
                                                        className="p-2 rounded hover:bg-background-secondary cursor-pointer transition-colors text-left w-full"
                                                    >
                                                        <div className="font-medium text-sm text-text-primary">
                                                            {event.title}
                                                        </div>
                                                        <div className="text-xs text-text-secondary">
                                                            {formatTime(event.startTime)}
                                                            {event.location && ` � ${event.location}`}
                                                        </div>
                                                        {event.user && (
                                                            <div className="text-xs text-text-tertiary mt-1">
                                                                by @{event.user.username}
                                                            </div>
                                                        )}
                                                        <div className="mt-1">
                                                            <Badge
                                                                variant={getBadgeVariant(visibilityMeta.badgeClass)}
                                                                size="sm"
                                                            >
                                                                {visibilityMeta.icon} {visibilityMeta.label}
                                                            </Badge>
                                                        </div>
                                                    </Button>
                                                )
                                            })}
                                        </div>
                                    )
                                })()}
                            </Card>
                        )}

                        <LocationDiscoveryCard />

                        {/* Suggestions */}
                        <Card variant="default" padding="md">
                            <h2 className="font-bold text-lg text-text-primary mb-4">Discover</h2>
                            <div className="space-y-2">
                                <Link to="/" className="block text-sm text-primary-600 hover:underline">
                                    Browse all events
                                </Link>
                                <Link to="/calendar" className="block text-sm text-primary-600 hover:underline">
                                    View calendar
                                </Link>
                            </div>
                        </Card>
                    </div>
                </div>
            </Container>

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
