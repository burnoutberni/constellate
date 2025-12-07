import { Link, useNavigate } from 'react-router-dom'
import { useEvents, useRecommendedEvents } from '../hooks/queries/events'
import { useUIStore } from '../stores'
import { Navbar } from '../components/Navbar'
import { useAuth } from '../contexts/AuthContext'

export function HomePage() {
    const { user, logout } = useAuth()
    const { data, isLoading } = useEvents(100)
    const {
        data: recommendationsData,
        isLoading: recommendationsLoading,
    } = useRecommendedEvents(6, { enabled: Boolean(user) })
    const { calendarCurrentDate, setCalendarDate, sseConnected } = useUIStore()
    const navigate = useNavigate()

    const events = data?.events || []
    const recommendations = recommendationsData?.recommendations || []
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

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
        })
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

    const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentDate)
    const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })


    return (
        <div className="min-h-screen bg-gray-100">
            <Navbar isConnected={sseConnected} user={user} onLogout={logout} />

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 py-6">
                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Left Column - Calendar */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Calendar Header */}
                        <div className="card p-4">
                            <div className="flex items-center justify-between mb-4">
                                <h1 className="text-2xl font-bold text-gray-900">Public Events Calendar</h1>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={goToToday}
                                        className="btn btn-secondary text-sm"
                                    >
                                        Today
                                    </button>
                                    <button
                                        onClick={previousMonth}
                                        className="btn btn-ghost p-2"
                                        aria-label="Previous month"
                                    >
                                        ←
                                    </button>
                                    <span className="px-4 py-2 text-sm font-medium min-w-[200px] text-center">
                                        {monthName}
                                    </span>
                                    <button
                                        onClick={nextMonth}
                                        className="btn btn-ghost p-2"
                                        aria-label="Next month"
                                    >
                                        →
                                    </button>
                                </div>
                            </div>

                            {/* Calendar */}
                            {isLoading ? (
                                <div className="flex items-center justify-center h-96">
                                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent" />
                                </div>
                            ) : (
                                <div>
                                    {/* Day headers */}
                                    <div className="grid grid-cols-7 gap-2 mb-2">
                                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                                            <div
                                                key={day}
                                                className="text-center text-sm font-semibold text-blue-600 py-2"
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
                                                    className={`aspect-square rounded-lg border bg-white p-2 relative overflow-hidden cursor-pointer hover:border-blue-500 transition-colors ${isToday ? 'ring-2 ring-blue-600' : ''}`}
                                                >
                                                    <div className="flex flex-col h-full">
                                                        <div
                                                            className={`text-sm font-semibold mb-1 ${isToday ? 'text-blue-600' : 'text-gray-700'}`}
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
                                                                    className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 truncate cursor-pointer hover:bg-blue-100 transition-colors"
                                                                    title={event.title}
                                                                >
                                                                    {event.title}
                                                                </div>
                                                            ))}
                                                            {dayEvents.length > 3 && (
                                                                <div className="text-xs text-gray-400 px-2">
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

                    {/* Right Column - Today's Events & Sign Up */}
                    <div className="space-y-6">
                        {user && (
                            <div className="card p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-xl font-bold">Recommended for you</h2>
                                    {recommendationsData?.metadata?.generatedAt && (
                                        <span className="text-xs text-gray-500">
                                            Updated {new Date(recommendationsData.metadata.generatedAt).toLocaleTimeString()}
                                        </span>
                                    )}
                                </div>
                                {(() => {
                                    if (recommendationsLoading) {
                                        return (
                                            <div className="flex items-center justify-center py-4">
                                                <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent" />
                                            </div>
                                        )
                                    }
                                    if (recommendations.length === 0) {
                                        return (
                                            <div className="text-center py-6 text-gray-500 text-sm">
                                                Interact with events to train your recommendations.
                                            </div>
                                        )
                                    }
                                    return (
                                        <div className="space-y-3">
                                            {recommendations.map((item) => (
                                                <button
                                                    key={item.event.id}
                                                    type="button"
                                                    onClick={() => handleEventClick(item.event)}
                                                    className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors"
                                                >
                                                    <div className="font-semibold text-gray-900 flex items-center justify-between gap-2">
                                                        <span className="truncate">{item.event.title}</span>
                                                        <span className="text-xs text-gray-500">
                                                            {formatDate(item.event.startTime)}
                                                        </span>
                                                    </div>
                                                    <div className="text-sm text-gray-600">
                                                        {item.event.location || 'Online event'}
                                                    </div>
                                                    {item.reasons.length > 0 && (
                                                        <div className="text-xs text-teal-700 mt-2">
                                                            {item.reasons[0]}
                                                            {item.reasons.length > 1 && (
                                                                <span className="text-gray-500"> · +{item.reasons.length - 1} more</span>
                                                            )}
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
                        <div className="card p-6">
                            <h2 className="text-xl font-bold mb-4">Today's Events</h2>
                            {isLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent" />
                                </div>
                            ) : (() => {
                                if (todayEvents.length === 0) {
                                    return (
                                        <div className="text-center py-8 text-gray-500">
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
                                                className="p-3 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-colors"
                                            >
                                                <div className="font-semibold text-gray-900 mb-1">
                                                    {event.title}
                                                </div>
                                                <div className="text-sm text-gray-600">
                                                    {formatTime(event.startTime)}
                                                    {event.location && ` • ${event.location}`}
                                                </div>
                                                {event.user && (
                                                    <div className="text-xs text-gray-500 mt-1">
                                                        by @{event.user.username}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )
                            })()}
                        </div>

                        {/* Sign Up CTA */}
                        {!user && (
                            <div className="card p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
                                <div className="text-center">
                                    <div className="text-4xl mb-3">✨</div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                                        Join Constellate
                                    </h3>
                                    <p className="text-gray-700 mb-4">
                                        Create events, RSVP, and connect with the federated community
                                    </p>
                                    <Link
                                        to="/login"
                                        className="btn btn-primary w-full"
                                    >
                                        Sign Up Free
                                    </Link>
                                    <p className="text-xs text-gray-600 mt-3">
                                        <Link to="/about" className="text-blue-600 hover:underline">
                                            Learn more about federation
                                        </Link>
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Upcoming Events */}
                        <div className="card p-6">
                            <h2 className="text-xl font-bold mb-4">Upcoming</h2>
                            <div className="space-y-3">
                                {events
                                    .filter((e) => new Date(e.startTime) > new Date())
                                    .slice(0, 5)
                                    .map((event) => (
                                        <div
                                            key={event.id}
                                            onClick={() => handleEventClick(event)}
                                            className="flex gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer transition-colors"
                                        >
                                            <div
                                                className="w-12 h-12 rounded flex items-center justify-center text-white font-bold flex-shrink-0"
                                                style={{ backgroundColor: event.user?.displayColor || '#3b82f6' }}
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
                                {events.filter((e) => new Date(e.startTime) > new Date()).length === 0 && (
                                    <div className="text-center py-4 text-gray-500 text-sm">
                                        No upcoming events
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

