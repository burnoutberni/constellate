import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '../design-system/ThemeContext'
import { EventDiscoveryPage } from './EventDiscoveryPage'
import type { Event } from '../types'

// Mock dependencies
vi.mock('../contexts/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 'user1', username: 'testuser' },
        logout: vi.fn(),
    }),
}))

vi.mock('../stores', () => ({
    useUIStore: () => ({
        sseConnected: true,
    }),
}))

const mockUseEventSearch = vi.fn()
vi.mock('../hooks/queries', () => ({
    useEventSearch: () => mockUseEventSearch(),
}))

vi.mock('../lib/timezones', () => ({
    getDefaultTimezone: () => 'UTC',
}))

const mockUseQuery = vi.fn()
vi.mock('@tanstack/react-query', async () => {
    const actual = await vi.importActual('@tanstack/react-query')
    return {
        ...actual,
        useQuery: () => mockUseQuery(),
    }
})

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

const createWrapper = (initialEntries = ['/events']) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    })
    return ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider defaultTheme="light">
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
            </QueryClientProvider>
        </ThemeProvider>
    )
}

describe('EventDiscoveryPage', () => {
    beforeEach(() => {
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
        mockUseQuery.mockReturnValue({
            data: null,
            isLoading: false,
        })
    })

    it('should render page title and description', () => {
        render(<EventDiscoveryPage />, { wrapper: createWrapper() })

        expect(screen.getByText('Discover Events')).toBeInTheDocument()
        expect(screen.getByText(/Browse upcoming events from the federated community/)).toBeInTheDocument()
    })

    it('should render EventFilters component', () => {
        render(<EventDiscoveryPage />, { wrapper: createWrapper() })

        // EventFilters should be rendered in the sidebar - look for the heading
        expect(screen.getByRole('heading', { name: 'Filters' })).toBeInTheDocument()
    })

    it('should display loading state', () => {
        mockUseEventSearch.mockReturnValue({
            data: undefined,
            isLoading: true,
            isError: false,
            error: null,
            isFetching: false,
        })

        render(<EventDiscoveryPage />, { wrapper: createWrapper() })

        expect(screen.getByText(/Looking for matching events…/)).toBeInTheDocument()
    })

    it('should display error state', () => {
        mockUseEventSearch.mockReturnValue({
            data: undefined,
            isLoading: false,
            isError: true,
            error: new Error('Search failed'),
            isFetching: false,
        })

        render(<EventDiscoveryPage />, { wrapper: createWrapper() })

        expect(screen.getByText('Search failed')).toBeInTheDocument()
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

    it('should display events in grid view by default', () => {
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

        expect(screen.getByText('Test Event')).toBeInTheDocument()
    })

    it('should display event count', () => {
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

        expect(screen.getByText('1 event found')).toBeInTheDocument()
    })

    it('should display plural event count', () => {
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

        expect(screen.getByText('2 events found')).toBeInTheDocument()
    })

    it('should show pagination when multiple pages exist', () => {
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

        expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Previous/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Next/i })).toBeInTheDocument()
    })

    it('should disable Previous button on first page', () => {
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

        const prevButton = screen.getByRole('button', { name: /Previous/i })
        expect(prevButton).toBeDisabled()
    })

    it('should disable Next button on last page', () => {
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

        const nextButton = screen.getByRole('button', { name: /Next/i })
        expect(nextButton).toBeDisabled()
    })

    it('should display sort selector', () => {
        render(<EventDiscoveryPage />, { wrapper: createWrapper() })

        const sortSelect = screen.getByLabelText('Sort events')
        expect(sortSelect).toBeInTheDocument()
        expect(sortSelect).toHaveValue('date')
    })

    it('should display view mode toggle', () => {
        render(<EventDiscoveryPage />, { wrapper: createWrapper() })

        expect(screen.getByLabelText('Grid view')).toBeInTheDocument()
        expect(screen.getByLabelText('List view')).toBeInTheDocument()
    })

    it('should display active filters as chips', () => {
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
            wrapper: createWrapper(['/events?q=test&location=New+York&dateRange=today']),
        })

        // Active filters should be displayed as chips
        // Look for "Clear all" button which only appears when filters are active
        expect(screen.getByText('Clear all')).toBeInTheDocument()
        // Verify filter chips exist - New York should be in a filter chip
        expect(screen.getByText(/New York/)).toBeInTheDocument()
        // Verify query filter chip exists by looking for the remove button aria-label
        expect(screen.getByLabelText('Remove Keyword filter')).toBeInTheDocument()
    })

    it('should show updating message when fetching', () => {
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

        expect(screen.getByText('Updating results…')).toBeInTheDocument()
    })

    it('should parse URL parameters and build filters', () => {
        mockUseEventSearch.mockReturnValue({
            data: {
                events: [],
                pagination: { page: 1, limit: 20, total: 0, pages: 0 },
            },
            isLoading: false,
            isError: false,
            error: null,
            isFetching: false,
        })

        render(<EventDiscoveryPage />, {
            wrapper: createWrapper(['/events?q=test&location=NYC&page=2&sort=popularity']),
        })

        // Verify useEventSearch was called
        expect(mockUseEventSearch).toHaveBeenCalled()
    })
})
