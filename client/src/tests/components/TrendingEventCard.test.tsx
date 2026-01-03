import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { TrendingEventCard } from '../../components/Feed/TrendingEventCard'
import { createTestWrapper } from '../testUtils'

const mockEvent = {
    id: 'e1',
    title: 'Popular Party',
    startTime: new Date().toISOString(),
    visibility: 'PUBLIC',
    trendingRank: 1,
    trendingScore: 50.5,
    user: { username: 'host' },
    tags: [{ id: 't1', tag: 'party' }]
}

const { wrapper } = createTestWrapper()

describe('TrendingEventCard', () => {
    it('should render event details', () => {
        render(<TrendingEventCard event={mockEvent} showRank={true} />, { wrapper })

        expect(screen.getByText('Popular Party')).toBeInTheDocument()
        expect(screen.getByText('#1')).toBeInTheDocument()
        expect(screen.getByText(/50.5/)).toBeInTheDocument()
        expect(screen.getByText('#party')).toBeInTheDocument()
    })

    it('should link to event detail', () => {
        render(<TrendingEventCard event={mockEvent} />, { wrapper })
        const link = screen.getByRole('link')
        expect(link).toHaveAttribute('href', '/@host/e1')
    })
})
