import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CalendarView } from '../../components/CalendarView'
import type { Event } from '../../types'
import React from 'react'

// Mock dependencies
vi.mock('../../components/ui', () => ({
  Button: ({ children, onClick, className, title, onMouseEnter, onMouseLeave }: React.ComponentProps<'button'>) => (
    <button
      onClick={onClick}
      className={className}
      title={title}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      data-testid="event-button"
    >
      {children}
    </button>
  ),
  Spinner: () => <div data-testid="spinner">Loading...</div>,
  SafeHTML: ({ html }: { html: string }) => <div data-testid="safe-html">{html}</div>,
}))

const createEvent = (id: string, startTime: string, title: string): Event => ({
  id,
  title,
  startTime,
  endTime: new Date(new Date(startTime).getTime() + 3600000).toISOString(), // 1 hour duration
  timezone: 'UTC',
  tags: [],
  user: { id: 'u1', username: 'user', isRemote: false },
})

describe('CalendarView Rendering', () => {
  const currentDate = new Date('2024-01-15T12:00:00') // Monday

  const events: Event[] = [
    createEvent('1', '2024-01-15T10:30:00', 'Event 1'), // Today 10:30 AM
    createEvent('2', '2024-01-15T14:00:00', 'Event 2'), // Today 2:00 PM
    createEvent('3', '2024-01-16T09:00:00', 'Event 3'), // Tomorrow 9:00 AM
    createEvent('4', '2024-01-10T10:00:00', 'Event 4'), // Last week
  ]

  describe('MonthView', () => {
    it('renders events on the correct days', () => {
      render(
        <CalendarView
          view="month"
          currentDate={currentDate}
          events={events}
          loading={false}
        />
      )

      // Event 1 and 2 should be on the 15th
      expect(screen.getByText('Event 1')).toBeInTheDocument()
      expect(screen.getByText('Event 2')).toBeInTheDocument()

      // Event 3 should be on the 16th
      expect(screen.getByText('Event 3')).toBeInTheDocument()

      // Event 4 should be on the 10th
      expect(screen.getByText('Event 4')).toBeInTheDocument()
    })

    it('filters out events from other months', () => {
        const otherMonthEvents = [
            createEvent('5', '2024-02-15T10:00:00', 'Feb Event')
        ]
        render(
            <CalendarView
              view="month"
              currentDate={currentDate}
              events={otherMonthEvents}
              loading={false}
            />
          )
        expect(screen.queryByText('Feb Event')).not.toBeInTheDocument()
    })
  })

  describe('WeekView', () => {
    it('renders events in the correct day and hour slots', () => {
      // Week of Jan 14 (Sun) to Jan 20 (Sat)
      render(
        <CalendarView
          view="week"
          currentDate={currentDate}
          events={events}
          loading={false}
        />
      )

      expect(screen.getByText(/Event 1/)).toBeInTheDocument() // Mon 10am
      expect(screen.getByText(/Event 2/)).toBeInTheDocument() // Mon 2pm
      expect(screen.getByText(/Event 3/)).toBeInTheDocument() // Tue 9am

      // Event 4 is Jan 10 (Wed previous week), should not be visible
      expect(screen.queryByText(/Event 4/)).not.toBeInTheDocument()
    })
  })

  describe('DayView', () => {
    it('renders events for the specific day', () => {
      render(
        <CalendarView
          view="day"
          currentDate={currentDate} // Jan 15
          events={events}
          loading={false}
        />
      )

      expect(screen.getByText('Event 1')).toBeInTheDocument()
      expect(screen.getByText('Event 2')).toBeInTheDocument()

      expect(screen.queryByText('Event 3')).not.toBeInTheDocument() // Jan 16
      expect(screen.queryByText('Event 4')).not.toBeInTheDocument() // Jan 10
    })
  })
})
