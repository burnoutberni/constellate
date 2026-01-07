import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { EventDetailPage } from '../../pages/EventDetailPage'
import { createTestWrapper, clearQueryClient } from '../testUtils'
import { Route, Routes } from 'react-router-dom'
import type { Event, EventDetail } from '../../types'

const mockEvent: EventDetail = {
    id: 'event1',
    title: 'Test Event',
    summary: 'Test summary',
    // description removed
    location: 'Test Location',
    startTime: '2024-01-15T10:00:00Z',
    endTime: '2024-01-15T12:00:00Z',
    timezone: 'UTC',
    visibility: 'PUBLIC',
    url: null,
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
    organizers: [],
    attendance: [],
    likes: [],
    comments: [],
    attributedTo: null
}

// Mock hooks
const mockUseEventDetail = vi.fn()
const mockUseAuth = vi.fn()
const mockUseEventAttendance = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
    useAuth: () => mockUseAuth(),
}))

vi.mock('../../lib/api-client', () => ({
    api: {
        get: vi.fn().mockResolvedValue(null)
    }
}))

// Mock ALL hooks from queries because EventDetailPage imports from '@/hooks/queries'
vi.mock('../../hooks/queries', () => ({
    queryKeys: {
        users: {
            currentProfile: (id: string) => ['users', 'profile', id]
        },
        events: {
            detail: (id: string) => ['events', id]
        }
    },
    useEventDetail: (username?: string, eventId?: string) => mockUseEventDetail(username, eventId),
    useEventAttendance: () => mockUseEventAttendance(),
    useRSVP: () => ({ mutate: vi.fn(), isPending: false }),
    useLikeEvent: () => ({ mutate: vi.fn() }),
    useAddComment: () => ({ mutate: vi.fn() }),
    useDeleteEvent: () => ({ mutate: vi.fn() }),
    useShareEvent: () => ({ mutate: vi.fn() }),
    useEventReminder: () => ({ mutate: vi.fn() })
}))

// Mock child components to isolate page logic
vi.mock('../../components/EventHeader', () => ({
    EventHeader: () => <div data-testid="event-header">Event Header</div>
}))
vi.mock('../../components/EventInfo', () => ({
    // EventInfo receives 'event' prop with title
    EventInfo: ({ event }: { event: Pick<Event, 'title'> }) => <div data-testid="event-info">{event.title}</div>
}))
vi.mock('../../components/EventDescription', () => ({
    EventDescription: () => <div data-testid="event-description">Event Description</div>
}))
vi.mock('../../components/EventContextBar', () => ({
    EventContextBar: () => <div data-testid="event-context-bar">Event Context Bar</div>
}))
vi.mock('../../components/AttendanceWidget', () => ({
    AttendanceWidget: () => <div data-testid="attendance-widget" />
}))
vi.mock('../../components/AttendeeList', () => ({
    AttendeeList: () => <div data-testid="attendee-list" />
}))
vi.mock('../../components/CalendarExport', () => ({
    CalendarExport: () => <div data-testid="calendar-export" />
}))
vi.mock('../../components/CommentList', () => ({
    CommentList: () => <div data-testid="comment-list" />
}))
vi.mock('../../components/ConfirmationModal', () => ({
    ConfirmationModal: () => <div data-testid="confirmation-modal" />
}))
vi.mock('../../components/ReminderSelector', () => ({
    ReminderSelector: () => <div data-testid="reminder-selector" />
}))
vi.mock('../../components/SignupModal', () => ({
    SignupModal: () => <div data-testid="signup-modal" />
}))

const { wrapper, queryClient } = createTestWrapper(['/events/event1'])

describe('EventDetailPage', () => {
    beforeEach(() => {
        clearQueryClient(queryClient)
        vi.clearAllMocks()
        mockUseAuth.mockReturnValue({
            user: { id: 'me' },
            isAuthenticated: true
        })
        mockUseEventAttendance.mockReturnValue({
            data: [],
            isLoading: false
        })
    })

    afterEach(() => {
        clearQueryClient(queryClient)
    })

    const renderPage = () => {
        return render(
            <Routes>
                <Route path="/events/:eventId" element={<EventDetailPage />} />
            </Routes>,
            { wrapper }
        )
    }

    it('should show loading state', () => {
        mockUseEventDetail.mockReturnValue({
            data: undefined,
            isLoading: true,
        })

        const { container } = renderPage()
        expect(container.querySelector('.animate-spin')).toBeInTheDocument()
    })

    it('should show error state when event not found', () => {
        mockUseEventDetail.mockReturnValue({
            data: undefined,
            isLoading: false,
            error: new Error('Not found'),
        })

        renderPage()
        expect(screen.getByText('Event not found')).toBeInTheDocument()
    })

    it('should render event details successfully', async () => {
        mockUseEventDetail.mockReturnValue({
            data: mockEvent,
            isLoading: false,
        })

        renderPage()

        await waitFor(() => {
            expect(screen.getByTestId('event-header')).toBeInTheDocument()
            expect(screen.getByTestId('event-info')).toHaveTextContent('Test Event')
        }, { timeout: 5000 })
    })

    it('should handle remote event with attributedTo nicely', async () => {
        const remoteEvent = {
            ...mockEvent,
            isRemote: true,
            attributedTo: 'https://mastodon.social/users/remote_organizer',
            user: null
        }

        mockUseEventDetail.mockReturnValue({
            data: remoteEvent,
            isLoading: false
        })

        renderPage()

        await waitFor(() => {
            expect(screen.getByTestId('event-header')).toBeInTheDocument()
        }, { timeout: 5000 })
    })

    it('should log error (graceful fallback) when attributedTo is invalid', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { })

        const remoteEvent = {
            ...mockEvent,
            isRemote: true,
            attributedTo: 'not-a-url',
            user: null
        }

        mockUseEventDetail.mockReturnValue({
            data: remoteEvent,
            isLoading: false
        })

        renderPage()

        await waitFor(() => {
            expect(screen.getByTestId('event-header')).toBeInTheDocument()
            expect(consoleSpy).toHaveBeenCalledWith('Error parsing attributedTo URL:', expect.any(Error))
        }, { timeout: 5000 })

        consoleSpy.mockRestore()
    })
})
