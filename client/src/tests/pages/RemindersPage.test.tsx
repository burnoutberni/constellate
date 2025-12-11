import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { RemindersPage } from '../../pages/RemindersPage'
import type { ReminderWithEvent } from '../../types'
import { createTestWrapper, clearQueryClient } from '../testUtils'

// Mock dependencies
const mockUser = { id: 'user1', username: 'testuser', name: 'Test User' }
const mockReminder: ReminderWithEvent = {
    id: 'reminder1',
    eventId: 'event1',
    userId: 'user1',
    reminderTime: new Date('2024-01-15T09:00:00Z'),
    status: 'PENDING',
    createdAt: new Date('2024-01-10T10:00:00Z'),
    event: {
        id: 'event1',
        title: 'Test Event',
        summary: 'Test summary',
        startTime: '2024-01-15T10:00:00Z',
        endTime: '2024-01-15T12:00:00Z',
        visibility: 'PUBLIC',
        tags: [],
        user: {
            id: 'user1',
            username: 'testuser',
            name: 'Test User',
            isRemote: false,
        },
        _count: {
            attendance: 10,
            likes: 5,
            comments: 3,
        },
    },
}

const mockUseUserReminders = vi.fn()
const mockNavigate = vi.fn()
const mockUseAuth = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
    useAuth: () => mockUseAuth(),
}))

const mockUseDeleteReminder = vi.fn()

vi.mock('../../hooks/queries/reminders', () => ({
    useUserReminders: () => mockUseUserReminders(),
    useDeleteReminder: () => mockUseDeleteReminder(),
}))

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom')
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    }
})

const { wrapper, queryClient } = createTestWrapper(['/reminders'])

describe('RemindersPage', () => {
    beforeEach(() => {
        clearQueryClient(queryClient)
        vi.clearAllMocks()
        mockUseAuth.mockReturnValue({
            user: mockUser,
            loading: false,
        })
        mockUseUserReminders.mockReturnValue({
            data: {
                reminders: [],
            },
            isLoading: false,
            error: null,
        })
        mockUseDeleteReminder.mockReturnValue({
            mutate: vi.fn(),
            isPending: false,
        })
    })

    afterEach(() => {
        clearQueryClient(queryClient)
    })

    it('should render reminders page', () => {
        render(<RemindersPage />, { wrapper })
        expect(screen.getByText('My Reminders')).toBeInTheDocument()
    })


    it('should show loading state', () => {
        mockUseUserReminders.mockReturnValue({
            data: undefined,
            isLoading: true,
            error: null,
        })

        render(<RemindersPage />, { wrapper })

        expect(screen.getByText('Loading reminders...')).toBeInTheDocument()
    })

    it('should display reminders list', async () => {
        mockUseUserReminders.mockReturnValue({
            data: {
                reminders: [mockReminder],
            },
            isLoading: false,
            error: null,
        })

        render(<RemindersPage />, { wrapper })

        await waitFor(() => {
            expect(screen.getByText('Test Event')).toBeInTheDocument()
        })
    })

    it('should show empty state when no reminders', () => {
        mockUseUserReminders.mockReturnValue({
            data: {
                reminders: [],
            },
            isLoading: false,
            error: null,
        })

        render(<RemindersPage />, { wrapper })

        expect(screen.getByText('No reminders yet')).toBeInTheDocument()
    })

    it('should show error state', () => {
        mockUseUserReminders.mockReturnValue({
            data: undefined,
            isLoading: false,
            error: new Error('Failed to load reminders'),
        })

        render(<RemindersPage />, { wrapper })

        // Error message appears in both heading and paragraph
        expect(screen.getAllByText('Failed to load reminders').length).toBeGreaterThan(0)
    })


    it('should group reminders by status', async () => {
        const reminders: ReminderWithEvent[] = [
            { ...mockReminder, status: 'PENDING' },
            { ...mockReminder, id: 'reminder2', status: 'SENT' },
            { ...mockReminder, id: 'reminder3', status: 'FAILED' },
        ]

        mockUseUserReminders.mockReturnValue({
            data: {
                reminders,
            },
            isLoading: false,
            error: null,
        })

        render(<RemindersPage />, { wrapper })

        await waitFor(() => {
            expect(screen.getByText(/Upcoming Reminders/i)).toBeInTheDocument()
            expect(screen.getByText(/Sent Reminders/i)).toBeInTheDocument()
            expect(screen.getByText(/Failed Reminders/i)).toBeInTheDocument()
        })
    })

    it('should handle retry on error', () => {
        mockUseUserReminders.mockReturnValue({
            data: undefined,
            isLoading: false,
            error: new Error('Failed to load reminders'),
        })

        render(<RemindersPage />, { wrapper })

        // Error message appears in both heading and paragraph
        expect(screen.getAllByText('Failed to load reminders').length).toBeGreaterThan(0)
        expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument()
    })


})
