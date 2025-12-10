import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EventInfo } from './EventInfo'
import type { EventVisibility } from '../types'

describe('EventInfo', () => {
  const mockEvent = {
    title: 'Test Event',
    summary: 'This is a test event',
    startTime: '2024-01-15T10:00:00Z',
    endTime: '2024-01-15T12:00:00Z',
    location: 'Test Location',
    url: 'https://example.com',
    visibility: 'public' as EventVisibility,
    timezone: 'America/New_York',
    recurrencePattern: null,
    recurrenceEndDate: null,
    tags: [
      { id: '1', tag: 'test' },
      { id: '2', tag: 'event' },
    ],
  }

  it('renders event title', () => {
    render(<EventInfo event={mockEvent} viewerTimezone="America/Los_Angeles" />)

    expect(screen.getByText('Test Event')).toBeInTheDocument()
  })

  it('renders event summary', () => {
    render(<EventInfo event={mockEvent} viewerTimezone="America/Los_Angeles" />)

    expect(screen.getByText('This is a test event')).toBeInTheDocument()
  })

  it('renders event location', () => {
    render(<EventInfo event={mockEvent} viewerTimezone="America/Los_Angeles" />)

    expect(screen.getByText('Test Location')).toBeInTheDocument()
  })

  it('renders event URL as a link', () => {
    render(<EventInfo event={mockEvent} viewerTimezone="America/Los_Angeles" />)

    const link = screen.getByRole('link', { name: 'https://example.com' })
    expect(link).toHaveAttribute('href', 'https://example.com')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('renders event tags', () => {
    render(<EventInfo event={mockEvent} viewerTimezone="America/Los_Angeles" />)

    expect(screen.getByText('#test')).toBeInTheDocument()
    expect(screen.getByText('#event')).toBeInTheDocument()
  })

  it('displays timezone information', () => {
    render(<EventInfo event={mockEvent} viewerTimezone="America/Los_Angeles" />)

    expect(screen.getByText(/Times shown in America\/Los_Angeles/)).toBeInTheDocument()
  })

  it('shows event timezone when different from viewer timezone', () => {
    render(
      <EventInfo
        event={mockEvent}
        viewerTimezone="America/Los_Angeles"
        eventTimezone="America/New_York"
      />
    )

    expect(screen.getByText(/event scheduled in America\/New_York/)).toBeInTheDocument()
  })

  it('does not render optional fields when not provided', () => {
    const minimalEvent = {
      title: 'Minimal Event',
      summary: null,
      startTime: '2024-01-15T10:00:00Z',
      endTime: null,
      location: null,
      url: null,
      visibility: 'public' as EventVisibility,
      timezone: null,
      recurrencePattern: null,
      recurrenceEndDate: null,
      tags: [],
    }

    render(<EventInfo event={minimalEvent} viewerTimezone="America/Los_Angeles" />)

    expect(screen.queryByText('This is a test event')).not.toBeInTheDocument()
    expect(screen.queryByText('Test Location')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
