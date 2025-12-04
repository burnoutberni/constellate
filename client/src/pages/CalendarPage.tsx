import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRealtime, type RealtimeEvent } from '../hooks/useRealtime'
import { Navbar } from '../components/Navbar'
import { useAuth } from '../contexts/AuthContext'
import { Event } from '../types'
import { eventsWithinRange } from '../lib/recurrence'

export function CalendarPage() {
    const [events, setEvents] = useState<Event[]>([])
    const [currentDate, setCurrentDate] = useState(new Date())
    const [view] = useState<'month' | 'week' | 'day'>('month')
    const [loading, setLoading] = useState(true)

    const monthRange = useMemo(() => {
        const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
        const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999)
        return {
            start,
            end,
            startMs: start.getTime(),
            endMs: end.getTime(),
        }
    }, [currentDate])

    const { user, logout } = useAuth();

    // Real-time updates
    const isEventRelevant = useCallback(
        (event: Event) => {
            const eventStartMs = new Date(event.startTime).getTime()
            if (!Number.isNaN(eventStartMs) && eventStartMs >= monthRange.startMs && eventStartMs <= monthRange.endMs) {
                return true
            }
            if (event.recurrencePattern && event.recurrenceEndDate) {
                const recurrenceEndMs = new Date(event.recurrenceEndDate).getTime()
                return !Number.isNaN(recurrenceEndMs) && recurrenceEndMs >= monthRange.startMs
            }
            return false
        },
        [monthRange.startMs, monthRange.endMs]
    )

    const handleRealtimeEvent = useCallback((eventMessage: RealtimeEvent) => {
        if (eventMessage.type === 'event:created') {
            const incoming = eventMessage.data.event
            if (!isEventRelevant(incoming)) {
                return
            }
            setEvents((prev) => {
                const exists = prev.some((evt) => evt.id === incoming.id)
                if (exists) {
                    return prev.map((evt) => (evt.id === incoming.id ? incoming : evt))
                }
                return [...prev, incoming]
            })
        } else if (eventMessage.type === 'event:updated') {
            const updated = eventMessage.data.event
            setEvents((prev) => {
                const exists = prev.some((evt) => evt.id === updated.id)
                if (!exists) {
                    if (!isEventRelevant(updated)) {
                        return prev
                    }
                    return [...prev, updated]
                }
                return prev.map((evt) => (evt.id === updated.id ? updated : evt))
            })
        } else if (eventMessage.type === 'event:deleted') {
            setEvents((prev) => prev.filter((evt) => evt.id !== eventMessage.data.eventId))
        }
    }, [isEventRelevant])

    const { isConnected } = useRealtime({
        onEvent: handleRealtimeEvent,
    })

    // Fetch events
    useEffect(() => {
        const fetchEvents = async () => {
            try {
                setLoading(true)
                const params = new URLSearchParams({
                    limit: '500',
                    rangeStart: monthRange.start.toISOString(),
                    rangeEnd: monthRange.end.toISOString(),
                })
                const response = await fetch(`/api/events?${params.toString()}`)
                const data = await response.json()
                setEvents(data.events || [])
            } catch (error) {
                console.error('Error fetching events:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchEvents()
    }, [monthRange.startMs, monthRange.endMs, view])

    // Calendar helpers
    const monthEvents = useMemo(
        () => eventsWithinRange(events, monthRange.start, monthRange.end),
        [events, monthRange.start, monthRange.end]
    )

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

        return monthEvents.filter((event) => {
            const eventDate = new Date(event.startTime)
            return eventDate >= dayStart && eventDate <= dayEnd
        })
    }

    const upcomingEvents = useMemo(() => {
        const now = new Date()
        const withinRange = eventsWithinRange(events, now, monthRange.end)
        return withinRange
            .filter((event) => new Date(event.startTime) >= now)
            .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    }, [events, monthRange.end])

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
                                {upcomingEvents
                                    .slice(0, 5)
                                    .map((event) => (
                                        <div
                                            key={event.id}
                                            className="flex gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
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
