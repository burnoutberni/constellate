import { useState, useEffect } from 'react'
import { useRealtime } from '../hooks/useRealtime'
import { Navbar } from '../components/Navbar'
import { useAuth } from '../contexts/AuthContext'

interface Event {
    id: string
    title: string
    summary?: string
    location?: string
    startTime: string
    endTime?: string
    user: {
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

export function CalendarPage() {
    const [events, setEvents] = useState<Event[]>([])
    const [currentDate, setCurrentDate] = useState(new Date())
    const [view] = useState<'month' | 'week' | 'day'>('month')
    const [loading, setLoading] = useState(true)

    const { user, logout } = useAuth();

    // Real-time updates
    const { isConnected } = useRealtime({
        onEvent: (event) => {
            if (event.type === 'event:created') {
                setEvents((prev) => [...prev, event.data.event])
            } else if (event.type === 'event:updated') {
                setEvents((prev) =>
                    prev.map((e) => (e.id === event.data.event.id ? event.data.event : e))
                )
            } else if (event.type === 'event:deleted') {
                setEvents((prev) => prev.filter((e) => e.id !== event.data.eventId))
            }
        },
    })

    // Fetch events
    useEffect(() => {
        fetchEvents()
    }, [currentDate, view])

    const fetchEvents = async () => {
        try {
            setLoading(true)
            const response = await fetch('/api/events?limit=100')
            const data = await response.json()
            setEvents(data.events || [])
        } catch (error) {
            console.error('Error fetching events:', error)
        } finally {
            setLoading(false)
        }
    }

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
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
    }

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
    }

    const today = () => {
        setCurrentDate(new Date())
    }

    const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentDate)
    const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

    return (
        <div className="min-h-screen bg-gray-100">
            <Navbar isConnected={isConnected} user={user} onLogout={logout} />
            {/* Calendar Controls */}
            <div className="max-w-6xl mx-auto px-4 py-4 flex justify-end gap-2">
                <button
                    onClick={today}
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

            {/* Main Content */}
            <div className="max-w-6xl mx-auto px-4 py-6">
                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Calendar Card */}
                    <div className="lg:col-span-2">
                        <div className="card p-6">
                            {/* Day headers */}
                            <div className="grid grid-cols-7 gap-2 mb-4">
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
                            {loading ? (
                                <div className="flex items-center justify-center h-96">
                                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent" />
                                </div>
                            ) : (
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
                                                className={`aspect-square rounded-lg border bg-white p-2 relative overflow-hidden ${isToday ? 'ring-2 ring-blue-600' : ''}`}
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
                            )}
                        </div>
                    </div>

                    {/* Upcoming Events Sidebar */}
                    <div className="space-y-4">
                        <div className="card p-6">
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
                                                    {new Date(event.startTime).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        hour: 'numeric',
                                                        minute: '2-digit',
                                                    })}
                                                </div>
                                                {event.location && (
                                                    <div className="text-xs text-gray-400 mt-1">📍 {event.location}</div>
                                                )}
                                                {event._count && (
                                                    <div className="text-xs text-gray-400 mt-1">
                                                        👥 {event._count.attendance} · ❤️ {event._count.likes}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
