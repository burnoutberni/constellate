import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CalendarView } from '../components/CalendarView'
import type { Event } from '../types'
import { createTestWrapper } from './testUtils'
import React from 'react'

// Mock SafeHTML
vi.mock('../components/ui', async () => {
    const actual = await vi.importActual('../components/ui')
    return {
        ...actual,
        SafeHTML: ({ html }: { html: string }) => <div data-testid="safe-html">{html}</div>
    }
})

describe('CalendarView Integration', () => {
    const { wrapper } = createTestWrapper()

    // Dec 15 2025 is a Monday
    const currentDate = new Date('2025-12-15T12:00:00')

    const mockEvents: Event[] = [
        {
            id: '1',
            title: 'Morning Meeting',
            // 9 AM Local time (assuming test runs in local time, but toISOString is UTC)
            // We construct dates using local string to ensure they map to correct hours in component
            startTime: new Date('2025-12-15T09:00:00').toISOString(),
            endTime: new Date('2025-12-15T10:00:00').toISOString(),
            location: 'Room A',
            description: 'Discuss updates',
            viewerStatus: 'attending',
            timezone: 'UTC',
            tags: [],
            authorId: 'user1',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            _count: { likes: 0, comments: 0, participants: 1 }
        } as unknown as Event,
        {
            id: '2',
            title: 'Lunch Break',
            startTime: new Date('2025-12-15T12:00:00').toISOString(),
            endTime: new Date('2025-12-15T13:00:00').toISOString(),
            viewerStatus: 'maybe',
             timezone: 'UTC',
            tags: [],
            authorId: 'user1',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            _count: { likes: 0, comments: 0, participants: 1 }
        } as unknown as Event,
        {
            id: '3',
            title: 'Next Day Event',
            startTime: new Date('2025-12-16T14:00:00').toISOString(),
            endTime: new Date('2025-12-16T15:00:00').toISOString(),
             timezone: 'UTC',
            tags: [],
            authorId: 'user1',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            _count: { likes: 0, comments: 0, participants: 1 }
        } as unknown as Event
    ]

    it('renders Month view correctly', () => {
        render(
            <CalendarView
                view="month"
                currentDate={currentDate}
                events={mockEvents}
                loading={false}
            />,
            { wrapper }
        )

        expect(screen.getByText('Morning Meeting')).toBeInTheDocument()
        expect(screen.getByText('Lunch Break')).toBeInTheDocument()
        expect(screen.getByText('Next Day Event')).toBeInTheDocument()
        expect(screen.getByText('Mon')).toBeInTheDocument()
    })

    it('renders Week view correctly', () => {
        render(
            <CalendarView
                view="week"
                currentDate={currentDate}
                events={mockEvents}
                loading={false}
            />,
            { wrapper }
        )

        expect(screen.getByText('Morning Meeting')).toBeInTheDocument()
        expect(screen.getByText('Lunch Break')).toBeInTheDocument()
        expect(screen.getByText('Next Day Event')).toBeInTheDocument()
    })

    it('renders Day view correctly', () => {
        render(
            <CalendarView
                view="day"
                currentDate={currentDate}
                events={mockEvents}
                loading={false}
            />,
            { wrapper }
        )

        expect(screen.getByText('Morning Meeting')).toBeInTheDocument()
        expect(screen.getByText('Lunch Break')).toBeInTheDocument()
        expect(screen.queryByText('Next Day Event')).not.toBeInTheDocument()
    })
})
