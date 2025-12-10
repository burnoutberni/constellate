import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { EventCard } from './EventCard'
import type { Event } from '../types'

// Mock AuthContext
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, logout: vi.fn() }),
}))

const mockEvent: Event = {
  id: '1',
  title: 'Test Event',
  summary: 'This is a test event',
  location: 'Test Location',
  startTime: '2024-01-15T10:00:00Z',
  endTime: '2024-01-15T12:00:00Z',
  timezone: 'UTC',
  visibility: 'PUBLIC',
  tags: [
    { id: '1', tag: 'test' },
    { id: '2', tag: 'event' },
  ],
  user: {
    id: 'user1',
    username: 'testuser',
    name: 'Test User',
    isRemote: false,
  },
  _count: {
    attendance: 10,
    likes: 5,
    comments: 3,
  },
}

describe('EventCard Component', () => {
  it('should render full variant with event title', () => {
      render(
        <BrowserRouter>
          <EventCard event={mockEvent} variant="full" isAuthenticated={false} />
        </BrowserRouter>
      )

    expect(screen.getByText('Test Event')).toBeInTheDocument()
  })

  it('should render compact variant with event title', () => {
      render(
        <BrowserRouter>
          <EventCard event={mockEvent} variant="compact" isAuthenticated={true} />
        </BrowserRouter>
      )

    expect(screen.getByText('Test Event')).toBeInTheDocument()
  })

  it('should show sign up link for unauthenticated users in full variant', () => {
      render(
        <BrowserRouter>
          <EventCard event={mockEvent} variant="full" isAuthenticated={false} />
        </BrowserRouter>
      )

    const signUpLink = screen.getByText('Sign up to RSVP')
    expect(signUpLink).toBeInTheDocument()
    expect(signUpLink.closest('a')).toHaveAttribute('href', '/login')
  })

  it('should not show sign up link for authenticated users in full variant', () => {
      render(
        <BrowserRouter>
          <EventCard event={mockEvent} variant="full" isAuthenticated={true} />
        </BrowserRouter>
      )

    expect(screen.queryByText('Sign up to RSVP')).not.toBeInTheDocument()
  })

  it('should render full variant by default', () => {
      render(
        <BrowserRouter>
          <EventCard event={mockEvent} isAuthenticated={false} />
        </BrowserRouter>
      )

    expect(screen.getByText('Test Event')).toBeInTheDocument()
  })

  it('should be a valid React component', () => {
    expect(() => EventCard({ event: mockEvent })).not.toThrow()
  })
})
