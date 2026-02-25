import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CalendarView } from '../../components/CalendarView'
import { createTestWrapper } from '../testUtils'
import type { Event } from '../../types'

describe('CalendarView Rendering', () => {
    // Mock events
    const mockEvents: Event[] = [
        {
            id: '1',
            title: 'Morning Meeting',
            // Dec 15, 2025 at 9:00 AM
            startTime: new Date(2025, 11, 15, 9, 0, 0).toISOString(),
            endTime: new Date(2025, 11, 15, 10, 0, 0).toISOString(),
            viewerStatus: 'attending',
            timezone: 'UTC',
            tags: [],
        },
        {
            id: '2',
            title: 'Lunch Break',
            // Dec 15, 2025 at 12:30 PM
            startTime: new Date(2025, 11, 15, 12, 30, 0).toISOString(),
            endTime: new Date(2025, 11, 15, 13, 30, 0).toISOString(),
            viewerStatus: 'maybe',
            timezone: 'UTC',
            tags: [],
        },
        {
            id: '3',
            title: 'Next Day Event',
            // Dec 16, 2025 at 2:00 PM
            startTime: new Date(2025, 11, 16, 14, 0, 0).toISOString(),
            endTime: new Date(2025, 11, 16, 15, 0, 0).toISOString(),
            viewerStatus: 'attending',
            timezone: 'UTC',
            tags: [],
        }
    ]

    const currentDate = new Date(2025, 11, 15) // Dec 15, 2025 (Monday)

    it('renders MonthView correctly', () => {
        const { wrapper } = createTestWrapper()
        render(
            <CalendarView
                view="month"
                currentDate={currentDate}
                events={mockEvents}
                loading={false}
                onEventClick={vi.fn()}
            />,
            { wrapper }
        )

        // Month view should show all events in the month
        expect(screen.getByText('Morning Meeting')).toBeInTheDocument()
        expect(screen.getByText('Lunch Break')).toBeInTheDocument()
        expect(screen.getByText('Next Day Event')).toBeInTheDocument()
    })

    it('renders WeekView correctly', () => {
        const { wrapper } = createTestWrapper()
        render(
            <CalendarView
                view="week"
                currentDate={currentDate}
                events={mockEvents}
                loading={false}
                onEventClick={vi.fn()}
            />,
            { wrapper }
        )

        // Week view should show all events in the week
        // Note: getAllByText because buttons might render title twice or in tooltips/etc
        // but getByText is stricter. The component renders title in a div.
        expect(screen.getAllByText('Morning Meeting')[0]).toBeInTheDocument()
        expect(screen.getAllByText('Lunch Break')[0]).toBeInTheDocument()
        expect(screen.getAllByText('Next Day Event')[0]).toBeInTheDocument()
    })

    it('renders DayView correctly', () => {
        const { wrapper } = createTestWrapper()
        render(
            <CalendarView
                view="day"
                currentDate={currentDate}
                events={mockEvents}
                loading={false}
                onEventClick={vi.fn()}
            />,
            { wrapper }
        )

        // Day view should ONLY show events for the specific day
        expect(screen.getByText('Morning Meeting')).toBeInTheDocument()
        expect(screen.getByText('Lunch Break')).toBeInTheDocument()

        // Event from next day should NOT be rendered
        expect(screen.queryByText('Next Day Event')).not.toBeInTheDocument()
    })
})
