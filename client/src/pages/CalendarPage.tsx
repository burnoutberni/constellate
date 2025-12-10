import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRealtime, type RealtimeEvent } from '../hooks/useRealtime'
import { Navbar } from '../components/Navbar'
import { useAuth } from '../contexts/AuthContext'
import { Event } from '../types'
import { eventsWithinRange } from '../lib/recurrence'
import { CalendarView } from '../components/CalendarView'

export function CalendarPage() {
    const [events, setEvents] = useState<Event[]>([])
    const [currentDate, setCurrentDate] = useState(new Date())
    const [view, setView] = useState<'month' | 'week' | 'day'>('month')
    const [loading, setLoading] = useState(true)
    const [exportingEventId, setExportingEventId] = useState<string | null>(null)

    const dateRange = useMemo(() => {
        let start: Date, end: Date
        
        if (view === 'month') {
            start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
            end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999)
        } else if (view === 'week') {
            const weekStartDate = currentDate.getDate() - currentDate.getDay()
            start = new Date(currentDate.getFullYear(), currentDate.getMonth(), weekStartDate, 0, 0, 0, 0)
            end = new Date(currentDate.getFullYear(), currentDate.getMonth(), weekStartDate + 6, 23, 59, 59, 999)
        } else {
            start = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 0, 0, 0, 0)
            end = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 23, 59, 59, 999)
        }
        
        return {
            start,
            end,
            startMs: start.getTime(),
            endMs: end.getTime(),
        }
    }, [currentDate, view])

    const { user, logout } = useAuth();

    // Real-time updates
    const isEventRelevant = useCallback(
        (event: Event) => {
            const eventStartMs = new Date(event.startTime).getTime()
            if (!Number.isNaN(eventStartMs) && eventStartMs >= dateRange.startMs && eventStartMs <= dateRange.endMs) {
                return true
            }
            if (event.recurrencePattern && event.recurrenceEndDate) {
                const recurrenceEndMs = new Date(event.recurrenceEndDate).getTime()
                return !Number.isNaN(recurrenceEndMs) && 
                       !Number.isNaN(eventStartMs) &&
                       eventStartMs <= dateRange.endMs && 
                       recurrenceEndMs >= dateRange.startMs
            }
            return false
        },
        [dateRange.startMs, dateRange.endMs]
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
                    rangeStart: dateRange.start.toISOString(),
                    rangeEnd: dateRange.end.toISOString(),
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
    }, [dateRange.startMs, dateRange.endMs, view])

    // Calendar helpers
    const rangeEvents = useMemo(
        () => eventsWithinRange(events, dateRange.start, dateRange.end),
        [events, dateRange.startMs, dateRange.endMs]
    )

    const upcomingEvents = useMemo(() => {
        const now = new Date()
        const withinRange = eventsWithinRange(events, now, dateRange.end)
        return withinRange
            .filter((event) => new Date(event.startTime) >= now)
            .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    }, [events, dateRange.endMs])

    const navigatePrevious = () => {
        if (view === 'month') {
            setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
        } else if (view === 'week') {
            const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 7)
            setCurrentDate(newDate)
        } else {
            const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 1)
            setCurrentDate(newDate)
        }
    }

    const navigateNext = () => {
        if (view === 'month') {
            setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
        } else if (view === 'week') {
            const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 7)
            setCurrentDate(newDate)
        } else {
            const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1)
            setCurrentDate(newDate)
        }
    }

    const goToToday = () => {
        setCurrentDate(new Date())
    }

    const getDisplayText = () => {
        if (view === 'month') {
            return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        } else if (view === 'week') {
            const { start: startOfWeek, end: endOfWeek } = dateRange
            
            if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
                return `${startOfWeek.toLocaleDateString('en-US', { month: 'long' })} ${startOfWeek.getDate()} - ${endOfWeek.getDate()}, ${startOfWeek.getFullYear()}`
            } else {
                return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${endOfWeek.getFullYear()}`
            }
        } else {
            return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
        }
    }

    const handleAddToGoogleCalendar = useCallback(async (eventId: string) => {
        try {
            setExportingEventId(eventId)
            const response = await fetch(`/api/calendar/${eventId}/export/google`)
            if (!response.ok) {
                throw new Error('Failed to generate Google Calendar link')
            }
            const data = await response.json()
            if (data?.url) {
                window.open(data.url, '_blank', 'noopener,noreferrer')
            } else {
                throw new Error('No URL returned from server')
            }
        } catch (error) {
            console.error('Unable to add event to Google Calendar', error)
            alert('Failed to add event to Google Calendar. Please try again.')
        } finally {
            setExportingEventId(null)
        }
    }, [])

    return (
        <div className="min-h-screen bg-gray-100">
            <Navbar isConnected={isConnected} user={user} onLogout={logout} />
            {/* Calendar Controls */}
            <div className="max-w-6xl mx-auto px-4 py-4">
                <div className="flex justify-between items-center gap-4">
                    {/* View Switcher */}
                    <div className="flex gap-1 bg-white rounded-lg p-1 border" role="group" aria-label="Calendar view options">
                        <button
                            onClick={() => setView('month')}
                            aria-pressed={view === 'month'}
                            aria-label="Month view"
                            className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                                view === 'month'
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            Month
                        </button>
                        <button
                            onClick={() => setView('week')}
                            aria-pressed={view === 'week'}
                            aria-label="Week view"
                            className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                                view === 'week'
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            Week
                        </button>
                        <button
                            onClick={() => setView('day')}
                            aria-pressed={view === 'day'}
                            aria-label="Day view"
                            className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                                view === 'day'
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            Day
                        </button>
                    </div>

                    {/* Navigation Controls */}
                    <div className="flex gap-2 items-center">
                        <button
                            onClick={goToToday}
                            className="btn btn-secondary text-sm"
                        >
                            Today
                        </button>
                        <button
                            onClick={navigatePrevious}
                            className="btn btn-ghost p-2"
                            aria-label={`Previous ${view}`}
                        >
                            ←
                        </button>
                        <span className="px-4 py-2 text-sm font-medium min-w-[280px] text-center">
                            {getDisplayText()}
                        </span>
                        <button
                            onClick={navigateNext}
                            className="btn btn-ghost p-2"
                            aria-label={`Next ${view}`}
                        >
                            →
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-6xl mx-auto px-4 py-6">
                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Calendar Card */}
                    <div className="lg:col-span-2">
                        <div className="card p-6">
                            <CalendarView
                                view={view}
                                currentDate={currentDate}
                                events={rangeEvents}
                                loading={loading}
                            />
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
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); handleAddToGoogleCalendar(event.id); }}
                                                    className="btn btn-xs btn-outline mt-2"
                                                    aria-label={`Add ${event.title} to Google Calendar`}
                                                    disabled={exportingEventId === event.id}
                                                >
                                                    {exportingEventId === event.id ? 'Preparing...' : 'Add to Google Calendar'}
                                                </button>
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
