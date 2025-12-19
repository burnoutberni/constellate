import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { CalendarView } from '../components/CalendarView'
import { createTestWrapper } from './testUtils'
import type { Event } from '../types/event'

const mockEvent: Event = {
    id: '1',
    title: 'Test Event',
    startTime: new Date('2025-01-15T10:00:00Z').toISOString(),
    endTime: new Date('2025-01-15T11:00:00Z').toISOString(),
    timezone: 'UTC',
    tags: []
}

describe('CalendarView Rendering', () => {
    it('renders month view correctly', () => {
        const { wrapper } = createTestWrapper()
        render(
            <CalendarView
                view="month"
                currentDate={new Date('2025-01-01')}
                events={[mockEvent]}
                loading={false}
            />,
            { wrapper }
        )
        expect(screen.getByText('Test Event')).toBeInTheDocument()
    })

     it('renders week view correctly', () => {
        const { wrapper } = createTestWrapper()
        render(
            <CalendarView
                view="week"
                currentDate={new Date('2025-01-15')}
                events={[mockEvent]}
                loading={false}
            />,
            { wrapper }
        )
        expect(screen.getByText('Test Event')).toBeInTheDocument()
    })

     it('renders day view correctly', () => {
        const { wrapper } = createTestWrapper()
        render(
            <CalendarView
                view="day"
                currentDate={new Date('2025-01-15')}
                events={[mockEvent]}
                loading={false}
            />,
            { wrapper }
        )
        expect(screen.getByText('Test Event')).toBeInTheDocument()
    })

    it('renders month view with no events without crashing', () => {
        const { wrapper } = createTestWrapper()
        render(
            <CalendarView
                view="month"
                currentDate={new Date('2025-01-01')}
                events={[]}
                loading={false}
            />,
            { wrapper }
        )
        // Should find day 1
        expect(screen.getByText('1')).toBeInTheDocument()
    })
})
