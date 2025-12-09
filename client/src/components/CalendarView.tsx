import { Event } from '../types'

interface CalendarViewProps {
    view: 'month' | 'week' | 'day'
    currentDate: Date
    events: Event[]
    loading: boolean
}

export function CalendarView({ view, currentDate, events, loading }: CalendarViewProps) {
    if (view === 'month') {
        return <MonthView currentDate={currentDate} events={events} loading={loading} />
    } else if (view === 'week') {
        return <WeekView currentDate={currentDate} events={events} loading={loading} />
    } else {
        return <DayView currentDate={currentDate} events={events} loading={loading} />
    }
}

interface ViewProps {
    currentDate: Date
    events: Event[]
    loading: boolean
}

function MonthView({ currentDate, events, loading }: ViewProps) {
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
        const dayStart = new Date(year, month, day, 0, 0, 0, 0)
        const dayEnd = new Date(year, month, day, 23, 59, 59, 999)

        return events.filter((event) => {
            const eventDate = new Date(event.startTime)
            return eventDate >= dayStart && eventDate <= dayEnd
        })
    }

    const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentDate)

    return (
        <div>
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
    )
}

function WeekView({ currentDate, events, loading }: ViewProps) {
    const getWeekDays = () => {
        const startOfWeek = new Date(currentDate)
        startOfWeek.setDate(currentDate.getDate() - currentDate.getDay())
        startOfWeek.setHours(0, 0, 0, 0)

        const days = []
        for (let i = 0; i < 7; i++) {
            const day = new Date(startOfWeek)
            day.setDate(startOfWeek.getDate() + i)
            days.push(day)
        }
        return days
    }

    const hours = Array.from({ length: 13 }, (_, i) => i + 7) // 7 AM to 7 PM

    const getEventsForDayAndHour = (day: Date, hour: number) => {
        const hourStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0, 0)
        const hourEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 59, 59, 999)

        return events.filter((event) => {
            const eventDate = new Date(event.startTime)
            return eventDate >= hourStart && eventDate <= hourEnd
        })
    }

    const weekDays = getWeekDays()
    const today = new Date()

    return (
        <div className="overflow-x-auto">
            {loading ? (
                <div className="flex items-center justify-center h-96">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent" />
                </div>
            ) : (
                <div className="min-w-[800px]">
                    {/* Day headers */}
                    <div className="grid grid-cols-8 gap-2 mb-2 sticky top-0 bg-white z-10">
                        <div className="text-sm font-semibold text-gray-600 py-2"></div>
                        {weekDays.map((day) => {
                            const isToday = day.toDateString() === today.toDateString()
                            return (
                                <div
                                    key={day.toISOString()}
                                    className={`text-center text-sm font-semibold py-2 rounded ${
                                        isToday ? 'bg-blue-600 text-white' : 'text-gray-700'
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
                            <div className="text-xs text-gray-500 py-2 text-right pr-2">
                                {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                            </div>
                            {weekDays.map((day) => {
                                const dayEvents = getEventsForDayAndHour(day, hour)
                                return (
                                    <div
                                        key={`${day.toISOString()}-${hour}`}
                                        className="min-h-[60px] border rounded bg-white p-1"
                                    >
                                        {dayEvents.map((event) => (
                                            <div
                                                key={event.id}
                                                className="text-xs px-2 py-1 mb-1 rounded bg-blue-50 text-blue-700 truncate cursor-pointer hover:bg-blue-100 transition-colors"
                                                title={`${event.title} - ${new Date(event.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
                                            >
                                                <div className="font-medium">{event.title}</div>
                                                <div className="text-[10px] text-gray-600">
                                                    {new Date(event.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                                </div>
                                            </div>
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

function DayView({ currentDate, events, loading }: ViewProps) {
    const hours = Array.from({ length: 13 }, (_, i) => i + 7) // 7 AM to 7 PM

    const getEventsForHour = (hour: number) => {
        const hourStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), hour, 0, 0, 0)
        const hourEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), hour, 59, 59, 999)

        return events.filter((event) => {
            const eventDate = new Date(event.startTime)
            return eventDate >= hourStart && eventDate <= hourEnd
        })
    }

    const today = new Date()
    const isToday = currentDate.toDateString() === today.toDateString()

    return (
        <div>
            {loading ? (
                <div className="flex items-center justify-center h-96">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent" />
                </div>
            ) : (
                <div>
                    {/* Day header */}
                    <div className={`text-center text-lg font-semibold py-4 mb-4 rounded ${
                        isToday ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
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
                            const hourEvents = getEventsForHour(hour)
                            return (
                                <div key={hour} className="flex gap-4">
                                    <div className="w-20 text-sm text-gray-500 py-2 text-right flex-shrink-0">
                                        {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                                    </div>
                                    <div className="flex-1 min-h-[80px] border rounded bg-white p-3">
                                        {hourEvents.length === 0 ? (
                                            <div className="text-gray-300 text-sm">No events</div>
                                        ) : (
                                            <div className="space-y-2">
                                                {hourEvents.map((event) => (
                                                    <div
                                                        key={event.id}
                                                        className="p-3 rounded bg-blue-50 border border-blue-100 cursor-pointer hover:bg-blue-100 transition-colors"
                                                    >
                                                        <div className="font-medium text-blue-900">{event.title}</div>
                                                        <div className="text-sm text-gray-600 mt-1">
                                                            {new Date(event.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                                            {event.endTime && ` - ${new Date(event.endTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
                                                        </div>
                                                        {event.location && (
                                                            <div className="text-sm text-gray-500 mt-1">📍 {event.location}</div>
                                                        )}
                                                        {event.summary && (
                                                            <div className="text-sm text-gray-600 mt-2">{event.summary}</div>
                                                        )}
                                                    </div>
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
