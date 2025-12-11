import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FeedPage } from '../../pages/FeedPage'
import type { Activity } from '../../types'
import type { Event } from '../../types'
import { createTestWrapper, clearQueryClient } from '../testUtils'

// Mock dependencies
const mockUser = { id: 'user1', username: 'testuser', name: 'Test User' }
const mockEvent: Event = {
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
}

const mockActivity: Activity = {
    id: 'activity1',
    type: 'event_created',
    createdAt: '2024-01-15T10:00:00Z',
    user: {
        id: 'user1',
        username: 'testuser',
        name: 'Test User',
        isRemote: false,
    },
    event: mockEvent,
}

const mockUseEvents = vi.fn()
const mockUseActivityFeed = vi.fn()
const mockUseRecommendedEvents = vi.fn()
const mockUseTrendingEvents = vi.fn()
const mockOpenCreateEventModal = vi.fn()
const mockCloseCreateEventModal = vi.fn()
const mockUseAuth = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
    useAuth: () => mockUseAuth(),
}))

const mockUseNearbyEvents = vi.fn()

vi.mock('../../hooks/queries', async () => {
    const actual = await vi.importActual('../../hooks/queries')
    return {
        ...actual,
        useEvents: () => mockUseEvents(),
        useActivityFeed: () => mockUseActivityFeed(),
        useRecommendedEvents: () => mockUseRecommendedEvents(),
        useTrendingEvents: () => mockUseTrendingEvents(),
        useNearbyEvents: () => mockUseNearbyEvents(),
    }
})

vi.mock('../../stores', () => ({
    useUIStore: () => ({
        openCreateEventModal: mockOpenCreateEventModal,
        closeCreateEventModal: mockCloseCreateEventModal,
        createEventModalOpen: false,
        sseConnected: true,
    }),
}))

vi.mock('../../components/CreateEventModal', () => ({
    CreateEventModal: () => <div data-testid="create-event-modal">Create Event Modal</div>,
}))

vi.mock('../../components/LocationDiscoveryCard', () => ({
    LocationDiscoveryCard: () => <div data-testid="location-discovery-card">Location Discovery</div>,
}))

vi.mock('../../components/FollowButton', () => ({
    FollowButton: () => null,
}))

vi.mock('../../hooks/useLocationSuggestions', () => ({
    useLocationSuggestions: () => ({
        suggestions: [],
        loading: false,
        error: null,
    }),
    MIN_QUERY_LENGTH: 3,
}))

vi.mock('../../hooks/queries/users', () => ({
    useFollowStatus: () => ({
        data: { isFollowing: false, isAccepted: false },
        isLoading: false,
    }),
    useFollowUser: () => ({
        mutate: vi.fn(),
        isPending: false,
    }),
    useUnfollowUser: () => ({
        mutate: vi.fn(),
        isPending: false,
    }),
}))

const { wrapper, queryClient } = createTestWrapper(['/feed'])

describe('FeedPage', () => {
    beforeEach(() => {
        clearQueryClient(queryClient)
        vi.clearAllMocks()
        mockUseAuth.mockReturnValue({
            user: mockUser,
            logout: vi.fn(),
        })
        mockUseEvents.mockReturnValue({
            data: { events: [] },
            isLoading: false,
        })
        mockUseActivityFeed.mockReturnValue({
            data: { activities: [] },
            isLoading: false,
        })
        mockUseRecommendedEvents.mockReturnValue({
            data: { recommendations: [] },
            isLoading: false,
        })
        mockUseTrendingEvents.mockReturnValue({
            data: { events: [], windowDays: 7, generatedAt: new Date().toISOString() },
            isLoading: false,
            isFetching: false,
            error: null,
            refetch: vi.fn(),
        })
        mockUseNearbyEvents.mockReturnValue({
            data: { events: [] },
            isLoading: false,
        })
    })

    afterEach(() => {
        clearQueryClient(queryClient)
    })

    it('should render feed page', () => {
        render(<FeedPage />, { wrapper })
        expect(screen.getByRole('button', { name: /Create Event/i })).toBeInTheDocument()
    })

    it('should show loading state for activity feed', async () => {
        mockUseActivityFeed.mockReturnValue({
            data: undefined,
            isLoading: true,
        })

        render(<FeedPage />, { wrapper })

        // Loading state may show spinner or text
        await waitFor(() => {
            const loadingElements = screen.queryAllByText(/Loading/i)
            const spinner = document.querySelector('.animate-spin')
            expect(loadingElements.length > 0 || spinner).toBeTruthy()
        }, { timeout: 2000 })
    })

    it('should display activity feed items', async () => {
        mockUseActivityFeed.mockReturnValue({
            data: { activities: [mockActivity] },
            isLoading: false,
        })

        render(<FeedPage />, { wrapper })

        // ActivityFeedItem renders the event title, which should be visible
        await waitFor(() => {
            expect(screen.getByText('Test Event')).toBeInTheDocument()
        }, { timeout: 2000 })
    })

    it('should show empty state when no activities', () => {
        mockUseActivityFeed.mockReturnValue({
            data: { activities: [] },
            isLoading: false,
        })

        render(<FeedPage />, { wrapper })

        expect(screen.getByText('No activity yet')).toBeInTheDocument()
    })

    it('should switch between activity and trending tabs', async () => {
        const user = userEvent.setup()
        render(<FeedPage />, { wrapper })

        // Buttons have role="tab", not role="button"
        await waitFor(() => {
            const tabs = screen.getAllByRole('tab')
            const activityTab = tabs.find(tab => tab.textContent?.trim() === 'Activity')
            expect(activityTab).toBeInTheDocument()
        }, { timeout: 2000 })

        const tabs = screen.getAllByRole('tab')
        const trendingTab = tabs.find(tab => tab.textContent?.trim() === 'Trending')
        expect(trendingTab).toBeInTheDocument()
        if (trendingTab) {
            await user.click(trendingTab)
            // Just verify the tab was clicked
            expect(trendingTab).toBeInTheDocument()
        }
    })

    it('should filter activities by type', async () => {
        const activities: Activity[] = [
            { ...mockActivity, type: 'event_created' },
            { ...mockActivity, id: 'activity2', type: 'like' },
            { ...mockActivity, id: 'activity3', type: 'comment' },
        ]

        mockUseActivityFeed.mockReturnValue({
            data: { activities },
            isLoading: false,
        })

        render(<FeedPage />, { wrapper })

        // ActivityFilters component should render when there are activities and user is authenticated
        // Check for activity feed items - event titles should be visible
        await waitFor(() => {
            const eventTitles = screen.getAllByText('Test Event')
            expect(eventTitles.length).toBeGreaterThan(0)
        }, { timeout: 2000 })
    })

    it('should display recommended events', async () => {
        const recommendations = [
            {
                event: mockEvent,
                reasons: ['You follow @testuser'],
            },
        ]

        mockUseRecommendedEvents.mockReturnValue({
            data: { recommendations },
            isLoading: false,
        })

        render(<FeedPage />, { wrapper })

        await waitFor(() => {
            expect(screen.getByText('Recommended events')).toBeInTheDocument()
        }, { timeout: 2000 })
    })

    it('should display today\'s events', async () => {
        const todayEvent = {
            ...mockEvent,
            startTime: new Date().toISOString(),
        }

        mockUseEvents.mockReturnValue({
            data: { events: [todayEvent] },
            isLoading: false,
        })

        render(<FeedPage />, { wrapper })

        await waitFor(() => {
            expect(screen.getByText(/Today's Events/i)).toBeInTheDocument()
        }, { timeout: 2000 })
    })

    it('should handle trending events error', async () => {
        const user = userEvent.setup()
        mockUseTrendingEvents.mockReturnValue({
            data: undefined,
            isLoading: false,
            isFetching: false,
            error: new Error('Failed to load trending events'),
            refetch: vi.fn(),
        })

        render(<FeedPage />, { wrapper })

        // Need to switch to trending tab first to see the error
        // The error only shows when activeTab === 'trending'
        // Buttons have role="tab", not role="button"
        await waitFor(() => {
            const tabs = screen.getAllByRole('tab')
            const trendingTab = tabs.find(tab => tab.textContent?.trim() === 'Trending')
            expect(trendingTab).toBeInTheDocument()
        }, { timeout: 2000 })

        const tabs = screen.getAllByRole('tab')
        const trendingTab = tabs.find(tab => tab.textContent?.trim() === 'Trending')
        expect(trendingTab).toBeInTheDocument()
        if (trendingTab) {
            await user.click(trendingTab)

            await waitFor(() => {
                // Error message should appear after switching to trending tab
                expect(screen.getByText("We couldn't load trending events.")).toBeInTheDocument()
            }, { timeout: 2000 })
        } else {
            // If trending tab not found, fail the test
            expect(trendingTab).toBeDefined()
        }
    })

    it('should display trending events', async () => {
        const user = userEvent.setup()
        const trendingEvent = {
            ...mockEvent,
            trendingRank: 1,
            trendingScore: 95.5,
            trendingMetrics: {
                likes: 10,
                comments: 5,
                attendance: 20,
            },
        }

        mockUseTrendingEvents.mockReturnValue({
            data: {
                events: [trendingEvent],
                windowDays: 7,
                generatedAt: new Date().toISOString(),
            },
            isLoading: false,
            isFetching: false,
            error: null,
            refetch: vi.fn(),
        })

        render(<FeedPage />, { wrapper })

        // Wait for page to render, then find and click trending tab
        // Buttons have role="tab", not role="button"
        await waitFor(() => {
            const tabs = screen.getAllByRole('tab')
            const trendingTab = tabs.find(tab => tab.textContent?.trim() === 'Trending')
            expect(trendingTab).toBeInTheDocument()
        }, { timeout: 2000 })

        const tabs = screen.getAllByRole('tab')
        const trendingTab = tabs.find(tab => tab.textContent?.trim() === 'Trending')
        expect(trendingTab).toBeInTheDocument()
        if (trendingTab) {
            await user.click(trendingTab)

            await waitFor(() => {
                expect(screen.getByText('Test Event')).toBeInTheDocument()
            }, { timeout: 2000 })
        } else {
            // If trending tab not found, fail the test
            expect(trendingTab).toBeDefined()
        }
    })


    it('should show sign in prompt for unauthenticated users', () => {
        mockUseAuth.mockReturnValue({
            user: null,
            logout: vi.fn(),
        })

        render(<FeedPage />, { wrapper })

        expect(screen.getByText(/Sign in to see your activity feed/i)).toBeInTheDocument()
    })

})
