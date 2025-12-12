import React, { useMemo } from 'react'
import type { Event } from '@/types'
import { Button, Spinner } from './ui'

interface CalendarViewProps {
    view: 'month' | 'week' | 'day'
    currentDate: Date
    events: Event[]
    loading: boolean
    userAttendingEventIds?: Set<string>
    onEventClick?: (event: Event, position: { x: number; y: number }) => void
    onEventHover?: (event: Event | null) => void
}

function formatHourLabel(hour: number): string {
    if (hour === 0) {
return '12 AM'
}
    if (hour < 12) {
return `${hour} AM`
}
    if (hour === 12) {
return '12 PM'
}
    return `${hour - 12} PM`
}

/**
 * Shared event click handler for all calendar views
 */
function createEventClickHandler(
    onEventClick?: (event: Event, position: { x: number; y: number }) => void,
) {
    return (event: Event, e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation()
        if (onEventClick) {
            const rect = e.currentTarget.getBoundingClientRect()
            onEventClick(event, {
                x: rect.left + rect.width / 2,
                y: rect.bottom + 5,
            })
        }
    }
}

export function CalendarView({
    view,
    currentDate,
    events,
    loading,
    userAttendingEventIds,
    onEventClick,
    onEventHover,
}: CalendarViewProps) {
    if (view === 'month') {
        return <MonthView
            currentDate={currentDate}
            events={events}
            loading={loading}
            userAttendingEventIds={userAttendingEventIds}
            onEventClick={onEventClick}
            onEventHover={onEventHover}
        />
    } if (view === 'week') {
        return <WeekView
            currentDate={currentDate}
            events={events}
            loading={loading}
            userAttendingEventIds={userAttendingEventIds}
            onEventClick={onEventClick}
            onEventHover={onEventHover}
        />
    }
        return <DayView
            currentDate={currentDate}
            events={events}
            loading={loading}
            userAttendingEventIds={userAttendingEventIds}
            onEventClick={onEventClick}
            onEventHover={onEventHover}
        />
}

interface ViewProps {
    currentDate: Date
    events: Event[]
    loading: boolean
    userAttendingEventIds?: Set<string>
    onEventClick?: (event: Event, position: { x: number; y: number }) => void
    onEventHover?: (event: Event | null) => void
}

interface EventButtonProps {
    event: Event
    isAttending: boolean
    onEventClick: (event: Event, e: React.MouseEvent<HTMLButtonElement>) => void
    onEventHover?: (event: Event | null) => void
    title?: string
    className?: string
}

function MonthEventButton({ event, isAttending, onEventClick, onEventHover, title }: EventButtonProps) {
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => onEventClick(event, e)
    const handleMouseEnter = () => onEventHover?.(event)
    const handleMouseLeave = () => onEventHover?.(null)

    return (
        <Button
            key={event.id}
            variant="ghost"
            size="sm"
            className={`text-xs px-2 py-1 rounded truncate w-full justify-start transition-colors ${
                isAttending
                    ? 'bg-primary-100 text-primary-800 hover:bg-primary-200 ring-1 ring-primary-500'
                    : 'bg-info-50 text-info-700 hover:bg-info-100'
            }`}
            title={title || event.title}
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {event.title}
        </Button>
    )
}

function MonthView({ currentDate, events, loading, userAttendingEventIds, onEventClick, onEventHover }: ViewProps) {
    const handleEventClick = createEventClickHandler(onEventClick)

    const monthMetadata = useMemo(() => {
        const year = currentDate.getFullYear()
        const month = currentDate.getMonth()
        const firstDay = new Date(year, month, 1)
        const lastDay = new Date(year, month + 1, 0)
        const daysInMonth = lastDay.getDate()
        const startingDayOfWeek = firstDay.getDay()

        return { daysInMonth, startingDayOfWeek, year, month }
    }, [currentDate])

    const eventsByDay = useMemo(() => {
        const map = new Map<number, Event[]>()
        const { year, month, daysInMonth } = monthMetadata

        for (let day = 1; day <= daysInMonth; day++) {
            const dayStart = new Date(year, month, day, 0, 0, 0, 0)
            const dayEnd = new Date(year, month, day, 23, 59, 59, 999)

            const filtered = events.filter((event) => {
                const eventDate = new Date(event.startTime)
                return eventDate >= dayStart && eventDate <= dayEnd
            })
            map.set(day, filtered)
        }
        return map
    }, [events, monthMetadata])

    const { daysInMonth, startingDayOfWeek, year, month } = monthMetadata

    return (
        <div>
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-2 mb-4">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div
                        key={day}
                        className="text-center text-sm font-semibold text-info-600 py-2"
                    >
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar days */}
            {loading ? (
                <div className="flex items-center justify-center h-96">
                    <Spinner size="lg" />
                </div>
            ) : (
                <div className="grid grid-cols-7 gap-2">
                    {/* Empty cells for days before month starts */}
                    {Array.from({ length: startingDayOfWeek }).map((_, i) => {
                        const prevMonth = month === 0 ? 11 : month - 1
                        const prevYear = month === 0 ? year - 1 : year
                        const lastDayOfPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate()
                        const dayNumber = lastDayOfPrevMonth - startingDayOfWeek + i + 1
                        return <div key={`empty-${prevYear}-${prevMonth}-${dayNumber}`} className="aspect-square" />
                    })}

                    {/* Days of the month */}
                    {(() => {
                        const today = new Date()
                        const todayStr = today.toDateString()

                        return Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1
                            const dayEvents = eventsByDay.get(day) || []
                            const dayDate = new Date(
                                currentDate.getFullYear(),
                                currentDate.getMonth(),
                                day,
                            )
                            const isToday = dayDate.toDateString() === todayStr

                            return (
                                <div
                                    key={day}
                                    className={`aspect-square rounded-lg border bg-white p-2 relative overflow-hidden ${isToday ? 'ring-2 ring-info-600' : ''}`}
                                >
                                    <div className="flex flex-col h-full">
                                        <div
                                            className={`text-sm font-semibold mb-1 ${isToday ? 'text-info-600' : 'text-neutral-700'}`}
                                        >
                                            {day}
                                        </div>
                                        <div className="flex-1 overflow-y-auto space-y-1">
                                            {dayEvents.slice(0, 3).map((event) => (
                                                <MonthEventButton
                                                    key={event.id}
                                                    event={event}
                                                    isAttending={userAttendingEventIds?.has(event.id) ?? false}
                                                    onEventClick={handleEventClick}
                                                    onEventHover={onEventHover}
                                                />
                                            ))}
                                            {dayEvents.length > 3 && (
                                                <div className="text-xs text-neutral-400 px-2">
                                                    +{dayEvents.length - 3} more
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })
                    })()}
                </div>
            )}
        </div>
    )
}

function WeekEventButton({ event, isAttending, onEventClick, onEventHover, title }: EventButtonProps) {
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => onEventClick(event, e)
    const handleMouseEnter = () => onEventHover?.(event)
    const handleMouseLeave = () => onEventHover?.(null)

    return (
        <Button
            key={event.id}
            variant="ghost"
            size="sm"
            className={`text-xs px-2 py-1 mb-1 rounded truncate w-full justify-start transition-colors ${
                isAttending
                    ? 'bg-primary-100 text-primary-800 hover:bg-primary-200 ring-1 ring-primary-500'
                    : 'bg-info-50 text-info-700 hover:bg-info-100'
            }`}
            title={title || event.title}
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <div className="font-medium">{event.title}</div>
            <div className="text-[10px] text-neutral-600">
                {new Date(event.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </div>
        </Button>
    )
}

function WeekView({ currentDate, events, loading, userAttendingEventIds, onEventClick, onEventHover }: ViewProps) {
    const handleEventClick = createEventClickHandler(onEventClick)

    const weekDays = useMemo(() => {
        const dayOfWeek = currentDate.getDay()
        const startOfWeek = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth(),
            currentDate.getDate() - dayOfWeek,
            0, 0, 0, 0,
        )

        const days = []
        for (let i = 0; i < 7; i++) {
            const day = new Date(
                startOfWeek.getFullYear(),
                startOfWeek.getMonth(),
                startOfWeek.getDate() + i,
                0, 0, 0, 0,
            )
            days.push(day)
        }
        return days
    }, [currentDate])

    const hours = useMemo(() => Array.from({ length: 13 }, (_, i) => i + 7), []) // 7 AM to 7 PM

    const eventsByDayAndHour = useMemo(() => {
        const map = new Map<string, Event[]>()

        for (const day of weekDays) {
            for (const hour of hours) {
                const key = `${day.toISOString()}-${hour}`
                const hourStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0, 0)
                const hourEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 59, 59, 999)

                const filtered = events.filter((event) => {
                    const eventDate = new Date(event.startTime)
                    return eventDate >= hourStart && eventDate <= hourEnd
                })
                map.set(key, filtered)
            }
        }
        return map
    }, [events, weekDays, hours])

    const today = new Date()

    return (
        <div className="overflow-x-auto">
            {loading ? (
                <div className="flex items-center justify-center h-96">
                    <Spinner size="lg" />
                </div>
            ) : (
                <div className="min-w-[800px]">
                    {/* Day headers */}
                    <div className="grid grid-cols-8 gap-2 mb-2 sticky top-0 bg-white z-10">
                        <div className="text-sm font-semibold text-neutral-600 py-2" />
                        {weekDays.map((day) => {
                            const isToday = day.toDateString() === today.toDateString()
                            return (
                                <div
                                    key={day.toISOString()}
                                    className={`text-center text-sm font-semibold py-2 rounded ${
                                        isToday ? 'bg-info-600 text-white' : 'text-neutral-700'
                                    }`}
                                >
                                    <div className="text-xs uppercase">
                                        {day.toLocaleDateString('en-US', { weekday: 'short' })}
                                    </div>
                                    <div className="text-lg">{day.getDate()}</div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Time slots */}
                    {hours.map((hour) => (
                        <div key={hour} className="grid grid-cols-8 gap-2 mb-1">
                            <div className="text-xs text-neutral-500 py-2 text-right pr-2">
                                {formatHourLabel(hour)}
                            </div>
                            {weekDays.map((day) => {
                                const dayEvents = eventsByDayAndHour.get(`${day.toISOString()}-${hour}`) || []
                                return (
                                    <div
                                        key={`${day.toISOString()}-${hour}`}
                                        className="min-h-[60px] border rounded bg-white p-1"
                                    >
                                        {dayEvents.map((event) => (
                                            <WeekEventButton
                                                key={event.id}
                                                event={event}
                                                isAttending={userAttendingEventIds?.has(event.id) ?? false}
                                                onEventClick={handleEventClick}
                                                onEventHover={onEventHover}
                                                title={`${event.title} - ${new Date(event.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
                                            />
                                        ))}
                                    </div>
                                )
                            })}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function DayEventButton({ event, isAttending, onEventClick, onEventHover }: EventButtonProps) {
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => onEventClick(event, e)
    const handleMouseEnter = () => onEventHover?.(event)
    const handleMouseLeave = () => onEventHover?.(null)

    return (
        <Button
            key={event.id}
            variant="ghost"
            className={`p-3 rounded border w-full justify-start transition-colors ${
                isAttending
                    ? 'bg-primary-50 border-primary-300 hover:bg-primary-100'
                    : 'bg-info-50 border-info-100 hover:bg-info-100'
            }`}
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <div className="font-medium text-info-900">{event.title}</div>
            <div className="text-sm text-neutral-600 mt-1">
                {new Date(event.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                {event.endTime && ` - ${new Date(event.endTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
            </div>
            {event.location && (
                <div className="text-sm text-neutral-500 mt-1">📍 {event.location}</div>
            )}
            {event.summary && (
                <div className="text-sm text-neutral-600 mt-2">{event.summary}</div>
            )}
        </Button>
    )
}

function DayView({ currentDate, events, loading, userAttendingEventIds, onEventClick, onEventHover }: ViewProps) {
    const handleEventClick = createEventClickHandler(onEventClick)

    const hours = useMemo(() => Array.from({ length: 13 }, (_, i) => i + 7), []) // 7 AM to 7 PM

    const eventsByHour = useMemo(() => {
        const map = new Map<number, Event[]>()

        for (const hour of hours) {
            const hourStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), hour, 0, 0, 0)
            const hourEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), hour, 59, 59, 999)

            const filtered = events.filter((event) => {
                const eventDate = new Date(event.startTime)
                return eventDate >= hourStart && eventDate <= hourEnd
            })
            map.set(hour, filtered)
        }
        return map
    }, [events, currentDate, hours])

    const today = new Date()
    const isToday = currentDate.toDateString() === today.toDateString()

    return (
        <div>
            {loading ? (
                <div className="flex items-center justify-center h-96">
                    <Spinner size="lg" />
                </div>
            ) : (
                <div>
                    {/* Day header */}
                    <div className={`text-center text-lg font-semibold py-4 mb-4 rounded ${
                        isToday ? 'bg-info-600 text-white' : 'bg-neutral-100 text-neutral-700'
                    }`}>
                        <div className="text-sm uppercase">
                            {currentDate.toLocaleDateString('en-US', { weekday: 'long' })}
                        </div>
                        <div className="text-2xl">
                            {currentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </div>
                    </div>

                    {/* Time slots */}
                    <div className="space-y-2">
                        {hours.map((hour) => {
                            const hourEvents = eventsByHour.get(hour) || []
                            return (
                                <div key={hour} className="flex gap-4">
                                    <div className="w-20 text-sm text-neutral-500 py-2 text-right flex-shrink-0">
                                        {formatHourLabel(hour)}
                                    </div>
                                    <div className="flex-1 min-h-[80px] border rounded bg-white p-3">
                                        {hourEvents.length === 0 ? (
                                            <div className="text-neutral-300 text-sm">No events</div>
                                        ) : (
                                            <div className="space-y-2">
                                                {hourEvents.map((event) => (
                                                    <DayEventButton
                                                        key={event.id}
                                                        event={event}
                                                        isAttending={userAttendingEventIds?.has(event.id) ?? false}
                                                        onEventClick={handleEventClick}
                                                        onEventHover={onEventHover}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
