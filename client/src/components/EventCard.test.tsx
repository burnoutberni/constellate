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
        isRemote: false,
    },
    _count: {
        attendance: 10,
        likes: 5,
        comments: 3,
    },
}

describe('EventCard Component', () => {
    it('should render event title and location', () => {
        render(
            <BrowserRouter>
                <EventCard event={mockEvent} formatter={mockFormatter} viewMode="list" />
            </BrowserRouter>
        )

        expect(screen.getByText('Test Event')).toBeInTheDocument()
        expect(screen.getByText(/Test Location/)).toBeInTheDocument()
    })

    it('should render event summary', () => {
        render(
            <BrowserRouter>
                <EventCard event={mockEvent} formatter={mockFormatter} viewMode="list" />
            </BrowserRouter>
        )

        expect(screen.getByText('This is a test event')).toBeInTheDocument()
    })

    it('should render event tags', () => {
        render(
            <BrowserRouter>
                <EventCard event={mockEvent} formatter={mockFormatter} viewMode="list" />
            </BrowserRouter>
        )

        expect(screen.getByText('#test')).toBeInTheDocument()
        expect(screen.getByText('#event')).toBeInTheDocument()
    })

    it('should render event counts', () => {
        render(
            <BrowserRouter>
                <EventCard event={mockEvent} formatter={mockFormatter} viewMode="list" />
            </BrowserRouter>
        )

        expect(screen.getByText(/10 attending/)).toBeInTheDocument()
        expect(screen.getByText(/5 likes/)).toBeInTheDocument()
        expect(screen.getByText(/3 comments/)).toBeInTheDocument()
    })

    it('should render View event button with correct link', () => {
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

    it('should render Sign up to RSVP button for unauthenticated users', () => {
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

    it('should render visibility badge', () => {
        render(
            <BrowserRouter>
                <EventCard event={mockEvent} formatter={mockFormatter} viewMode="list" />
            </BrowserRouter>
        )

        expect(screen.getByText(/Public/)).toBeInTheDocument()
    })
})
