import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '../../design-system'
import { type ReactNode } from 'react'
import { AttendeeList } from '../../components/AttendeeList'
import type { Attendee } from '../../components/AttendeeList'

// Mock dependencies
const mockAttendees: Attendee[] = [
    {
        user: {
            id: 'user1',
            username: 'testuser',
            name: 'Test User',
            profileImage: null,
            displayColor: null,
        },
        status: 'attending',
    },
    {
        user: {
            id: 'user2',
            username: 'otheruser',
            name: 'Other User',
            profileImage: null,
            displayColor: null,
        },
        status: 'maybe',
    },
]

const createWrapper = () => {
    return ({ children }: { children: ReactNode }) => (
        <ThemeProvider defaultTheme="light">
            <MemoryRouter>{children}</MemoryRouter>
        </ThemeProvider>
    )
}

describe('AttendeeList', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should render attendee list', () => {
        render(<AttendeeList attendees={mockAttendees} />, { wrapper: createWrapper() })

        expect(screen.getByText('Test User')).toBeInTheDocument()
        expect(screen.getByText('Other User')).toBeInTheDocument()
    })

    it('should not render when no attendees', () => {
        const { container } = render(<AttendeeList attendees={[]} />, { wrapper: createWrapper() })

        expect(container.firstChild).toBeNull()
    })

    it('should group attendees by status', () => {
        render(<AttendeeList attendees={mockAttendees} />, { wrapper: createWrapper() })

        // "Going" may appear multiple times (in header and in status)
        expect(screen.getAllByText(/Going/i).length).toBeGreaterThan(0)
        // "Maybe" may appear multiple times (in header and in status)
        expect(screen.getAllByText(/Maybe/i).length).toBeGreaterThan(0)
    })

    it('should display attendee counts', () => {
        render(<AttendeeList attendees={mockAttendees} />, { wrapper: createWrapper() })

        expect(screen.getByText(/Attendees \(1 going, 1 maybe\)/i)).toBeInTheDocument()
    })

    it('should display user avatars', () => {
        render(<AttendeeList attendees={mockAttendees} />, { wrapper: createWrapper() })

        expect(screen.getByText('Test User')).toBeInTheDocument()
        expect(screen.getByText('Other User')).toBeInTheDocument()
    })

    it('should link to user profiles', () => {
        render(<AttendeeList attendees={mockAttendees} />, { wrapper: createWrapper() })

        const userLink = screen.getByText('Test User').closest('a')
        expect(userLink).toHaveAttribute('href', '/@testuser')
    })

    it('should handle missing user name', () => {
        const attendeeWithoutName: Attendee = {
            user: {
                id: 'user3',
                username: 'nonameuser',
                name: null,
                profileImage: null,
                displayColor: null,
            },
            status: 'attending',
        }

        render(<AttendeeList attendees={[attendeeWithoutName]} />, { wrapper: createWrapper() })

        expect(screen.getByText('nonameuser')).toBeInTheDocument()
    })

    it('should limit displayed attendees', async () => {
        const user = userEvent.setup()
        const manyAttendees: Attendee[] = Array.from({ length: 15 }, (_, i) => ({
            user: {
                id: `user${i}`,
                username: `user${i}`,
                name: `User ${i}`,
                profileImage: null,
                displayColor: null,
            },
            status: 'attending',
        }))

        render(<AttendeeList attendees={manyAttendees} initialDisplayCount={10} />, {
            wrapper: createWrapper(),
        })

        expect(screen.getByText(/\+5 more/i)).toBeInTheDocument()

        const showMoreButton = screen.getByText(/\+5 more/i)
        await user.click(showMoreButton)

        expect(screen.getByText(/Show less/i)).toBeInTheDocument()
    })

    it('should show less button when expanded', async () => {
        const user = userEvent.setup()
        const manyAttendees: Attendee[] = Array.from({ length: 15 }, (_, i) => ({
            user: {
                id: `user${i}`,
                username: `user${i}`,
                name: `User ${i}`,
                profileImage: null,
                displayColor: null,
            },
            status: 'attending',
        }))

        render(<AttendeeList attendees={manyAttendees} initialDisplayCount={10} />, {
            wrapper: createWrapper(),
        })

        const showMoreButton = screen.getByText(/\+5 more/i)
        await user.click(showMoreButton)

        const showLessButton = screen.getByText(/Show less/i)
        await user.click(showLessButton)

        expect(screen.getByText(/\+5 more/i)).toBeInTheDocument()
    })

    it('should hide avatars when showAvatars is false', () => {
        render(<AttendeeList attendees={mockAttendees} showAvatars={false} />, {
            wrapper: createWrapper(),
        })

        // Should show badges instead of avatars
        expect(screen.getByText('Test User')).toBeInTheDocument()
    })

    it('should display maybe status in badges when avatars hidden', () => {
        render(<AttendeeList attendees={mockAttendees} showAvatars={false} />, {
            wrapper: createWrapper(),
        })

        expect(screen.getByText(/Other User.*Maybe/i)).toBeInTheDocument()
    })
})
