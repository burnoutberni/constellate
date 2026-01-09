import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

import { EventCard } from '@/components/EventCard'
import { SuggestedUsersCard } from '@/components/Feed/SuggestedUsersCard'
import { MiniCalendar } from '@/components/MiniCalendar'
import { Card } from '@/components/ui'
import { useSuggestedUsers, useEvents } from '@/hooks/queries'
import { useAuth } from '@/hooks/useAuth'

export function Sidebar() {
    const navigate = useNavigate()
    const { user } = useAuth()
    const [date, setDate] = useState(new Date())
    const { data: suggestions } = useSuggestedUsers(5, { enabled: Boolean(user) })

    // Memoize rangeStart to prevent infinite loop
    const rangeStart = useMemo(() => new Date().toISOString(), [])

    // Fetch upcoming events for the specific user's agenda
    const { data: eventsData } = useEvents({
        limit: 5,
        rangeStart,
        onlyMine: true,
        enabled: Boolean(user)
    })

    const upcomingEvents = eventsData?.events || []

    const handleDateSelect = (newDate: Date) => {
        setDate(newDate)
        // Navigate to calendar page or filter feed?
        // For now, let's just navigate to the calendar view for that date
        navigate(`/calendar?date=${newDate.toISOString()}`)
    }

    return (
        <div className="space-y-6 hidden lg:block w-80 shrink-0">
            {/* Upcoming Events (My Schedule) */}
            {user && upcomingEvents.length > 0 && (
                <Card className="overflow-hidden">
                    <h3 className="font-bold text-lg mb-4 px-1">Upcoming Events</h3>
                    <div className="space-y-4">
                        {upcomingEvents.map(event => (
                            <div key={event.id} className="h-full">
                                <EventCard
                                    event={event}
                                    variant="compact"
                                    isAuthenticated={true}
                                />
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            <Card variant="default" padding="none" className="overflow-hidden">
                <MiniCalendar selectedDate={date} onDateSelect={handleDateSelect} />
            </Card>

            {suggestions && suggestions.length > 0 && (
                <SuggestedUsersCard users={suggestions} />
            )}

            <div className="text-xs text-text-tertiary text-center">
                <p>© 2024 Constellate</p>
                <div className="flex justify-center gap-2 mt-1">
                    <a href="/about" className="hover:underline">About</a>
                    <a href="/instances" className="hover:underline">Instances</a>
                    <a href="/privacy" className="hover:underline">Privacy</a>
                    <a href="/terms" className="hover:underline">Terms</a>
                </div>
            </div>
        </div>
    )
}
