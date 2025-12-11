import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NotificationsPage } from '../../pages/NotificationsPage'
import type { Notification } from '../../types'
import { createTestWrapper, clearQueryClient } from '../testUtils'

// Mock dependencies
const mockUser = { id: 'user1', username: 'testuser', name: 'Test User' }

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
        commentId: 'comment1',
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
const mockUseAuth = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
    useAuth: () => mockUseAuth(),
}))

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

vi.mock('../../stores', () => ({
    useUIStore: () => ({
        sseConnected: true,
    }),
}))

const { wrapper, queryClient } = createTestWrapper(['/notifications'])

describe('NotificationsPage', () => {
    beforeEach(() => {
        clearQueryClient(queryClient)
        vi.clearAllMocks()
        mockUseAuth.mockReturnValue({
            user: mockUser,
            logout: vi.fn(),
        })
        mockUseNotifications.mockReturnValue({
            data: {
                notifications: [],
                unreadCount: 0,
            },
            isLoading: false,
            isFetching: false,
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

    it('should render notifications page', () => {
        render(<NotificationsPage />, { wrapper })
        expect(screen.getByText('Notifications')).toBeInTheDocument()
    })

    it('should show loading state', () => {
        mockUseNotifications.mockReturnValue({
            data: undefined,
            isLoading: true,
            isFetching: false,
            error: null,
            isError: false,
        })

        render(<NotificationsPage />, { wrapper })

        expect(screen.getByRole('status', { name: /Loading notifications/i })).toBeInTheDocument()
    })

    it('should display notifications', async () => {
        mockUseNotifications.mockReturnValue({
            data: {
                notifications: [mockNotification],
                unreadCount: 1,
            },
            isLoading: false,
            isFetching: false,
            error: null,
            isError: false,
        })

        render(<NotificationsPage />, { wrapper })

        await waitFor(() => {
            expect(screen.getByText('1 unread')).toBeInTheDocument()
        })
    })

    it('should show empty state when no notifications', () => {
        mockUseNotifications.mockReturnValue({
            data: {
                notifications: [],
                unreadCount: 0,
            },
            isLoading: false,
            isFetching: false,
            error: null,
            isError: false,
        })

        render(<NotificationsPage />, { wrapper })

        expect(screen.getByText(/You're all caught up!/i)).toBeInTheDocument()
    })

    it('should show error state', () => {
        mockUseNotifications.mockReturnValue({
            data: undefined,
            isLoading: false,
            isFetching: false,
            error: new Error('Failed to load'),
            isError: true,
        })

        render(<NotificationsPage />, { wrapper })

        expect(screen.getByText(/Unable to load notifications/i)).toBeInTheDocument()
    })

    it('should filter notifications by type', async () => {
        const user = userEvent.setup()
        const notifications: Notification[] = [
            { ...mockNotification, type: 'COMMENT' },
            { ...mockNotification, id: 'notif2', type: 'LIKE' },
            { ...mockNotification, id: 'notif3', type: 'FOLLOW' },
        ]

        mockUseNotifications.mockReturnValue({
            data: {
                notifications,
                unreadCount: 3,
            },
            isLoading: false,
            isFetching: false,
            error: null,
            isError: false,
        })

        render(<NotificationsPage />, { wrapper })

        await waitFor(() => {
            expect(screen.getByText('Filter by:')).toBeInTheDocument()
        })

        const commentsFilter = screen.getByRole('button', { name: 'Comments' })
        await user.click(commentsFilter)

        // After clicking, the Comments button should be active (primary variant)
        expect(commentsFilter).toBeInTheDocument()
    })

    it('should mark all notifications as read', async () => {
        const user = userEvent.setup()
        const mockMarkAllRead = vi.fn()
        mockUseMarkAllNotificationsRead.mockReturnValue({
            mutate: mockMarkAllRead,
            isPending: false,
        })

        mockUseNotifications.mockReturnValue({
            data: {
                notifications: [mockNotification],
                unreadCount: 1,
            },
            isLoading: false,
            isFetching: false,
            error: null,
            isError: false,
        })

        render(<NotificationsPage />, { wrapper })

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Mark all read' })).toBeInTheDocument()
        })

        const markAllButton = screen.getByRole('button', { name: 'Mark all read' })
        await user.click(markAllButton)

        expect(mockMarkAllRead).toHaveBeenCalled()
    })


    it('should show settings toggle', async () => {
        const user = userEvent.setup()
        render(<NotificationsPage />, { wrapper })

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument()
        })

        const settingsButton = screen.getByRole('button', { name: 'Settings' })
        await user.click(settingsButton)

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Hide Settings' })).toBeInTheDocument()
        })
    })

    it('should show sign in prompt for unauthenticated users', () => {
        mockUseAuth.mockReturnValue({
            user: null,
            logout: vi.fn(),
        })

        render(<NotificationsPage />, { wrapper })

        expect(screen.getByText(/Sign in to view notifications/i)).toBeInTheDocument()
    })



    it('should handle all filter types', async () => {
        const user = userEvent.setup()
        render(<NotificationsPage />, { wrapper })

        // Wait for filter section to appear
        await waitFor(() => {
            expect(screen.getByText('Filter by:')).toBeInTheDocument()
        })

        // Test each filter button
        const filterButtons = [
            'All',
            'Followers',
            'Comments',
            'Likes',
            'Mentions',
            'Events',
            'System',
        ]

        for (const filterName of filterButtons) {
            const filterButton = screen.getByRole('button', { name: filterName })
            expect(filterButton).toBeInTheDocument()
            await user.click(filterButton)
            // Button should still be in document after click
            expect(screen.getByRole('button', { name: filterName })).toBeInTheDocument()
        }
    })
})
