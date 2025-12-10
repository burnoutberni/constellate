import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UserEventList } from './UserEventList'
import type { Event } from '../types'

const mockEvents: Event[] = [
    {
        id: '1',
        title: 'Test Event 1',
        summary: 'This is a test event summary',
        location: 'Test Location',
        startTime: '2024-01-15T18:00:00.000Z',
        endTime: '2024-01-15T20:00:00.000Z',
        timezone: 'UTC',
        headerImage: 'https://example.com/event1.jpg',
        userId: 'user1',
        tags: [],
        _count: {
            attendance: 10,
            likes: 5,
            comments: 3,
        },
    },
    {
        id: '2',
        title: 'Test Event 2',
        summary: 'Another test event',
        location: null,
        startTime: '2024-02-20T14:00:00.000Z',
        endTime: '2024-02-20T16:00:00.000Z',
        timezone: 'UTC',
        headerImage: null,
        userId: 'user1',
        tags: [],
        _count: {
            attendance: 15,
            likes: 8,
            comments: 2,
        },
    },
]

describe('UserEventList Component', () => {
    it('should render event list with events', () => {
        render(
            <UserEventList
                events={mockEvents}
                
                onEventClick={vi.fn()}
            />
        )

        expect(screen.getByText('Test Event 1')).toBeInTheDocument()
        expect(screen.getByText('Test Event 2')).toBeInTheDocument()
    })

    it('should display event summaries', () => {
        render(
            <UserEventList
                events={mockEvents}
                
                onEventClick={vi.fn()}
            />
        )

        expect(screen.getByText('This is a test event summary')).toBeInTheDocument()
        expect(screen.getByText('Another test event')).toBeInTheDocument()
    })

    it('should display event locations when available', () => {
        render(
            <UserEventList
                events={mockEvents}
                
                onEventClick={vi.fn()}
            />
        )

        expect(screen.getByText('Test Location')).toBeInTheDocument()
    })

    it('should display event stats', () => {
        render(
            <UserEventList
                events={mockEvents}
                
                onEventClick={vi.fn()}
            />
        )

        expect(screen.getByText('10 attending')).toBeInTheDocument()
        expect(screen.getByText('5 likes')).toBeInTheDocument()
        expect(screen.getByText('3 comments')).toBeInTheDocument()
    })

    it('should display header images when available', () => {
        render(
            <UserEventList
                events={mockEvents}
                
                onEventClick={vi.fn()}
            />
        )

        const headerImage = screen.getByAltText('Test Event 1')
        expect(headerImage).toBeInTheDocument()
        expect(headerImage).toHaveAttribute('src', 'https://example.com/event1.jpg')
    })

    it('should call onEventClick when event card is clicked', () => {
        const onEventClick = vi.fn()
        render(
            <UserEventList
                events={mockEvents}
                
                onEventClick={onEventClick}
            />
        )

        const eventCard = screen.getByText('Test Event 1').closest('[role="button"]')
        fireEvent.click(eventCard!)

        expect(onEventClick).toHaveBeenCalledWith('1')
    })

    it('should display empty state when no events', () => {
        render(
            <UserEventList
                events={[]}
                
                onEventClick={vi.fn()}
            />
        )

        expect(screen.getByText('No events yet')).toBeInTheDocument()
        expect(screen.getByText('📅')).toBeInTheDocument()
    })

    it('should handle events without counts gracefully', () => {
        const eventsWithoutCounts: Event[] = [
            {
                id: '3',
                title: 'Event Without Counts',
                summary: null,
                location: null,
                startTime: '2024-03-01T10:00:00.000Z',
                endTime: null,
                timezone: 'UTC',
                headerImage: null,
                userId: 'user1',
                tags: [],
                _count: undefined,
            },
        ]

        render(
            <UserEventList
                events={eventsWithoutCounts}
                
                onEventClick={vi.fn()}
            />
        )

        expect(screen.getByText('0 attending')).toBeInTheDocument()
        expect(screen.getByText('0 likes')).toBeInTheDocument()
        expect(screen.getByText('0 comments')).toBeInTheDocument()
    })

    it('should format dates correctly', () => {
        render(
            <UserEventList
                events={[mockEvents[0]]}
                
                onEventClick={vi.fn()}
            />
        )

        // Check that date is formatted (exact format depends on locale)
        const dateElement = screen.getByText(/January 15, 2024/i)
        expect(dateElement).toBeInTheDocument()
    })

    it('should be keyboard accessible', () => {
        const onEventClick = vi.fn()
        render(
            <UserEventList
                events={mockEvents}
                
                onEventClick={onEventClick}
            />
        )

        const eventCard = screen.getByText('Test Event 1').closest('[role="button"]')
        
        // Simulate Enter key press
        fireEvent.keyDown(eventCard!, { key: 'Enter', code: 'Enter' })
        
        expect(onEventClick).toHaveBeenCalledWith('1')
    })
})
