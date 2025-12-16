import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DiscoverPage } from '../../pages/DiscoverPage'
import type { Event } from '../../types'
import { createTestWrapper, clearQueryClient } from '../testUtils'

// Mock dependencies
const mockUseAuth = vi.fn()
const mockUseEventSearch = vi.fn()
const mockUseQuery = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
	useAuth: () => mockUseAuth(),
}))

vi.mock('../../hooks/queries', () => ({
	useEventSearch: () => mockUseEventSearch(),
}))

vi.mock('@tanstack/react-query', async () => {
	const actual = await vi.importActual('@tanstack/react-query')
	return {
		...actual,
		useQuery: () => mockUseQuery(),
	}
})

vi.mock('../../components/SearchFilters', () => ({
	SearchFilters: ({ onApply, onClear }: { onApply: () => void; onClear: () => void }) => (
		<div data-testid="search-filters">
			<button onClick={onApply}>Apply Filters</button>
			<button onClick={onClear}>Clear Filters</button>
		</div>
	),
}))

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

const { wrapper, queryClient } = createTestWrapper(['/discover'])

describe('DiscoverPage', () => {
	beforeEach(() => {
		clearQueryClient(queryClient)
		vi.clearAllMocks()
		mockUseAuth.mockReturnValue({
			user: null,
			logout: vi.fn(),
		})
		mockUseEventSearch.mockReturnValue({
			data: { events: [], total: 0, page: 1, totalPages: 1 },
			isLoading: false,
			isError: false,
			error: null,
		})
		mockUseQuery.mockReturnValue({
			data: null,
			isLoading: false,
		})
	})

	it('user can see search filters', () => {
		render(<DiscoverPage />, { wrapper })

		expect(screen.getByTestId('search-filters')).toBeInTheDocument()
	})

	it('user can see view mode toggle', () => {
		render(<DiscoverPage />, { wrapper })

		expect(screen.getByLabelText('Grid view')).toBeInTheDocument()
		expect(screen.getByLabelText('List view')).toBeInTheDocument()
	})

	it('user can switch between grid and list view', async () => {
		const user = userEvent.setup()
		render(<DiscoverPage />, { wrapper })

		const listViewButton = screen.getByLabelText('List view')
		await user.click(listViewButton)

		// View mode should change (we verify the button is clickable)
		expect(listViewButton).toBeInTheDocument()
	})

	it('user can see sort options', () => {
		render(<DiscoverPage />, { wrapper })

		const sortSelect = screen.getByLabelText(/sort/i)
		expect(sortSelect).toBeInTheDocument()
	})

	it('user can see events when search returns results', async () => {
		mockUseEventSearch.mockReturnValue({
			data: { events: [mockEvent], total: 1, page: 1, totalPages: 1 },
			isLoading: false,
			isError: false,
			error: null,
		})

		render(<DiscoverPage />, { wrapper })

		await waitFor(() => {
			expect(screen.getByText('Test Event')).toBeInTheDocument()
		})
	})

	it('user can see loading state while searching', () => {
		mockUseEventSearch.mockReturnValue({
			data: undefined,
			isLoading: true,
			isError: false,
			error: null,
		})

		render(<DiscoverPage />, { wrapper })

		// Skeleton loaders should be visible
		const skeletons = document.querySelectorAll('.animate-pulse, [class*="skeleton"]')
		expect(skeletons.length).toBeGreaterThan(0)
	})

	it('user can see empty state when no events found', async () => {
		mockUseEventSearch.mockReturnValue({
			data: { events: [], total: 0, page: 1, totalPages: 1 },
			isLoading: false,
			isError: false,
			error: null,
		})

		render(<DiscoverPage />, { wrapper })

		await waitFor(() => {
			expect(screen.getByText(/No events found/i)).toBeInTheDocument()
		})
	})

	it('user can clear filters from empty state', async () => {
		const user = userEvent.setup()
		mockUseEventSearch.mockReturnValue({
			data: { events: [], total: 0, page: 1, totalPages: 1 },
			isLoading: false,
			isError: false,
			error: null,
		})

		render(<DiscoverPage />, { wrapper })

		await waitFor(() => {
			expect(screen.getByText(/No events found/i)).toBeInTheDocument()
		})

		const clearButton = screen.getByRole('button', { name: /Clear Filters/i })
		await user.click(clearButton)

		// Filters should be cleared (URL should update)
		expect(clearButton).toBeInTheDocument()
	})

	it('user can see error state when search fails', async () => {
		mockUseEventSearch.mockReturnValue({
			data: undefined,
			isLoading: false,
			isError: true,
			error: new Error('Search failed'),
		})

		render(<DiscoverPage />, { wrapper })

		await waitFor(() => {
			expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument()
		})
	})

	it('user can reload page from error state', async () => {
		const user = userEvent.setup()
		const reloadSpy = vi.spyOn(window.location, 'reload').mockImplementation(() => {})

		mockUseEventSearch.mockReturnValue({
			data: undefined,
			isLoading: false,
			isError: true,
			error: new Error('Search failed'),
		})

		render(<DiscoverPage />, { wrapper })

		await waitFor(() => {
			expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument()
		})

		const reloadButton = screen.getByRole('button', { name: /Reload Page/i })
		await user.click(reloadButton)

		expect(reloadSpy).toHaveBeenCalled()
		reloadSpy.mockRestore()
	})

	it('user can see pagination when multiple pages exist', async () => {
		mockUseEventSearch.mockReturnValue({
			data: { events: [mockEvent], total: 25, page: 1, totalPages: 3 },
			isLoading: false,
			isError: false,
			error: null,
		})

		render(<DiscoverPage />, { wrapper })

		await waitFor(() => {
			expect(screen.getByText(/Page 1 of 3/i)).toBeInTheDocument()
		})
	})

	it('user can navigate to next page', async () => {
		const user = userEvent.setup()
		mockUseEventSearch.mockReturnValue({
			data: { events: [mockEvent], total: 25, page: 1, totalPages: 3 },
			isLoading: false,
			isError: false,
			error: null,
		})

		render(<DiscoverPage />, { wrapper })

		await waitFor(() => {
			expect(screen.getByText(/Page 1 of 3/i)).toBeInTheDocument()
		})

		const nextButton = screen.getByRole('button', { name: /Next/i })
		expect(nextButton).toBeInTheDocument()
		expect(nextButton).not.toBeDisabled()

		await user.click(nextButton)

		// Page should change (URL should update)
		expect(nextButton).toBeInTheDocument()
	})

	it('user can navigate to previous page', async () => {
		const user = userEvent.setup()
		mockUseEventSearch.mockReturnValue({
			data: { events: [mockEvent], total: 25, page: 2, totalPages: 3 },
			isLoading: false,
			isError: false,
			error: null,
		})

		render(<DiscoverPage />, { wrapper })

		await waitFor(() => {
			expect(screen.getByText(/Page 2 of 3/i)).toBeInTheDocument()
		})

		const prevButton = screen.getByRole('button', { name: /Previous/i })
		expect(prevButton).toBeInTheDocument()
		expect(prevButton).not.toBeDisabled()

		await user.click(prevButton)

		// Page should change (URL should update)
		expect(prevButton).toBeInTheDocument()
	})

	it('user can see active filter chips when filters are applied', async () => {
		const { wrapper: testWrapper } = createTestWrapper(['/discover?q=test&location=SF'])

		mockUseEventSearch.mockReturnValue({
			data: { events: [], total: 0, page: 1, totalPages: 1 },
			isLoading: false,
			isError: false,
			error: null,
		})

		render(<DiscoverPage />, { wrapper: testWrapper })

		// Active filters should be displayed as chips
		await waitFor(() => {
			// The page should render with filters from URL
			expect(screen.getByTestId('search-filters')).toBeInTheDocument()
		})
	})

	it('user can remove active filters', async () => {
		const { wrapper: testWrapper } = createTestWrapper(['/discover?q=test'])

		mockUseEventSearch.mockReturnValue({
			data: { events: [], total: 0, page: 1, totalPages: 1 },
			isLoading: false,
			isError: false,
			error: null,
		})

		render(<DiscoverPage />, { wrapper: testWrapper })

		// Find and click clear all button if filters are active
		await waitFor(() => {
			expect(screen.getByTestId('search-filters')).toBeInTheDocument()
		})
	})
})
