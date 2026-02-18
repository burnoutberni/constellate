import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CalendarView } from '../../components/CalendarView'
import { createTestWrapper, clearQueryClient } from '../testUtils'
import { Event } from '@/types'

describe('CalendarView Component', () => {
    const { wrapper, queryClient } = createTestWrapper()
    const mockOnEventClick = vi.fn()
    const mockOnEventHover = vi.fn()

    // October 2023
    const currentDate = new Date(2023, 9, 15) // October 15, 2023

    const createMockEvent = (id: string, startTime: Date, endTime: Date): Event => ({
        id,
        title: `Event ${id}`,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        timezone: 'UTC',
        tags: [],
        location: 'Test Location',
        summary: 'Test Summary',
    } as Event)

    const events: Event[] = [
        // Month View: specific days
        createMockEvent('1', new Date(2023, 9, 1, 10, 0), new Date(2023, 9, 1, 11, 0)), // Oct 1
        createMockEvent('2', new Date(2023, 9, 15, 14, 0), new Date(2023, 9, 15, 15, 0)), // Oct 15
        createMockEvent('3', new Date(2023, 9, 31, 23, 0), new Date(2023, 9, 31, 23, 30)), // Oct 31

        // Events outside month
        createMockEvent('4', new Date(2023, 8, 30, 10, 0), new Date(2023, 8, 30, 11, 0)), // Sep 30
        createMockEvent('5', new Date(2023, 10, 1, 10, 0), new Date(2023, 10, 1, 11, 0)), // Nov 1

        // Week/Day View: specific hours (7-19 range)
        createMockEvent('6', new Date(2023, 9, 15, 7, 0), new Date(2023, 9, 15, 8, 0)), // 7 AM
        createMockEvent('7', new Date(2023, 9, 15, 12, 0), new Date(2023, 9, 15, 13, 0)), // 12 PM
        createMockEvent('8', new Date(2023, 9, 15, 19, 0), new Date(2023, 9, 15, 20, 0)), // 7 PM

        // Events outside hour range
        createMockEvent('9', new Date(2023, 9, 15, 6, 0), new Date(2023, 9, 15, 7, 0)), // 6 AM
        createMockEvent('10', new Date(2023, 9, 15, 20, 0), new Date(2023, 9, 15, 21, 0)), // 8 PM
    ]

    beforeEach(() => {
        clearQueryClient(queryClient)
        vi.clearAllMocks()
    })

    describe('MonthView', () => {
        it('renders events on correct days', () => {
            render(
                <CalendarView
                    view="month"
                    currentDate={currentDate}
                    events={events}
                    loading={false}
                    onEventClick={mockOnEventClick}
                    onEventHover={mockOnEventHover}
                />,
                { wrapper }
            )

            expect(screen.getByText('Event 1')).toBeInTheDocument()
            expect(screen.getByText('Event 2')).toBeInTheDocument()
            expect(screen.getByText('Event 3')).toBeInTheDocument()
        })

        it('does not render events from other months', () => {
            render(
                <CalendarView
                    view="month"
                    currentDate={currentDate}
                    events={events}
                    loading={false}
                    onEventClick={mockOnEventClick}
                    onEventHover={mockOnEventHover}
                />,
                { wrapper }
            )

            expect(screen.queryByText('Event 4')).not.toBeInTheDocument()
            expect(screen.queryByText('Event 5')).not.toBeInTheDocument()
        })
    })

    describe('WeekView', () => {
        it('renders events in correct hour slots', () => {
            // Oct 15 is a Sunday in 2023. WeekView usually starts Sunday or Monday depending on locale/implementation.
            // The implementation logic for WeekView:
            /*
            const dayOfWeek = currentDate.getDay()
            const startOfWeek = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - dayOfWeek, 0, 0, 0, 0)
            */
            // So startOfWeek is Sunday Oct 15. The week is Oct 15 - Oct 21.

            render(
                <CalendarView
                    view="week"
                    currentDate={currentDate}
                    events={events}
                    loading={false}
                    onEventClick={mockOnEventClick}
                    onEventHover={mockOnEventHover}
                />,
                { wrapper }
            )

            // Event 6: Oct 15, 7 AM. Should be visible.
            // Using regex because the title might be combined with time
            expect(screen.getByText(/Event 6/)).toBeInTheDocument()

            // Event 7: Oct 15, 12 PM. Should be visible.
            expect(screen.getByText(/Event 7/)).toBeInTheDocument()

            // Event 8: Oct 15, 19 PM (7 PM). Should be visible.
            expect(screen.getByText(/Event 8/)).toBeInTheDocument()
        })

        it('does not render events outside 7AM-7PM range', () => {
            render(
                <CalendarView
                    view="week"
                    currentDate={currentDate}
                    events={events}
                    loading={false}
                    onEventClick={mockOnEventClick}
                    onEventHover={mockOnEventHover}
                />,
                { wrapper }
            )

            expect(screen.queryByText(/Event 9/)).not.toBeInTheDocument() // 6 AM
            expect(screen.queryByText(/Event 10/)).not.toBeInTheDocument() // 8 PM
        })

        it('does not render events from other weeks', () => {
             render(
                <CalendarView
                    view="week"
                    currentDate={currentDate}
                    events={events}
                    loading={false}
                    onEventClick={mockOnEventClick}
                    onEventHover={mockOnEventHover}
                />,
                { wrapper }
            )

            expect(screen.queryByText(/Event 1/)).not.toBeInTheDocument() // Oct 1
        })
    })

    describe('DayView', () => {
        it('renders events in correct hour slots', () => {
            render(
                <CalendarView
                    view="day"
                    currentDate={currentDate} // Oct 15
                    events={events}
                    loading={false}
                    onEventClick={mockOnEventClick}
                    onEventHover={mockOnEventHover}
                />,
                { wrapper }
            )

            expect(screen.getByText('Event 6')).toBeInTheDocument() // 7 AM
            expect(screen.getByText('Event 7')).toBeInTheDocument() // 12 PM
            expect(screen.getByText('Event 8')).toBeInTheDocument() // 7 PM
        })

        it('does not render events outside 7AM-7PM range', () => {
             render(
                <CalendarView
                    view="day"
                    currentDate={currentDate} // Oct 15
                    events={events}
                    loading={false}
                    onEventClick={mockOnEventClick}
                    onEventHover={mockOnEventHover}
                />,
                { wrapper }
            )

            expect(screen.queryByText('Event 9')).not.toBeInTheDocument() // 6 AM
            expect(screen.queryByText('Event 10')).not.toBeInTheDocument() // 8 PM
        })

        it('does not render events from other days', () => {
             render(
                <CalendarView
                    view="day"
                    currentDate={currentDate} // Oct 15
                    events={events}
                    loading={false}
                    onEventClick={mockOnEventClick}
                    onEventHover={mockOnEventHover}
                />,
                { wrapper }
            )

            expect(screen.queryByText('Event 1')).not.toBeInTheDocument() // Oct 1
        })
    })
})
