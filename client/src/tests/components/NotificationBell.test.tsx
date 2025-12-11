import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NotificationBell } from '../../components/NotificationBell'
import type { Notification } from '../../types'
import { createTestWrapper, clearQueryClient } from '../testUtils'

// Mock dependencies
const mockNotification: Notification = {
    id: 'notif1',
    type: 'COMMENT',
    read: false,
    title: 'New comment on Test Event',
    body: 'Other User commented on your event',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
    contextUrl: '/events/event1',
    data: {
        eventId: 'event1',
        eventTitle: 'Test Event',
    },
    actor: {
        id: 'user2',
        username: 'otheruser',
        name: 'Other User',
    },
}

const mockUseNotifications = vi.fn()
const mockUseMarkNotificationRead = vi.fn()
const mockUseMarkAllNotificationsRead = vi.fn()
const mockNavigate = vi.fn()

vi.mock('../../hooks/queries/notifications', () => ({
    useNotifications: () => mockUseNotifications(),
    useMarkNotificationRead: () => mockUseMarkNotificationRead(),
    useMarkAllNotificationsRead: () => mockUseMarkAllNotificationsRead(),
}))

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom')
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    }
})

const { wrapper, queryClient } = createTestWrapper()

describe('NotificationBell', () => {
    beforeEach(() => {
        clearQueryClient(queryClient)
        vi.clearAllMocks()
        mockUseNotifications.mockReturnValue({
            data: {
                notifications: [],
                unreadCount: 0,
            },
            isLoading: false,
            error: null,
            isError: false,
        })
        mockUseMarkNotificationRead.mockReturnValue({
            mutate: vi.fn(),
        })
        mockUseMarkAllNotificationsRead.mockReturnValue({
            mutate: vi.fn(),
            isPending: false,
        })
    })

    afterEach(() => {
        clearQueryClient(queryClient)
    })

    it('should not render when userId is not provided', () => {
        render(<NotificationBell />, { wrapper })
        expect(screen.queryByLabelText(/Notifications/i)).not.toBeInTheDocument()
    })

    it('should render bell icon', () => {
        render(<NotificationBell userId="user1" />, { wrapper })
        expect(screen.getByLabelText(/Notifications/i)).toBeInTheDocument()
    })

    it('should show unread count badge', () => {
        mockUseNotifications.mockReturnValue({
            data: {
                notifications: [mockNotification],
                unreadCount: 5,
            },
            isLoading: false,
            error: null,
            isError: false,
        })

        render(<NotificationBell userId="user1" />, { wrapper })
        // Badge renders the number directly
        const badges = screen.getAllByText('5')
        expect(badges.length).toBeGreaterThan(0)
    })

    it('should show 9+ for counts over 9', () => {
        mockUseNotifications.mockReturnValue({
            data: {
                notifications: [],
                unreadCount: 15,
            },
            isLoading: false,
            error: null,
            isError: false,
        })

        render(<NotificationBell userId="user1" />, { wrapper })
        // Badge renders "9+" for counts over 9
        const badges = screen.getAllByText('9+')
        expect(badges.length).toBeGreaterThan(0)
    })

    it('should open dropdown on click', async () => {
        const user = userEvent.setup()
        render(<NotificationBell userId="user1" />, { wrapper })

        const bellButton = screen.getByLabelText(/Notifications/i)
        await user.click(bellButton)

        await waitFor(() => {
            expect(screen.getByText(/Notifications/i)).toBeInTheDocument()
        })
    })

    it('should close dropdown on outside click', async () => {
        const user = userEvent.setup()
        render(<NotificationBell userId="user1" />, { wrapper })

        const bellButton = screen.getByLabelText(/Notifications/i)
        await user.click(bellButton)

        await waitFor(() => {
            expect(screen.getByText(/Notifications/i)).toBeInTheDocument()
        })

        await user.click(document.body)

        await waitFor(() => {
            expect(screen.queryByText(/All caught up/i)).not.toBeInTheDocument()
        })
    })

    it('should close dropdown on Escape key', async () => {
        const user = userEvent.setup()
        render(<NotificationBell userId="user1" />, { wrapper })

        const bellButton = screen.getByLabelText(/Notifications/i)
        await user.click(bellButton)

        await waitFor(() => {
            expect(screen.getByText(/Notifications/i)).toBeInTheDocument()
        })

        await user.keyboard('{Escape}')

        await waitFor(() => {
            expect(screen.queryByText(/All caught up/i)).not.toBeInTheDocument()
        })
    })

    it('should show loading state', async () => {
        const user = userEvent.setup()
        mockUseNotifications.mockReturnValue({
            data: undefined,
            isLoading: true,
            error: null,
            isError: false,
        })

        render(<NotificationBell userId="user1" />, { wrapper })

        const bellButton = screen.getByLabelText(/Notifications/i)
        await user.click(bellButton)

        await waitFor(() => {
            expect(screen.getByRole('status', { name: /Loading notifications/i })).toBeInTheDocument()
        })
    })

    it('should show error state', async () => {
        const user = userEvent.setup()
        mockUseNotifications.mockReturnValue({
            data: undefined,
            isLoading: false,
            error: new Error('Failed to load'),
            isError: true,
        })

        render(<NotificationBell userId="user1" />, { wrapper })

        const bellButton = screen.getByLabelText(/Notifications/i)
        await user.click(bellButton)

        await waitFor(() => {
            expect(screen.getByText('Unable to load notifications')).toBeInTheDocument()
        })
    })

    it('should show empty state', async () => {
        const user = userEvent.setup()
        mockUseNotifications.mockReturnValue({
            data: {
                notifications: [],
                unreadCount: 0,
            },
            isLoading: false,
            error: null,
            isError: false,
        })

        render(<NotificationBell userId="user1" />, { wrapper })

        const bellButton = screen.getByLabelText(/Notifications/i)
        await user.click(bellButton)

        await waitFor(() => {
            expect(screen.getByText(/Nothing new just yet/i)).toBeInTheDocument()
        })
    })

    it('should display notifications in dropdown', async () => {
        const user = userEvent.setup()
        // Set up mock before rendering
        mockUseNotifications.mockReturnValue({
            data: {
                notifications: [mockNotification],
                unreadCount: 1,
            },
            isLoading: false,
            error: null,
            isError: false,
        })

        render(<NotificationBell userId="user1" />, { wrapper })

        const bellButton = screen.getByLabelText(/Notifications/i)
        await user.click(bellButton)

        // Wait for dropdown to open and show unread count
        await waitFor(() => {
            expect(screen.getByText('1 unread')).toBeInTheDocument()
        })
    })

    it('should mark all notifications as read when button is clicked', async () => {
        const user = userEvent.setup()
        const mockMarkAllRead = vi.fn()
        
        // Set up mocks before rendering
        mockUseNotifications.mockReturnValue({
            data: {
                notifications: [mockNotification],
                unreadCount: 1,
            },
            isLoading: false,
            error: null,
            isError: false,
        })
        
        mockUseMarkAllNotificationsRead.mockReturnValue({
            mutate: mockMarkAllRead,
            isPending: false,
        })

        render(<NotificationBell userId="user1" />, { wrapper })

        const bellButton = screen.getByLabelText(/Notifications/i)
        await user.click(bellButton)

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Mark all read' })).toBeInTheDocument()
        })

        const markAllButton = screen.getByRole('button', { name: 'Mark all read' })
        expect(markAllButton).not.toBeDisabled()
        await user.click(markAllButton)

        // User clicked the button, so the action should be triggered
        expect(mockMarkAllRead).toHaveBeenCalled()
    })

    it('should navigate to notifications page', async () => {
        const user = userEvent.setup()
        render(<NotificationBell userId="user1" />, { wrapper })

        const bellButton = screen.getByLabelText(/Notifications/i)
        await user.click(bellButton)

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /View all/i })).toBeInTheDocument()
        })

        const viewAllButton = screen.getByRole('button', { name: /View all/i })
        await user.click(viewAllButton)

        expect(mockNavigate).toHaveBeenCalledWith('/notifications')
    })

})
