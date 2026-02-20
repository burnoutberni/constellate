import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CalendarView } from '../../components/CalendarView'
import { createTestWrapper } from '../testUtils'
import { Event } from '@/types'

// Mock minimal event object
const createMockEvent = (id: string, title: string, startTime: Date, endTime?: Date): Event => ({
  id,
  title,
  startTime: startTime.toISOString(),
  endTime: endTime ? endTime.toISOString() : undefined,
  timezone: 'UTC',
  tags: [],
  viewerStatus: 'attending'
} as Event)

describe('CalendarView Rendering', () => {
  const { wrapper } = createTestWrapper()

  // December 15, 2025 is a Monday
  const currentDate = new Date('2025-12-15T12:00:00')

  it('renders MonthView with events correctly', () => {
    const event = createMockEvent('1', 'Month Event', new Date('2025-12-15T10:00:00'))

    render(
      <CalendarView
        view="month"
        currentDate={currentDate}
        events={[event]}
        loading={false}
      />,
      { wrapper }
    )

    expect(screen.getByText('Month Event')).toBeInTheDocument()
    // Check if day 15 is rendered
    expect(screen.getByText('15')).toBeInTheDocument()
  })

  it('renders WeekView with events correctly', () => {
    // Event on Monday 15th at 10 AM
    const event = createMockEvent('1', 'Week Event', new Date('2025-12-15T10:00:00'))

    render(
      <CalendarView
        view="week"
        currentDate={currentDate}
        events={[event]}
        loading={false}
      />,
      { wrapper }
    )

    expect(screen.getByText('Week Event')).toBeInTheDocument()
    // Check header for Monday 15
    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getByText('Mon')).toBeInTheDocument()
  })

  it('renders DayView with events correctly', () => {
    // Event on Monday 15th at 10 AM
    const event = createMockEvent('1', 'Day Event', new Date('2025-12-15T10:00:00'))

    render(
      <CalendarView
        view="day"
        currentDate={currentDate}
        events={[event]}
        loading={false}
      />,
      { wrapper }
    )

    expect(screen.getByText('Day Event')).toBeInTheDocument()
    // Check header
    expect(screen.getByText('December 15, 2025')).toBeInTheDocument()
  })
})
