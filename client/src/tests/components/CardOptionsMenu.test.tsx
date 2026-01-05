import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { CardOptionsMenu } from '../../components/CardOptionsMenu'
import type { Event } from '../../types'
import { createTestWrapper } from '../testUtils'

// Mock dependencies
// Note: CardOptionsMenu uses ReportContentModal component directly, not the global store
vi.mock('../../components/ReportContentModal', () => ({
    ReportContentModal: ({ isOpen }: { isOpen: boolean }) => (
        isOpen ? <div data-testid="report-modal">Report Modal Open</div> : null
    ),
}))

const createMockEvent = (overrides?: Partial<Event>): Event => ({
    id: '1',
    title: 'Test Event',
    summary: 'Test summary',
    location: 'Test Location',
    startTime: '2024-01-15T10:00:00Z',
    endTime: '2024-01-15T12:00:00Z',
    timezone: 'UTC',
    visibility: 'PUBLIC',
    tags: [],
    user: {
        id: 'user1',
        username: 'testuser',
        name: 'Test User',
        isRemote: false,
    },
    _count: {
        attendance: 0,
        likes: 0,
        comments: 0,
    },
    ...overrides,
})

const renderCardOptionsMenu = (event: Event) => {
    const { wrapper } = createTestWrapper()
    const user = userEvent.setup()
    return {
        user,
        ...render(<CardOptionsMenu event={event} />, { wrapper })
    }
}

describe('CardOptionsMenu', () => {
    it('renders trigger button', () => {
        const event = createMockEvent()
        renderCardOptionsMenu(event)
        expect(screen.getByText('⋮')).toBeInTheDocument()
    })

    it('opens menu and shows options when clicked', async () => {
        const event = createMockEvent()
        const { user } = renderCardOptionsMenu(event)

        await user.click(screen.getByText('⋮'))

        expect(screen.getByText('Report Event')).toBeInTheDocument()
    })

    it('opens report modal when report option is clicked', async () => {
        const event = createMockEvent()
        const { user } = renderCardOptionsMenu(event)

        await user.click(screen.getByText('⋮'))
        await user.click(screen.getByText('Report Event'))

        // Verify mocked modal is visible, confirming interactions worked
        expect(screen.getByTestId('report-modal')).toBeInTheDocument()
    })
})
