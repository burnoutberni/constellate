import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchPage } from '../../pages/SearchPage'
import type { Event } from '../../types'
import { createTestWrapper, clearQueryClient } from '../testUtils'

// Mock dependencies
const mockUser = { id: 'user1', username: 'testuser', name: 'Test User' }
const mockEvent: Event = {
    id: 'event1',
    title: 'Test Event',
    summary: 'Test summary',
    location: 'Test Location',
    startTime: '2024-01-15T10:00:00Z',
    endTime: '2024-01-15T12:00:00Z',
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

const mockUseEventSearch = vi.fn()
const mockUseQuery = vi.fn()
const mockUseAuth = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
    useAuth: () => mockUseAuth(),
}))

vi.mock('../../hooks/queries', async () => {
    const actual = await vi.importActual('../../hooks/queries')
    return {
        ...actual,
        useEventSearch: () => mockUseEventSearch(),
    }
})

vi.mock('@tanstack/react-query', async () => {
    const actual = await vi.importActual('@tanstack/react-query')
    return {
        ...actual,
        useQuery: () => mockUseQuery(),
    }
})

vi.mock('../../stores', () => ({
    useUIStore: () => ({
        sseConnected: true,
    }),
}))

vi.mock('../../lib/timezones', () => ({
    getDefaultTimezone: () => 'UTC',
}))

const { wrapper: baseWrapper, queryClient } = createTestWrapper(['/search'])

describe('SearchPage', () => {
    beforeEach(() => {
        clearQueryClient(queryClient)
        vi.clearAllMocks()
        mockUseAuth.mockReturnValue({
            user: mockUser,
            logout: vi.fn(),
        })
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

    afterEach(() => {
        clearQueryClient(queryClient)
    })

    it('should render search page', () => {
        render(<SearchPage />, { wrapper: baseWrapper })
        expect(screen.getByText(/Search Results/i)).toBeInTheDocument()
    })

    it('should display loading state', async () => {
        mockUseEventSearch.mockReturnValue({
            data: undefined,
            isLoading: true,
            isError: false,
            error: null,
            isFetching: false,
        })

        render(<SearchPage />, { wrapper: baseWrapper })

        await waitFor(() => {
            expect(screen.getByText('Looking for matching events…')).toBeInTheDocument()
        })
    })

    it('should display search results', async () => {
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

        render(<SearchPage />, { wrapper: baseWrapper })

        await waitFor(() => {
            expect(screen.getByText('Test Event')).toBeInTheDocument()
        })
    })

    it('should display empty state', () => {
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

        render(<SearchPage />, { wrapper: baseWrapper })

        expect(screen.getByText('No events match these filters just yet.')).toBeInTheDocument()
    })

    it('should display error state', () => {
        mockUseEventSearch.mockReturnValue({
            data: undefined,
            isLoading: false,
            isError: true,
            error: new Error('Search failed'),
            isFetching: false,
        })

        render(<SearchPage />, { wrapper: baseWrapper })

        expect(screen.getByText('Search failed')).toBeInTheDocument()
    })


    it('should display active filter chips', async () => {
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

        const { wrapper: customWrapper } = createTestWrapper(['/search?q=test&location=NYC'])
        render(<SearchPage />, { wrapper: customWrapper })

        await waitFor(() => {
            expect(screen.getByText(/Clear all filters/i)).toBeInTheDocument()
        })
    })

    it('should remove filter chips', async () => {
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

        const { wrapper: customWrapper } = createTestWrapper(['/search?q=test'])
        render(<SearchPage />, { wrapper: customWrapper })

        await waitFor(() => {
            expect(screen.getByText(/Clear all filters/i)).toBeInTheDocument()
        }, { timeout: 2000 })

        const removeButtons = screen.queryAllByLabelText(/Remove.*filter/i)
        if (removeButtons.length > 0) {
            await user.click(removeButtons[0])
        }
    })

    it('should handle pagination', async () => {
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

        const { wrapper: customWrapper } = createTestWrapper(['/search?page=1'])
        render(<SearchPage />, { wrapper: customWrapper })

        await waitFor(() => {
            expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
        })

        const nextButton = screen.getByRole('button', { name: 'Next' })
        expect(nextButton).toBeInTheDocument()
        await user.click(nextButton)
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

        render(<SearchPage />, { wrapper: baseWrapper })

        expect(screen.getByText('Updating results…')).toBeInTheDocument()
    })




    it('should display event result cards with all information', async () => {
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

        render(<SearchPage />, { wrapper: baseWrapper })

        await waitFor(() => {
            expect(screen.getByText('Test Event')).toBeInTheDocument()
            expect(screen.getByText(/Test Location/i)).toBeInTheDocument()
        })
    })
})
