import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { SuggestedUsersCard } from '@/components/Feed/SuggestedUsersCard'
import { MiniCalendar } from '@/components/MiniCalendar'
import { Card } from '@/components/ui'
import { useSuggestedUsers } from '@/hooks/queries'

export function Sidebar() {
    const navigate = useNavigate()
    const [date, setDate] = useState(new Date())
    const { data: suggestions } = useSuggestedUsers(5)

    const handleDateSelect = (newDate: Date) => {
        setDate(newDate)
        // Navigate to calendar page or filter feed?
        // For now, let's just navigate to the calendar view for that date
        navigate(`/calendar?date=${newDate.toISOString()}`)
    }

    return (
        <div className="space-y-6 hidden lg:block w-80 shrink-0">
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
                    <a href="/privacy" className="hover:underline">Privacy</a>
                    <a href="/terms" className="hover:underline">Terms</a>
                </div>
            </div>
        </div>
    )
}
