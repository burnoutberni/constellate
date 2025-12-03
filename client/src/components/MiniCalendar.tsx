import { useEvents } from '../hooks/queries/events'

interface MiniCalendarProps {
    selectedDate: Date
    onDateSelect: (date: Date) => void
}

export function MiniCalendar({ selectedDate, onDateSelect }: MiniCalendarProps) {
    const { data } = useEvents(100)
    const events = data?.events || []

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
        const { year, month } = getDaysInMonth(selectedDate)
        const dayDate = new Date(year, month, day)
        const dayStart = new Date(dayDate.setHours(0, 0, 0, 0))
        const dayEnd = new Date(dayDate.setHours(23, 59, 59, 999))

        return events.filter((event) => {
            const eventDate = new Date(event.startTime)
            return eventDate >= dayStart && eventDate <= dayEnd
        })
    }

    const previousMonth = () => {
        onDateSelect(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1))
    }

    const nextMonth = () => {
        onDateSelect(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1))
    }

    const goToToday = () => {
        onDateSelect(new Date())
    }

    const handleDayClick = (day: number) => {
        const { year, month } = getDaysInMonth(selectedDate)
        onDateSelect(new Date(year, month, day))
    }

    const { daysInMonth, startingDayOfWeek } = getDaysInMonth(selectedDate)
    const monthName = selectedDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    const today = new Date()

    return (
        <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm">{monthName}</h3>
                <div className="flex items-center gap-1">
                    <button
                        onClick={previousMonth}
                        className="p-1 hover:bg-gray-100 rounded text-gray-600"
                        aria-label="Previous month"
                    >
                        ←
                    </button>
                    <button
                        onClick={nextMonth}
                        className="p-1 hover:bg-gray-100 rounded text-gray-600"
                        aria-label="Next month"
                    >
                        →
                    </button>
                </div>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                    <div
                        key={`day-header-${index}`}
                        className="text-center text-xs font-semibold text-gray-500 py-1"
                    >
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-1">
                {/* Empty cells for days before month starts */}
                {Array.from({ length: startingDayOfWeek }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square" />
                ))}

                {/* Days of the month */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1
                    const dayEvents = getEventsForDay(day)
                    const dayDate = new Date(
                        selectedDate.getFullYear(),
                        selectedDate.getMonth(),
                        day
                    )
                    const isToday = dayDate.toDateString() === today.toDateString()
                    const isSelected =
                        dayDate.toDateString() === selectedDate.toDateString()

                    return (
                        <button
                            key={day}
                            onClick={() => handleDayClick(day)}
                            className={`aspect-square text-xs rounded hover:bg-blue-50 transition-colors relative ${isToday
                                    ? 'ring-1 ring-blue-500 font-semibold'
                                    : ''
                                } ${isSelected
                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                    : 'text-gray-700'
                                }`}
                        >
                            {day}
                            {dayEvents.length > 0 && (
                                <div
                                    className={`absolute bottom-0.5 left-1/2 transform -translate-x-1/2 w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-blue-500'
                                        }`}
                                />
                            )}
                        </button>
                    )
                })}
            </div>

            <button
                onClick={goToToday}
                className="mt-3 w-full text-xs text-blue-600 hover:text-blue-700 hover:underline"
            >
                Go to today
            </button>
        </div>
    )
}

