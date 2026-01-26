import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { FeedPage } from '../../pages/FeedPage'
import { createTestWrapper, clearQueryClient } from '../testUtils'

// Mock dependencies
const mockUser = { id: 'user1', username: 'testuser', name: 'Test User' }

const mockEvent = {
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

// We need to access the mock calls to check props
const mockEventCard = vi.fn()

const mockUseHomeFeed = vi.fn()
const mockUseAuth = vi.fn()
const mockUseUIStore = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
	useAuth: () => mockUseAuth(),
}))

vi.mock('../../hooks/queries', async () => {
	const actual = await vi.importActual('../../hooks/queries')
	return {
		...actual,
		useHomeFeed: () => mockUseHomeFeed(),
	}
})

vi.mock('../../stores', () => ({
	useUIStore: () => mockUseUIStore(),
}))

// Mock EventCard to spy on props
vi.mock('../../components/EventCard', () => ({
	EventCard: (props: any) => {
		mockEventCard(props)
		return <div data-testid="event-card">{props.event.title}</div>
	},
}))

// Mock other components to avoid rendering noise
vi.mock('../../components/CreateEventModal', () => ({
	CreateEventModal: ({ isOpen }: { isOpen: boolean }) => (
		isOpen ? <div data-testid="create-event-modal">Modal Open</div> : null
	),
}))
vi.mock('../../components/Feed/Sidebar', () => ({ Sidebar: () => null }))
vi.mock('../../components/Navbar', () => ({ Navbar: () => null }))
vi.mock('../../components/Feed/OnboardingHero', () => ({ OnboardingHero: () => null }))
vi.mock('../../components/Feed/SuggestedUsersCard', () => ({ SuggestedUsersCard: () => null }))

const { wrapper, queryClient } = createTestWrapper(['/feed'])

describe('FeedPage Performance', () => {
	beforeEach(() => {
		clearQueryClient(queryClient)
		vi.clearAllMocks()
		mockUseAuth.mockReturnValue({
			user: mockUser,
			logout: vi.fn(),
		})
		mockUseHomeFeed.mockReturnValue({
			data: {
				pages: [{
					items: [{
						type: 'trending_event',
						id: 'activity1',
						timestamp: '2024-01-15T10:00:00Z',
						data: mockEvent
					}]
				}]
			},
			isLoading: false,
			hasNextPage: false,
			isFetchingNextPage: false,
			status: 'success'
		})
		mockUseUIStore.mockReturnValue({
			sseConnected: true,
			isFeedRefreshing: false
		})
	})

	it('preserves event card stability on re-render with optimization', async () => {
		render(<FeedPage />, { wrapper })

		// Initial render
		expect(mockEventCard).toHaveBeenCalledTimes(1)
		const firstRenderEvent = mockEventCard.mock.calls[0][0].event

		// Trigger re-render by opening modal (state change)
		const newEventButton = screen.getByText(/New Event/i)
		fireEvent.click(newEventButton)

		// Wait for re-render
		await waitFor(() => {
			expect(screen.getByTestId('create-event-modal')).toBeInTheDocument()
		})

		// Should NOT have rendered again (or if it did, props should be identical)
		// Because we memoized the list, React sees the same elements and skips rendering
		expect(mockEventCard).toHaveBeenCalledTimes(1)

		// If for some reason it did render (e.g. context change), ensure props are stable
		if (mockEventCard.mock.calls.length > 1) {
			const secondRenderEvent = mockEventCard.mock.calls[1][0].event
			expect(secondRenderEvent).toBe(firstRenderEvent)
		}
	})
})
