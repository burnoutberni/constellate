import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CalendarView } from '../components/CalendarView'
import type { Event } from '@/types'

// Mock SafeHTML since it might need specific setup or be complex
vi.mock('../components/ui', async () => {
    const actual = await vi.importActual('../components/ui')
    return {
        ...actual,
        SafeHTML: ({ html }: { html: string }) => <div data-testid="safe-html">{html}</div>,
        Spinner: () => <div data-testid="spinner">Loading...</div>
    }
})

describe('CalendarView Integration', () => {
    const mockDate = new Date('2025-12-15T12:00:00Z')

    const mockEvents: Event[] = [
        {
            id: '1',
            title: 'Morning Meeting',
            startTime: '2025-12-15T10:00:00.000Z',
            endTime: '2025-12-15T11:00:00.000Z',
            timezone: 'UTC',
            tags: [],
            viewerStatus: 'attending'
        },
        {
            id: '2',
            title: 'Lunch Break',
            startTime: '2025-12-15T13:00:00.000Z',
            timezone: 'UTC',
            tags: [],
            viewerStatus: 'maybe'
        }
    ]

    it('renders month view correctly', () => {
        render(
            <CalendarView
                view="month"
                currentDate={mockDate}
                events={mockEvents}
                loading={false}
            />
        )

        expect(screen.getByText('Morning Meeting')).toBeInTheDocument()
        expect(screen.getByText('Lunch Break')).toBeInTheDocument()
        expect(screen.getByText('15')).toBeInTheDocument() // Day of month

        // Verify empty days don't crash and render correctly (e.g. adjacent days)
        expect(screen.getByText('14')).toBeInTheDocument()
        expect(screen.getByText('16')).toBeInTheDocument()
    })

    it('renders week view correctly', () => {
        render(
            <CalendarView
                view="week"
                currentDate={mockDate}
                events={mockEvents}
                loading={false}
            />
        )

        // In week view, events might be rendered differently, but title should be there.
        // Also verify empty slots render (implicitly verified by no crash)
        expect(screen.getByText('Morning Meeting', { exact: false })).toBeInTheDocument()
    })

    it('renders day view correctly', () => {
        render(
            <CalendarView
                view="day"
                currentDate={mockDate}
                events={mockEvents}
                loading={false}
            />
        )

        // Similar check for day view
        expect(screen.getByText('Morning Meeting')).toBeInTheDocument()
    })
})
