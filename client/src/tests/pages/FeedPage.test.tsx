import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
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
	timezone: 'UTC'
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
	LocationDiscoveryCard: () => (
		<div data-testid="location-discovery-card">Location Discovery</div>
	),
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
		expect(screen.getByRole('button', { name: /New Event/i })).toBeInTheDocument()
	})

	it('should show loading state for activity feed', async () => {
		mockUseActivityFeed.mockReturnValue({
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

	it('should display activity feed items', async () => {
		const feedItems = [{
			type: 'activity',
			id: 'activity1',
			timestamp: '2024-01-15T10:00:00Z',
			data: mockActivity
		}]

		mockUseActivityFeed.mockReturnValue({
			data: { pages: [{ items: feedItems }] },
			isLoading: false,
			hasNextPage: false,
			isFetchingNextPage: false,
			status: 'success'
		})

		render(<FeedPage />, { wrapper })

		await waitFor(
			() => {
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
			data: { suggestions: [{ id: 'u1', username: 'suggested1', name: 'Suggested User', displayColor: '#000' }] }
		}]

		mockUseActivityFeed.mockReturnValue({
			data: { pages: [{ items: feedItems }] },
			isLoading: false,
			hasNextPage: false,
			isFetchingNextPage: false,
			status: 'success'
		})

		render(<FeedPage />, { wrapper })

		expect(screen.getByText(/Follow people to see their events and activities here/i)).toBeInTheDocument()
	})

	it('should display trending events in feed', async () => {
		const trendingEvent = {
			...mockEvent,
			trendingRank: 1,
			trendingScore: 100
		}

		const feedItems = [{
			type: 'trending_event',
			id: 'trending1',
			timestamp: new Date().toISOString(),
			data: trendingEvent
		}]

		mockUseActivityFeed.mockReturnValue({
			data: { pages: [{ items: feedItems }] },
			isLoading: false,
			hasNextPage: false,
			isFetchingNextPage: false,
			status: 'success'
		})

		render(<FeedPage />, { wrapper })

		expect(screen.getByText('Test Event')).toBeInTheDocument()
	})

	it('should show error state', async () => {
		mockUseActivityFeed.mockReturnValue({
			data: undefined,
			isLoading: false,
			status: 'error',
			error: new Error('Failed to load feed')
		})

		render(<FeedPage />, { wrapper })

		expect(screen.getByText('Failed to load feed.')).toBeInTheDocument()
	})
})
