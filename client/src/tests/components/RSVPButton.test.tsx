import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RSVPButton } from '../../components/RSVPButton'
import { createTestWrapper } from '../testUtils'

// Mock the useRSVP hook
const mockRSVP = vi.fn()
const mockIsPending = vi.fn(() => false)

vi.mock('../../hooks/queries', () => ({
    useRSVP: () => ({
        mutate: mockRSVP,
        isPending: mockIsPending(),
    }),
}))

const renderRSVPButton = (props: Parameters<typeof RSVPButton>[0]) => {
    const { wrapper } = createTestWrapper()
    const user = userEvent.setup()
    return {
        user,
        ...render(<RSVPButton {...props} />, { wrapper }),
    }
}

describe('RSVPButton', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockIsPending.mockReturnValue(false)
    })

    describe('User can interact with RSVP menu', () => {
        it('user can open menu and select attending status', async () => {
            const { user } = renderRSVPButton({
                eventId: 'event-1',
                isAuthenticated: true,
            })

            // Find and click the dropdown button (has "Open options" text)
            const buttons = screen.getAllByRole('button')
            const dropdownButton = buttons.find(btn => btn.getAttribute('aria-haspopup') === 'true')
            expect(dropdownButton).toBeDefined()

            if (!dropdownButton) throw new Error('Dropdown button not found'); await user.click(dropdownButton)

            // Menu options should appear
            expect(screen.getAllByRole("menuitem").length).toBeGreaterThan(0)
            expect(screen.getByText('Maybe')).toBeInTheDocument()
            expect(screen.getByText('Not Going')).toBeInTheDocument()

            // Select "Going"
            const menuItems = screen.getAllByRole("menuitem"); await user.click(menuItems[0])

            // RSVP should be called
            expect(mockRSVP).toHaveBeenCalledWith({ status: 'attending' })
        })

        it('user can change from attending to maybe', async () => {
            const { user } = renderRSVPButton({
                eventId: 'event-1',
                currentStatus: 'attending',
                isAuthenticated: true,
            })

            // Open menu
            const buttons = screen.getAllByRole('button')
            const dropdownButton = buttons.find(btn => btn.getAttribute('aria-haspopup') === 'true')
            if (!dropdownButton) throw new Error('Dropdown button not found')
            await user.click(dropdownButton)

            // Change to "Maybe"
            await user.click(screen.getByText('Maybe'))

            expect(mockRSVP).toHaveBeenCalledWith({ status: 'maybe' })
        })

        it('menu closes after selecting a status', async () => {
            const { user } = renderRSVPButton({
                eventId: 'event-1',
                isAuthenticated: true,
            })

            // Open menu
            const buttons = screen.getAllByRole('button')
            const dropdownButton = buttons.find(btn => btn.getAttribute('aria-haspopup') === 'true')
            if (!dropdownButton) throw new Error('Dropdown button not found')
            await user.click(dropdownButton)

            expect(screen.getAllByRole("menuitem").length).toBeGreaterThan(0)

            // Select status
            const menuItems = screen.getAllByRole("menuitem"); await user.click(menuItems[0])

            // Menu should close
            await waitFor(() => {
                expect(screen.queryAllByRole("menuitem").length).toBe(0)
            })
        })
    })

    describe('Keyboard navigation works', () => {
        it('menu closes with Escape key', async () => {
            const { user } = renderRSVPButton({
                eventId: 'event-1',
                isAuthenticated: true,
            })

            // Open menu
            const buttons = screen.getAllByRole('button')
            const dropdownButton = buttons.find(btn => btn.getAttribute('aria-haspopup') === 'true')
            if (!dropdownButton) throw new Error('Dropdown button not found')
            await user.click(dropdownButton)

            expect(screen.getByText('Not Going')).toBeInTheDocument()

            // Press Escape
            await user.keyboard('{Escape}')

            // Menu should close
            await waitFor(() => {
                expect(screen.queryAllByRole("menuitem").length).toBe(0)
            })
        })

        it('menu closes when clicking outside', async () => {
            const { user } = renderRSVPButton({
                eventId: 'event-1',
                isAuthenticated: true,
            })

            // Open menu
            const buttons = screen.getAllByRole('button')
            const dropdownButton = buttons.find(btn => btn.getAttribute('aria-haspopup') === 'true')
            if (!dropdownButton) throw new Error('Dropdown button not found')
            await user.click(dropdownButton)

            expect(screen.getByText('Maybe')).toBeInTheDocument()

            // Click outside
            await user.click(document.body)

            // Menu should close
            await waitFor(() => {
                expect(screen.queryByText('Not Going')).not.toBeInTheDocument()
            })
        })
    })

    describe('Loading state appears correctly', () => {
        it('shows loading indicator during RSVP submission', async () => {
            mockIsPending.mockReturnValue(true)

            renderRSVPButton({
                eventId: 'event-1',
                currentStatus: 'attending',
                isAuthenticated: true,
            })

            // Should show loading spinner
            const loadingSpinner = screen.getByLabelText(/loading/i)
            expect(loadingSpinner).toBeInTheDocument()
        })

        it('button is disabled during loading', async () => {
            mockIsPending.mockReturnValue(true)

            renderRSVPButton({
                eventId: 'event-1',
                isAuthenticated: true,
            })

            // Main button should be disabled
            const buttons = screen.getAllByRole('button')
            const mainButton = buttons.find(btn => btn.getAttribute('aria-busy') === 'true')
            expect(mainButton).toBeDefined()
            expect(mainButton).toBeDisabled()
        })
    })

    describe('Parent component is notified of menu state', () => {
        it('parent is notified when menu opens', async () => {
            const mockOnOpenChange = vi.fn()
            const { user } = renderRSVPButton({
                eventId: 'event-1',
                isAuthenticated: true,
                onOpenChange: mockOnOpenChange,
            })

            // Open menu
            const buttons = screen.getAllByRole('button')
            const dropdownButton = buttons.find(btn => btn.getAttribute('aria-haspopup') === 'true')
            if (!dropdownButton) throw new Error('Dropdown button not found')
            await user.click(dropdownButton)

            // Parent should be notified
            await waitFor(() => {
                expect(mockOnOpenChange).toHaveBeenCalledWith(true)
            })
        })

        it('parent is notified when menu closes', async () => {
            const mockOnOpenChange = vi.fn()
            const { user } = renderRSVPButton({
                eventId: 'event-1',
                isAuthenticated: true,
                onOpenChange: mockOnOpenChange,
            })

            // Open menu
            const buttons = screen.getAllByRole('button')
            const dropdownButton = buttons.find(btn => btn.getAttribute('aria-haspopup') === 'true')
            if (!dropdownButton) throw new Error('Dropdown button not found')
            await user.click(dropdownButton)

            mockOnOpenChange.mockClear()

            // Close menu
            await user.keyboard('{Escape}')

            // Parent should be notified
            await waitFor(() => {
                expect(mockOnOpenChange).toHaveBeenCalledWith(false)
            })
        })
    })

    describe('Visual feedback for different states', () => {
        it('shows Going text when attending', () => {
            renderRSVPButton({
                eventId: 'event-1',
                currentStatus: 'attending',
                isAuthenticated: true,
            })

            expect(screen.getByText('Going')).toBeInTheDocument()
        })

        it('shows Maybe text when status is maybe', () => {
            renderRSVPButton({
                eventId: 'event-1',
                currentStatus: 'maybe',
                isAuthenticated: true,
            })

            expect(screen.getByText('Maybe')).toBeInTheDocument()
        })

        it('shows Not Going text when not attending', () => {
            renderRSVPButton({
                eventId: 'event-1',
                currentStatus: 'not_attending',
                isAuthenticated: true,
            })

            expect(screen.getByText('Not Going')).toBeInTheDocument()
        })

        it('shows RSVP text when no status set', () => {
            renderRSVPButton({
                eventId: 'event-1',
                currentStatus: null,
                isAuthenticated: true,
            })

            expect(screen.getByText('Going')).toBeInTheDocument()
        })
    })

    describe('Unauthenticated user experience', () => {
        it('shows sign up prompt for unauthenticated users', async () => {
            const mockOnSignUp = vi.fn()
            const { user } = renderRSVPButton({
                eventId: 'event-1',
                isAuthenticated: false,
                onSignUp: mockOnSignUp,
            })

            // Click main RSVP button
            const rsvpButton = screen.getByText('Going')
            await user.click(rsvpButton)

            // Should call onSignUp
            expect(mockOnSignUp).toHaveBeenCalled()
            // Menu should not open
            expect(screen.queryByText('Maybe')).not.toBeInTheDocument()
        })
    })
})
