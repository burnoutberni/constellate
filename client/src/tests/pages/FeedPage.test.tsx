import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { FeedPage } from '../../pages/FeedPage'
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
	timezone: 'UTC'
}



const mockUseEvents = vi.fn()
const mockUseHomeFeed = vi.fn()
const mockUseRecommendedEvents = vi.fn()
const mockUseTrendingEvents = vi.fn()
const mockOpenCreateEventModal = vi.fn()
const mockCloseCreateEventModal = vi.fn()
const mockUseAuth = vi.fn()
const mockUseSuggestedUsers = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
	useAuth: () => mockUseAuth(),
}))

const mockUseNearbyEvents = vi.fn()

vi.mock('../../hooks/queries', async () => {
	const actual = await vi.importActual('../../hooks/queries')
	return {
		...actual,
		useEvents: () => mockUseEvents(),
		useHomeFeed: () => mockUseHomeFeed(), // Updated hook
		useRecommendedEvents: () => mockUseRecommendedEvents(),
		useTrendingEvents: () => mockUseTrendingEvents(),
		useNearbyEvents: () => mockUseNearbyEvents(),
		useSuggestedUsers: () => mockUseSuggestedUsers(),
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
	LocationDiscoveryCard: () => (
		<div data-testid="location-discovery-card">Location Discovery</div>
	),
}))

vi.mock('../../components/FollowButton', () => ({
	FollowButton: () => null,
}))

// Mock Sidebar to avoid complex children rendering if needed, 
// or let it render if we want to test its presence
vi.mock('../../components/Feed/Sidebar', () => ({
	Sidebar: () => <div data-testid="feed-sidebar">Sidebar</div>,
}))

vi.mock('../../components/EventCard', () => ({
	EventCard: ({ event }: { event: { title: string } }) => (
		<div data-testid="event-card">{event.title}</div>
	),
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
	useSuggestedUsers: () => ({ // Mock explicitly here too if needed, but handled in queries mock
		data: [],
		isLoading: false
	})
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
		mockUseHomeFeed.mockReturnValue({
			data: { pages: [] },
			isLoading: false,
			hasNextPage: false,
			isFetchingNextPage: false,
			status: 'success'
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
		mockUseSuggestedUsers.mockReturnValue({
			data: [],
			isLoading: false
		})
	})

	afterEach(() => {
		clearQueryClient(queryClient)
	})

	it('should render feed page with sidebar', () => {
		render(<FeedPage />, { wrapper })
		expect(screen.getByRole('button', { name: /New Event/i })).toBeInTheDocument()
		expect(screen.getByTestId('feed-sidebar')).toBeInTheDocument()
	})

	it('should show loading state for home feed', async () => {
		mockUseHomeFeed.mockReturnValue({
			data: undefined,
			isLoading: true,
			hasNextPage: false,
			isFetchingNextPage: false,
			status: 'pending'
		})

		render(<FeedPage />, { wrapper })

		// Loading state shows spinner
		expect(document.querySelector('.animate-spin')).toBeInTheDocument()
	})

	it('should NOT show loading state for unauthenticated user when pending', async () => {
		mockUseAuth.mockReturnValue({
			user: null, // Unauthenticated
			logout: vi.fn(),
		})
		mockUseHomeFeed.mockReturnValue({
			data: undefined,
			isLoading: true, // React Query might say loading
			hasNextPage: false,
			isFetchingNextPage: false,
			status: 'pending', // But status is pending because enabled: false
			isFetching: false, // And not actually fetching
		})

		render(<FeedPage />, { wrapper })

		// Should NOT show spinner
		expect(document.querySelector('.animate-spin')).not.toBeInTheDocument()
		// Should likely show welcome/onboarding or empty state (depending on implementation fallbacks)
		// For now just ensuring spinner is gone is the regression fix check
	})

	it('should display feed items and headers', async () => {
		const feedItems = [
			{
				type: 'header',
				id: 'header-today',
				timestamp: '2024-01-15T08:00:00Z',
				data: { title: 'Today' }
			},
			{
				type: 'trending_event', // or 'activity' depending on what we test
				id: 'activity1',
				timestamp: '2024-01-15T10:00:00Z',
				data: mockEvent // simplified, mocked as trending_event data
			}
		]

		mockUseHomeFeed.mockReturnValue({
			data: { pages: [{ items: feedItems }] },
			isLoading: false,
			hasNextPage: false,
			isFetchingNextPage: false,
			status: 'success'
		})

		render(<FeedPage />, { wrapper })

		await waitFor(
			() => {
				expect(screen.getByText('Today')).toBeInTheDocument()
				expect(screen.getByText('Test Event')).toBeInTheDocument()
			},
			{ timeout: 2000 }
		)
	})

	it('should show onboarding hero for new users', async () => {
		const feedItems = [{
			type: 'onboarding',
			id: 'onboarding1',
			timestamp: new Date().toISOString(),
			data: { suggestions: [{ id: 'u1', username: 'suggested1', name: 'Suggested User', displayColor: '#000', profileImage: null }] }
		}]

		mockUseHomeFeed.mockReturnValue({
			data: { pages: [{ items: feedItems }] },
			isLoading: false,
			hasNextPage: false,
			isFetchingNextPage: false,
			status: 'success'
		})

		render(<FeedPage />, { wrapper })

		expect(screen.getByText(/Follow people to see their events and activities here/i)).toBeInTheDocument()
	})

	it('should show error state', async () => {
		mockUseHomeFeed.mockReturnValue({
			data: undefined,
			isLoading: false,
			status: 'error',
			error: new Error('Failed to load feed')
		})

		render(<FeedPage />, { wrapper })

		expect(screen.getByText('Failed to load feed.')).toBeInTheDocument()
	})
	it('should show suggested users card', async () => {
		const feedItems = [{
			type: 'suggested_users',
			id: 'suggestions1',
			timestamp: new Date().toISOString(),
			data: {
				suggestions: [
					{
						id: 'u1',
						username: 'suggested1',
						name: 'Suggested User',
						displayColor: '#000',
						profileImage: null,
						_count: { followers: 10, events: 5 }
					}
				]
			}
		}]

		mockUseHomeFeed.mockReturnValue({
			data: { pages: [{ items: feedItems }] },
			isLoading: false,
			hasNextPage: false,
			isFetchingNextPage: false,
			status: 'success'
		})

		render(<FeedPage />, { wrapper })

		// SuggestedUsersCard renders "Suggested for you" usually, or we check for username
		expect(screen.getByText('Suggested User')).toBeInTheDocument()
		expect(screen.getByText(/@suggested1/)).toBeInTheDocument()
	})
})
