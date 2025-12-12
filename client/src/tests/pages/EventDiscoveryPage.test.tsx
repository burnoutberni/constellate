import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EventDiscoveryPage } from '../../pages/EventDiscoveryPage'
import type { Event } from '../../types'
import { createTestWrapper, clearQueryClient } from '../testUtils'

// Mock dependencies
vi.mock('../../hooks/useAuth', () => ({
	useAuth: () => ({
		user: { id: 'user1', username: 'testuser' },
		loading: false,
		login: vi.fn(),
		sendMagicLink: vi.fn(),
		signup: vi.fn(),
		logout: vi.fn(),
	}),
}))

vi.mock('../../stores', () => ({
	useUIStore: () => ({
		sseConnected: true,
	}),
}))

const mockUseEventSearch = vi.fn()
vi.mock('../../hooks/queries', async () => {
	const actual = await vi.importActual('../../hooks/queries')
	return {
		...actual,
		useEventSearch: () => mockUseEventSearch(),
	}
})

vi.mock('../../lib/timezones', () => ({
	getDefaultTimezone: () => 'UTC',
}))

const mockEvent: Event = {
	id: '1',
	title: 'Test Event',
	summary: 'Test summary',
	location: 'Test Location',
	startTime: '2024-01-15T10:00:00Z',
	endTime: '2024-01-15T12:00:00Z',
	timezone: 'UTC',
	visibility: 'PUBLIC',
	tags: [{ id: '1', tag: 'music' }],
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

const { wrapper: baseWrapper, queryClient } = createTestWrapper(['/events'])
const createWrapper = (initialEntries = ['/events']) => {
	// Reuse the same queryClient but update router entries if needed
	if (initialEntries[0] !== '/events') {
		const { wrapper } = createTestWrapper(initialEntries)
		return wrapper
	}
	return baseWrapper
}

describe('EventDiscoveryPage', () => {
	beforeEach(() => {
		clearQueryClient(queryClient)
		vi.clearAllMocks()
		mockUseEventSearch.mockReturnValue({
			data: {
				events: [],
				pagination: {
					page: 1,
					limit: 20,
					total: 0,
					pages: 0,
				},
			},
			isLoading: false,
			isError: false,
			error: null,
			isFetching: false,
		})
	})

	afterEach(() => {
		clearQueryClient(queryClient)
	})

	it('should display loading state', async () => {
		mockUseEventSearch.mockReturnValue({
			data: undefined,
			isLoading: true,
			isError: false,
			error: null,
			isFetching: false,
		})

		render(<EventDiscoveryPage />, { wrapper: createWrapper() })

		await waitFor(() => {
			expect(screen.getByText(/Looking for matching events…/i)).toBeInTheDocument()
		})
	})

	it('should display error state', async () => {
		mockUseEventSearch.mockReturnValue({
			data: undefined,
			isLoading: false,
			isError: true,
			error: new Error('Search failed'),
			isFetching: false,
		})

		render(<EventDiscoveryPage />, { wrapper: createWrapper() })

		await waitFor(() => {
			expect(screen.getByText('Search failed')).toBeInTheDocument()
		})
	})

	it('should display error fallback when error message is missing', async () => {
		mockUseEventSearch.mockReturnValue({
			data: undefined,
			isLoading: false,
			isError: true,
			error: null,
			isFetching: false,
		})

		render(<EventDiscoveryPage />, { wrapper: createWrapper() })

		await waitFor(() => {
			expect(screen.getByText('Something went wrong while searching.')).toBeInTheDocument()
		})
	})

	it('should display empty state when no events found', () => {
		mockUseEventSearch.mockReturnValue({
			data: {
				events: [],
				pagination: {
					page: 1,
					limit: 20,
					total: 0,
					pages: 0,
				},
			},
			isLoading: false,
			isError: false,
			error: null,
			isFetching: false,
		})

		render(<EventDiscoveryPage />, { wrapper: createWrapper() })

		expect(screen.getByText(/No events match these filters just yet/)).toBeInTheDocument()
	})

	it('should display events in grid view by default', async () => {
		mockUseEventSearch.mockReturnValue({
			data: {
				events: [mockEvent],
				pagination: {
					page: 1,
					limit: 20,
					total: 1,
					pages: 1,
				},
			},
			isLoading: false,
			isError: false,
			error: null,
			isFetching: false,
		})

		render(<EventDiscoveryPage />, { wrapper: createWrapper() })

		await waitFor(() => {
			expect(screen.getByText('Test Event')).toBeInTheDocument()
		})
	})

	it('should display event count', async () => {
		mockUseEventSearch.mockReturnValue({
			data: {
				events: [mockEvent],
				pagination: {
					page: 1,
					limit: 20,
					total: 1,
					pages: 1,
				},
			},
			isLoading: false,
			isError: false,
			error: null,
			isFetching: false,
		})

		render(<EventDiscoveryPage />, { wrapper: createWrapper() })

		await waitFor(() => {
			expect(screen.getByText('1 event found')).toBeInTheDocument()
		})
	})

	it('should display plural event count', async () => {
		mockUseEventSearch.mockReturnValue({
			data: {
				events: [mockEvent, { ...mockEvent, id: '2' }],
				pagination: {
					page: 1,
					limit: 20,
					total: 2,
					pages: 1,
				},
			},
			isLoading: false,
			isError: false,
			error: null,
			isFetching: false,
		})

		render(<EventDiscoveryPage />, { wrapper: createWrapper() })

		await waitFor(() => {
			expect(screen.getByText('2 events found')).toBeInTheDocument()
		})
	})

	it('should show pagination when multiple pages exist', async () => {
		mockUseEventSearch.mockReturnValue({
			data: {
				events: [mockEvent],
				pagination: {
					page: 1,
					limit: 20,
					total: 25,
					pages: 2,
				},
			},
			isLoading: false,
			isError: false,
			error: null,
			isFetching: false,
		})

		render(<EventDiscoveryPage />, { wrapper: createWrapper(['/events?page=1']) })

		await waitFor(() => {
			expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
			expect(screen.getByRole('button', { name: /Previous/i })).toBeInTheDocument()
			expect(screen.getByRole('button', { name: /Next/i })).toBeInTheDocument()
		})
	})

	it('should disable Previous button on first page', async () => {
		mockUseEventSearch.mockReturnValue({
			data: {
				events: [mockEvent],
				pagination: {
					page: 1,
					limit: 20,
					total: 25,
					pages: 2,
				},
			},
			isLoading: false,
			isError: false,
			error: null,
			isFetching: false,
		})

		render(<EventDiscoveryPage />, { wrapper: createWrapper(['/events?page=1']) })

		await waitFor(() => {
			const prevButton = screen.getByRole('button', { name: /Previous/i })
			expect(prevButton).toBeDisabled()
		})
	})

	it('should disable Next button on last page', async () => {
		mockUseEventSearch.mockReturnValue({
			data: {
				events: [mockEvent],
				pagination: {
					page: 2,
					limit: 20,
					total: 25,
					pages: 2,
				},
			},
			isLoading: false,
			isError: false,
			error: null,
			isFetching: false,
		})

		render(<EventDiscoveryPage />, { wrapper: createWrapper(['/events?page=2']) })

		await waitFor(() => {
			const nextButton = screen.getByRole('button', { name: /Next/i })
			expect(nextButton).toBeDisabled()
		})
	})

	it('should show updating message when fetching', async () => {
		mockUseEventSearch.mockReturnValue({
			data: {
				events: [mockEvent],
				pagination: {
					page: 1,
					limit: 20,
					total: 1,
					pages: 1,
				},
			},
			isLoading: false,
			isError: false,
			error: null,
			isFetching: true,
		})

		render(<EventDiscoveryPage />, { wrapper: createWrapper() })

		await waitFor(() => {
			expect(screen.getByText('Updating results…')).toBeInTheDocument()
		})
	})

	it('should allow clicking Next button when not on last page', async () => {
		const user = userEvent.setup()
		mockUseEventSearch.mockReturnValue({
			data: {
				events: [mockEvent],
				pagination: {
					page: 1,
					limit: 20,
					total: 25,
					pages: 2,
				},
			},
			isLoading: false,
			isError: false,
			error: null,
			isFetching: false,
		})

		render(<EventDiscoveryPage />, { wrapper: createWrapper(['/events?page=1']) })

		await waitFor(() => {
			expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
		})

		const nextButton = screen.getByRole('button', { name: /Next/i })
		expect(nextButton).not.toBeDisabled()

		// Verify button is clickable (user interaction test)
		await user.click(nextButton)
		// Button click should not throw an error
		expect(nextButton).toBeInTheDocument()
	})

	it('should clear filters when Clear all is clicked', async () => {
		const user = userEvent.setup()
		mockUseEventSearch.mockReturnValue({
			data: {
				events: [mockEvent],
				pagination: {
					page: 1,
					limit: 20,
					total: 1,
					pages: 1,
				},
			},
			isLoading: false,
			isError: false,
			error: null,
			isFetching: false,
		})

		render(<EventDiscoveryPage />, {
			wrapper: createWrapper(['/events?q=test&location=New+York']),
		})

		await waitFor(() => {
			expect(screen.getByText('Clear all')).toBeInTheDocument()
		})

		const clearButton = screen.getByText('Clear all')
		await user.click(clearButton)

		// After clearing, the Clear all button should disappear
		await waitFor(() => {
			expect(screen.queryByText('Clear all')).not.toBeInTheDocument()
		})
	})
})
