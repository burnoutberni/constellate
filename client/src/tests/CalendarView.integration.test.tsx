import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { CalendarView } from '../components/CalendarView'
import { createTestWrapper } from './testUtils'
import { Event } from '../types'
import React from 'react'

describe('CalendarView Optimization Verification', () => {
    const { wrapper } = createTestWrapper()
    const currentDate = new Date('2025-10-27T12:00:00') // Monday

    // Create events that will test the bucketing logic
    const events: Event[] = [
        {
            id: '1',
            title: 'Event 1',
            startTime: '2025-10-27T10:00:00', // Monday 10am
            endTime: '2025-10-27T11:00:00',
            viewerStatus: 'attending',
            timezone: 'UTC',
            tags: []
        },
        {
            id: '2',
            title: 'Event 2',
            startTime: '2025-10-28T14:00:00', // Tuesday 2pm
            endTime: '2025-10-28T15:00:00',
            viewerStatus: 'maybe',
            timezone: 'UTC',
            tags: []
        },
        {
            id: '3',
            title: 'Event 3',
            startTime: '2025-10-27T10:30:00', // Monday 10:30am (Same day/hour as Event 1 to test list append)
            endTime: '2025-10-27T11:30:00',
            viewerStatus: 'not_attending',
            timezone: 'UTC',
            tags: []
        },
        {
            id: '4',
            title: 'Event 4 (Next Month)',
            startTime: '2025-11-27T10:00:00',
            endTime: '2025-11-27T11:00:00',
            viewerStatus: 'attending',
            timezone: 'UTC',
            tags: []
        }
    ]

    it('renders events correctly in MonthView (populates day bucket)', () => {
        render(
            <CalendarView
                view="month"
                currentDate={currentDate}
                events={events}
                loading={false}
            />,
            { wrapper }
        )

        // Should show events in the current month
        expect(screen.getByText('Event 1')).toBeDefined()
        expect(screen.getByText('Event 2')).toBeDefined()
        expect(screen.getByText('Event 3')).toBeDefined()

        // Should NOT show event from next month
        expect(screen.queryByText('Event 4 (Next Month)')).toBeNull()
    })

    it('renders events correctly in WeekView (populates day-hour bucket)', () => {
        render(
            <CalendarView
                view="week"
                currentDate={currentDate}
                events={events}
                loading={false}
            />,
            { wrapper }
        )

        // WeekView shows events for the week
        expect(screen.getAllByText(/Event 1/).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/Event 2/).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/Event 3/).length).toBeGreaterThan(0)

        // Event 4 is next month, definitely not in this week
        expect(screen.queryByText(/Event 4/)).toBeNull()
    })

    it('renders events correctly in DayView (populates hour bucket)', () => {
        render(
            <CalendarView
                view="day"
                currentDate={currentDate} // Monday
                events={events}
                loading={false}
            />,
            { wrapper }
        )

        // Should show events for Monday
        expect(screen.getByText('Event 1')).toBeDefined()
        expect(screen.getByText('Event 3')).toBeDefined()

        // Event 2 is on Tuesday
        expect(screen.queryByText('Event 2')).toBeNull()
    })

    it('renders empty states correctly', () => {
        render(
             <CalendarView
                view="day"
                currentDate={currentDate}
                events={[]}
                loading={false}
            />,
            { wrapper }
        )
        // Check for no events text or structural element implies successful empty render
        // The implementation renders "No events" for empty hours?
        // Checking code: DayView renders "No events" if hourEvents.length === 0
        expect(screen.getAllByText('No events').length).toBeGreaterThan(0)
    })
})
