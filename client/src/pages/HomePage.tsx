import { Link, useNavigate } from 'react-router-dom'
import { useEvents, useRecommendedEvents, useTrendingEvents, usePlatformStats } from '../hooks/queries/events'
import { useUIStore } from '../stores'
import { Navbar } from '../components/Navbar'
import { useAuth } from '../contexts/AuthContext'
import { HomeHero } from '../components/HomeHero'
import { EventStats } from '../components/EventStats'
import { EventCard } from '../components/EventCard'
import { Container } from '../components/layout/Container'
import { Section } from '../components/layout/Section'
import { Button } from '../components/ui/Button'
import { primaryColors } from '../design-system/tokens'
import { formatTime, formatRelativeDate } from '../lib/formatUtils'

export function HomePage() {
    const { user, logout } = useAuth()
    const { data, isLoading } = useEvents(100)
    const {
        data: recommendationsData,
        isLoading: recommendationsLoading,
    } = useRecommendedEvents(6, { enabled: Boolean(user) })
    const {
        data: trendingData,
        isLoading: trendingLoading,
    } = useTrendingEvents(6, 7)
    const { data: statsData, isLoading: statsLoading } = usePlatformStats()
    const { calendarCurrentDate, setCalendarDate, sseConnected } = useUIStore()
    const navigate = useNavigate()

    const events = data?.events || []
    const currentDate = calendarCurrentDate

    // Get today's events
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    const todayEvents = events.filter((event) => {
        const eventDate = new Date(event.startTime)
        return eventDate >= todayStart && eventDate <= todayEnd
    })

    // Calendar helpers
    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear()
        const month = date.getMonth()
        const firstDay = new Date(year, month, 1)
        const lastDay = new Date(year, month + 1, 0)
        const daysInMonth = lastDay.getDate()
        const startingDayOfWeek = firstDay.getDay()

        return { daysInMonth, startingDayOfWeek, year, month }
    }

    const getEventsForDay = (day: number) => {
        const { year, month } = getDaysInMonth(currentDate)
        const dayDate = new Date(year, month, day)
        const dayStart = new Date(dayDate.setHours(0, 0, 0, 0))
        const dayEnd = new Date(dayDate.setHours(23, 59, 59, 999))

        return events.filter((event) => {
            const eventDate = new Date(event.startTime)
            return eventDate >= dayStart && eventDate <= dayEnd
        })
    }

    const previousMonth = () => {
        setCalendarDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
    }

    const nextMonth = () => {
        setCalendarDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
    }

    const goToToday = () => {
        setCalendarDate(new Date())
    }

    const handleEventClick = (event: typeof events[0]) => {
        if (event.user?.username) {
            navigate(`/@${event.user.username}/${event.id}`)
        }
    }

    // formatTime and formatRelativeDate are now imported from formatUtils

    const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentDate)
    const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

    // Get featured/trending events
    const trendingEvents = trendingData?.events || []
    const recommendations = recommendationsData?.recommendations || []

    // Use platform statistics from backend (accurate counts)
    // Fall back to client-side calculation if stats are not available
    const totalEvents = statsData?.totalEvents ?? events.length
    const upcomingEvents = statsData?.upcomingEvents ?? events.filter((e) => new Date(e.startTime) > new Date()).length
    const todayEventsCount = statsData?.todayEvents ?? todayEvents.length

    return (
        <div className="min-h-screen bg-background-primary">
            <Navbar isConnected={sseConnected} user={user} onLogout={logout} />

            {/* Hero Section */}
            <HomeHero isAuthenticated={Boolean(user)} />

            {/* Trending/Featured Events Section */}
            {!user && trendingEvents.length > 0 && (
                <Section variant="default" padding="lg">
                    <Container>
                        <div className="space-y-6">
                            <div className="text-center space-y-2">
                                <h2 className="text-3xl font-bold text-text-primary">
                                    🔥 Trending Events
                                </h2>
                                <p className="text-text-secondary">
                                    Popular events happening soon in the network
                                </p>
                            </div>
                            
                            {trendingLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent" />
                                </div>
                            ) : (
                                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {trendingEvents.slice(0, 6).map((event) => (
                                        <EventCard 
                                            key={event.id} 
                                            event={event}
                                            isAuthenticated={Boolean(user)}
                                        />
                                    ))}
                                </div>
                            )}

                            <div className="text-center pt-4">
                                <Link to="/search">
                                    <Button variant="primary" size="lg">
                                        Browse All Events
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </Container>
                </Section>
            )}

            {/* Recommendations for authenticated users */}
            {user && recommendations.length > 0 && (
                <Section variant="muted" padding="lg">
                    <Container>
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-3xl font-bold text-text-primary">
                                    ✨ Recommended for You
                                </h2>
                                {recommendationsData?.metadata?.generatedAt && (
                                    <span className="text-sm text-text-secondary">
                                        Updated {new Date(recommendationsData.metadata.generatedAt).toLocaleTimeString()}
                                    </span>
                                )}
                            </div>
                            
                            {recommendationsLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent" />
                                </div>
                            ) : (
                                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {recommendations.slice(0, 6).map((item) => (
                                        <EventCard 
                                            key={item.event.id} 
                                            event={item.event}
                                            isAuthenticated={Boolean(user)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </Container>
                </Section>
            )}

            {/* Main Content - Calendar and Sidebar */}
            <Section variant="default" padding="lg">
                <Container size="xl">
                    <div className="grid lg:grid-cols-3 gap-6">
                        {/* Left Column - Calendar */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Calendar Header */}
                            <div className="card p-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-2xl font-bold text-text-primary">Public Events Calendar</h2>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            onClick={goToToday}
                                            variant="secondary"
                                            size="sm"
                                        >
                                            Today
                                        </Button>
                                        <Button
                                            onClick={previousMonth}
                                            variant="ghost"
                                            size="sm"
                                            aria-label="Previous month"
                                        >
                                            ←
                                        </Button>
                                        <span className="px-4 py-2 text-sm font-medium min-w-[200px] text-center text-text-primary">
                                            {monthName}
                                        </span>
                                        <Button
                                            onClick={nextMonth}
                                            variant="ghost"
                                            size="sm"
                                            aria-label="Next month"
                                        >
                                            →
                                        </Button>
                                    </div>
                                </div>

                                {/* Calendar */}
                                {isLoading ? (
                                    <div className="flex items-center justify-center h-96">
                                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent" />
                                    </div>
                                ) : (
                                    <div>
                                        {/* Day headers */}
                                        <div className="grid grid-cols-7 gap-2 mb-2">
                                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                                                <div
                                                    key={day}
                                                    className="text-center text-sm font-semibold text-primary-600 dark:text-primary-400 py-2"
                                                >
                                                    {day}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Calendar days */}
                                        <div className="grid grid-cols-7 gap-2">
                                            {/* Empty cells for days before month starts */}
                                            {Array.from({ length: startingDayOfWeek }).map((_, i) => (
                                                <div key={`empty-${i}`} className="aspect-square" />
                                            ))}

                                            {/* Days of the month */}
                                            {Array.from({ length: daysInMonth }).map((_, i) => {
                                                const day = i + 1
                                                const dayEvents = getEventsForDay(day)
                                                const isToday =
                                                    new Date().toDateString() ===
                                                    new Date(
                                                        currentDate.getFullYear(),
                                                        currentDate.getMonth(),
                                                        day
                                                    ).toDateString()

                                                return (
                                                    <div
                                                        key={day}
                                                        className={`aspect-square rounded-lg border border-border-default bg-background-primary p-2 relative overflow-hidden cursor-pointer hover:border-primary-500 transition-colors ${isToday ? 'ring-2 ring-primary-600' : ''}`}
                                                    >
                                                        <div className="flex flex-col h-full">
                                                            <div
                                                                className={`text-sm font-semibold mb-1 ${isToday ? 'text-primary-600 dark:text-primary-400' : 'text-text-primary'}`}
                                                            >
                                                                {day}
                                                            </div>
                                                            <div className="flex-1 overflow-y-auto space-y-1">
                                                                {dayEvents.slice(0, 3).map((event) => (
                                                                    <div
                                                                        key={event.id}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            handleEventClick(event)
                                                                        }}
                                                                        className="text-xs px-2 py-1 rounded bg-primary-50 text-primary-700 truncate cursor-pointer hover:bg-primary-100 transition-colors dark:bg-primary-900/20 dark:text-primary-300"
                                                                        title={event.title}
                                                                    >
                                                                        {event.title}
                                                                    </div>
                                                                ))}
                                                                {dayEvents.length > 3 && (
                                                                    <div className="text-xs text-text-tertiary px-2">
                                                                        +{dayEvents.length - 3} more
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Column - Stats & Events */}
                        <div className="space-y-6">
                            {/* Event Statistics */}
                            <EventStats
                                totalEvents={totalEvents}
                                upcomingEvents={upcomingEvents}
                                todayEvents={todayEventsCount}
                                isLoading={isLoading || statsLoading}
                            />
                            {/* Today's Events */}
                            <div className="card p-6">
                                <h2 className="text-xl font-bold text-text-primary mb-4">Today's Events</h2>
                                {isLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-600 border-t-transparent" />
                                    </div>
                                ) : (() => {
                                    if (todayEvents.length === 0) {
                                        return (
                                            <div className="text-center py-8 text-text-secondary">
                                                <p className="mb-2">No events today</p>
                                                <p className="text-sm">Check back tomorrow!</p>
                                            </div>
                                        )
                                    }
                                    return (
                                        <div className="space-y-3">
                                            {todayEvents.map((event) => (
                                                <div
                                                    key={event.id}
                                                    onClick={() => handleEventClick(event)}
                                                    className="p-3 rounded-lg border border-border-default hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 cursor-pointer transition-colors"
                                                >
                                                    <div className="font-semibold text-text-primary mb-1">
                                                        {event.title}
                                                    </div>
                                                    <div className="text-sm text-text-secondary">
                                                        {formatTime(event.startTime)}
                                                        {event.location && ` • ${event.location}`}
                                                    </div>
                                                    {event.user && (
                                                        <div className="text-xs text-text-tertiary mt-1">
                                                            by @{event.user.username}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )
                                })()}
                            </div>

                            {/* Sign Up CTA for unauthenticated users */}
                            {!user && (
                                <div className="card p-6 bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 border-2 border-primary-200 dark:border-primary-800">
                                    <div className="text-center">
                                        <div className="text-4xl mb-3">✨</div>
                                        <h3 className="text-xl font-bold text-text-primary mb-2">
                                            Join Constellate
                                        </h3>
                                        <p className="text-text-secondary mb-4">
                                            Create events, RSVP, and connect with the federated community
                                        </p>
                                        <Link to="/login">
                                            <Button variant="primary" size="md" fullWidth>
                                                Sign Up Free
                                            </Button>
                                        </Link>
                                        <p className="text-xs text-text-secondary mt-3">
                                            <Link to="/about" className="text-primary-600 dark:text-primary-400 hover:underline">
                                                Learn more about federation
                                            </Link>
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Upcoming Events */}
                            <div className="card p-6">
                                <h2 className="text-xl font-bold text-text-primary mb-4">Upcoming</h2>
                                <div className="space-y-3">
                                    {events
                                        .filter((e) => new Date(e.startTime) > new Date())
                                        .slice(0, 5)
                                        .map((event) => (
                                            <div
                                                key={event.id}
                                                onClick={() => handleEventClick(event)}
                                                className="flex gap-3 p-2 rounded hover:bg-background-secondary cursor-pointer transition-colors"
                                            >
                                                <div
                                                    className="w-12 h-12 rounded flex items-center justify-center text-white font-bold flex-shrink-0"
                                                    style={{ backgroundColor: event.user?.displayColor || primaryColors[600] }}
                                                >
                                                    {new Date(event.startTime).getDate()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-sm text-text-primary truncate">
                                                        {event.title}
                                                    </div>
                                                    <div className="text-xs text-text-secondary">
                                                        {formatRelativeDate(event.startTime)}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    {events.filter((e) => new Date(e.startTime) > new Date()).length === 0 && (
                                        <div className="text-center py-4 text-text-secondary text-sm">
                                            No upcoming events
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </Container>
            </Section>
        </div>
    )
}

