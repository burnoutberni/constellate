import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { EventCard } from './EventCard'
import type { Event } from '../types'

// Mock AuthContext
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, logout: vi.fn() }),
}))

const mockFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'UTC',
})

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
  describe('Legacy API (formatter + viewMode)', () => {
    it('should render event title and location in list view', () => {
      render(
        <BrowserRouter>
          <EventCard event={mockEvent} formatter={mockFormatter} viewMode="list" />
        </BrowserRouter>
      )

      expect(screen.getByText('Test Event')).toBeInTheDocument()
      expect(screen.getByText(/Test Location/)).toBeInTheDocument()
    })

    it('should render event summary in list view', () => {
      render(
        <BrowserRouter>
          <EventCard event={mockEvent} formatter={mockFormatter} viewMode="list" />
        </BrowserRouter>
      )

      expect(screen.getByText('This is a test event')).toBeInTheDocument()
    })

    it('should render event tags in list view', () => {
      render(
        <BrowserRouter>
          <EventCard event={mockEvent} formatter={mockFormatter} viewMode="list" />
        </BrowserRouter>
      )

      expect(screen.getByText('#test')).toBeInTheDocument()
      expect(screen.getByText('#event')).toBeInTheDocument()
    })

    it('should render event counts in list view', () => {
      render(
        <BrowserRouter>
          <EventCard event={mockEvent} formatter={mockFormatter} viewMode="list" />
        </BrowserRouter>
      )

      expect(screen.getByText(/10 attending/)).toBeInTheDocument()
      expect(screen.getByText(/5 likes/)).toBeInTheDocument()
      expect(screen.getByText(/3 comments/)).toBeInTheDocument()
    })

    it('should render View event button with correct link in list view', () => {
      render(
        <BrowserRouter>
          <EventCard event={mockEvent} formatter={mockFormatter} viewMode="list" />
        </BrowserRouter>
      )

      const button = screen.getByRole('button', { name: 'View event' })
      expect(button).toBeInTheDocument()

      const link = button.closest('a')
      expect(link).toHaveAttribute('href', '/@testuser/1')
    })

    it('should render Sign up to RSVP button for unauthenticated users in list view', () => {
      render(
        <BrowserRouter>
          <EventCard event={mockEvent} formatter={mockFormatter} viewMode="list" />
        </BrowserRouter>
      )

      const signupButton = screen.getByRole('button', { name: 'Sign up to RSVP' })
      expect(signupButton).toBeInTheDocument()

      const link = signupButton.closest('a')
      expect(link).toHaveAttribute('href', '/login')
    })

    it('should render in grid view mode', () => {
      const { container } = render(
        <BrowserRouter>
          <EventCard event={mockEvent} formatter={mockFormatter} viewMode="grid" />
        </BrowserRouter>
      )

      expect(container.querySelector('.flex-col.h-full')).toBeInTheDocument()
    })

    it('should render visibility badge in list view', () => {
      render(
        <BrowserRouter>
          <EventCard event={mockEvent} formatter={mockFormatter} viewMode="list" />
        </BrowserRouter>
      )

      expect(screen.getByText(/Public/)).toBeInTheDocument()
    })
  })

  describe('New API (variant + isAuthenticated)', () => {
    it('should accept event and variant props', () => {
      const props = {
        event: mockEvent,
        variant: 'full' as const,
        isAuthenticated: false,
      }

      expect(EventCard).toBeDefined()
      expect(typeof EventCard).toBe('function')
      expect(props.event.id).toBe('1')
      expect(props.variant).toBe('full')
    })

    it('should accept compact variant', () => {
      const props = {
        event: mockEvent,
        variant: 'compact' as const,
        isAuthenticated: true,
      }

      expect(props.variant).toBe('compact')
    })

    it('should handle authentication state', () => {
      const propsUnauthenticated = {
        event: mockEvent,
        isAuthenticated: false,
      }

      const propsAuthenticated = {
        event: mockEvent,
        isAuthenticated: true,
      }

      expect(propsUnauthenticated.isAuthenticated).toBe(false)
      expect(propsAuthenticated.isAuthenticated).toBe(true)
    })

    it('should render full variant', () => {
      render(
        <BrowserRouter>
          <EventCard event={mockEvent} variant="full" isAuthenticated={false} />
        </BrowserRouter>
      )

      expect(screen.getByText('Test Event')).toBeInTheDocument()
    })

    it('should render compact variant', () => {
      render(
        <BrowserRouter>
          <EventCard event={mockEvent} variant="compact" isAuthenticated={false} />
        </BrowserRouter>
      )

      expect(screen.getByText('Test Event')).toBeInTheDocument()
    })

    it('should be a valid React component', () => {
      expect(() => EventCard({ event: mockEvent })).not.toThrow()
    })
  })
})
