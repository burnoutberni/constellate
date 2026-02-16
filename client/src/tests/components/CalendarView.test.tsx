import { render, screen, fireEvent } from '@testing-library/react'
import { createTestWrapper } from '../testUtils'
import { CalendarView } from '../../components/CalendarView'
import type { Event } from '../../types'
import { describe, it, expect, vi } from 'vitest'

// Helper to create a mock event
const createMockEvent = (overrides: Partial<Event> = {}): Event => ({
  id: '1',
  title: 'Test Event',
  startTime: new Date().toISOString(),
  endTime: new Date(Date.now() + 3600000).toISOString(),
  timezone: 'UTC',
  tags: [],
  user: {
    id: 'user1',
    username: 'testuser',
    isRemote: false,
  },
  _count: {
    attendance: 0,
    likes: 0,
    comments: 0,
  },
  ...overrides,
})

describe('CalendarView Component', () => {
  const currentDate = new Date(2023, 9, 15) // October 15, 2023 (Sunday)
  const { wrapper } = createTestWrapper()

  it('renders Month view correctly', () => {
    const events: Event[] = [
      createMockEvent({
        id: '1',
        title: 'Month Event 1',
        startTime: new Date(2023, 9, 15, 10, 0, 0).toISOString(), // Oct 15
      }),
      createMockEvent({
        id: '2',
        title: 'Month Event 2',
        startTime: new Date(2023, 9, 20, 14, 0, 0).toISOString(), // Oct 20
      }),
    ]

    render(
      <CalendarView
        view="month"
        currentDate={currentDate}
        events={events}
        loading={false}
      />,
      { wrapper }
    )

    expect(screen.getByText('Month Event 1')).toBeInTheDocument()
    expect(screen.getByText('Month Event 2')).toBeInTheDocument()
    // Verify days are rendered
    expect(screen.getAllByText('15').length).toBeGreaterThan(0)
    expect(screen.getAllByText('20').length).toBeGreaterThan(0)
  })

  it('renders Week view correctly', () => {
    // Week starting Oct 15 (Sunday) to Oct 21 (Saturday)
    const events: Event[] = [
      createMockEvent({
        id: '1',
        title: 'Week Event 1',
        startTime: new Date(2023, 9, 16, 10, 0, 0).toISOString(), // Monday Oct 16, 10 AM
      }),
      createMockEvent({
        id: '2',
        title: 'Week Event 2',
        startTime: new Date(2023, 9, 18, 14, 0, 0).toISOString(), // Wednesday Oct 18, 2 PM
      }),
    ]

    render(
      <CalendarView
        view="week"
        currentDate={currentDate}
        events={events}
        loading={false}
      />,
      { wrapper }
    )

    // Check for event titles
    expect(screen.getByText('Week Event 1')).toBeInTheDocument()
    expect(screen.getByText('Week Event 2')).toBeInTheDocument()

    // Check for headers (Sun, Mon, etc.)
    expect(screen.getByText('Sun')).toBeInTheDocument()
    expect(screen.getByText('Mon')).toBeInTheDocument()
  })

  it('renders Day view correctly', () => {
    const events: Event[] = [
      createMockEvent({
        id: '1',
        title: 'Day Event 1',
        startTime: new Date(2023, 9, 15, 9, 0, 0).toISOString(), // 9 AM
      }),
      createMockEvent({
        id: '2',
        title: 'Day Event 2',
        startTime: new Date(2023, 9, 15, 15, 0, 0).toISOString(), // 3 PM
      }),
    ]

    render(
      <CalendarView
        view="day"
        currentDate={currentDate}
        events={events}
        loading={false}
      />,
      { wrapper }
    )

    expect(screen.getByText('Day Event 1')).toBeInTheDocument()
    expect(screen.getByText('Day Event 2')).toBeInTheDocument()

    // Check for time labels
    expect(screen.getByText('9 AM')).toBeInTheDocument()
    expect(screen.getByText('3 PM')).toBeInTheDocument()
  })

  it('handles loading state', () => {
    render(
      <CalendarView
        view="month"
        currentDate={currentDate}
        events={[]}
        loading={true}
      />,
      { wrapper }
    )

    // Check for spinner or loading indicator logic
    // The component uses <Spinner /> which usually has a specific role or testid,
    // or just checking absence of grid might be enough if spinner is hard to select.
    // Based on code: <Spinner size="lg" />
    // Let's assume Spinner renders an SVG or similar.
    // We can check that the grid is NOT rendered.
    expect(screen.queryByText('Sun')).toBeInTheDocument() // Headers are always there in month view
    // But the day grid is replaced by spinner container
    const spinnerContainer = document.querySelector('.flex.items-center.justify-center.h-96')
    expect(spinnerContainer).toBeInTheDocument()
  })

  it('calls onEventClick when event is clicked', () => {
    const onEventClick = vi.fn()
    const event = createMockEvent({
      id: '1',
      title: 'Clickable Event',
      startTime: new Date(2023, 9, 15, 10, 0, 0).toISOString(),
    })

    render(
      <CalendarView
        view="month"
        currentDate={currentDate}
        events={[event]}
        loading={false}
        onEventClick={onEventClick}
      />,
      { wrapper }
    )

    fireEvent.click(screen.getByText('Clickable Event'))
    expect(onEventClick).toHaveBeenCalledTimes(1)
    expect(onEventClick).toHaveBeenCalledWith(event, expect.objectContaining({
      x: expect.any(Number),
      y: expect.any(Number),
    }))
  })
})
