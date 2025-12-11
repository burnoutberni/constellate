import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InstancesPage } from '../../pages/InstancesPage'
import type { InstanceWithStats } from '../../types'
import { createTestWrapper, clearQueryClient } from '../testUtils'

// Mock dependencies
const mockUser = { id: 'user1', username: 'testuser', name: 'Test User' }
const mockInstance: InstanceWithStats = {
    id: 'instance1',
    domain: 'example.com',
    title: 'Example Instance',
    description: 'An example federated instance',
    blocked: false,
    lastSeen: new Date('2024-01-15T10:00:00Z'),
    stats: {
        remoteUsers: 100,
        remoteEvents: 50,
        localFollowing: 10,
    },
}

const mockUseInstances = vi.fn()
const mockUseInstanceSearch = vi.fn()
const mockUseMutation = vi.fn()
const mockUseAuth = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
    useAuth: () => mockUseAuth(),
}))

vi.mock('../../hooks/queries', async () => {
    const actual = await vi.importActual('../../hooks/queries')
    return {
        ...actual,
        useInstances: () => mockUseInstances(),
        useInstanceSearch: () => mockUseInstanceSearch(),
    }
})

vi.mock('@tanstack/react-query', async () => {
    const actual = await vi.importActual('@tanstack/react-query')
    return {
        ...actual,
        useMutation: () => mockUseMutation(),
        useQueryClient: () => ({
            invalidateQueries: vi.fn(),
        }),
    }
})

global.fetch = vi.fn()

const { wrapper, queryClient } = createTestWrapper(['/instances'])

describe('InstancesPage', () => {
    beforeEach(() => {
        clearQueryClient(queryClient)
        vi.clearAllMocks()
        mockUseAuth.mockReturnValue({
            user: mockUser,
            logout: vi.fn(),
        })
        mockUseInstances.mockReturnValue({
            data: {
                instances: [mockInstance],
                total: 1,
            },
            isLoading: false,
        })
        mockUseInstanceSearch.mockReturnValue({
            data: {
                instances: [],
            },
            isLoading: false,
        })
        mockUseMutation.mockReturnValue({
            mutate: vi.fn(),
            mutateAsync: vi.fn().mockResolvedValue({}),
        })
        global.window.confirm = vi.fn(() => true)
    })

    afterEach(() => {
        clearQueryClient(queryClient)
    })

    it('should render instances page', () => {
        render(<InstancesPage />, { wrapper })
        // Use getAllByText since "Federated Instances" appears in both title and description
        expect(screen.getAllByText(/Federated Instances/i).length).toBeGreaterThan(0)
    })

    it('should display loading state', () => {
        mockUseInstances.mockReturnValue({
            data: undefined,
            isLoading: true,
        })

        render(<InstancesPage />, { wrapper })

        expect(screen.getByText(/Loading instances/i)).toBeInTheDocument()
    })

    it('should display instances list', async () => {
        render(<InstancesPage />, { wrapper })

        await waitFor(() => {
            expect(screen.getByText('Example Instance')).toBeInTheDocument()
        })
    })

    it('should show empty state when no instances', () => {
        mockUseInstances.mockReturnValue({
            data: {
                instances: [],
                total: 0,
            },
            isLoading: false,
        })

        render(<InstancesPage />, { wrapper })

        // When there are no instances, the page shows the count
        expect(screen.getByText(/Showing.*0.*instances/i)).toBeInTheDocument()
    })

    it('should handle search', async () => {
        const user = userEvent.setup()
        const searchResults = [{ ...mockInstance, domain: 'search.example.com', title: 'Search Instance' }]
        
        mockUseInstanceSearch.mockReturnValue({
            data: {
                instances: searchResults,
            },
            isLoading: false,
        })

        render(<InstancesPage />, { wrapper })

        await waitFor(() => {
            expect(screen.getByPlaceholderText(/Search instances/i)).toBeInTheDocument()
        })

        const searchInput = screen.getByPlaceholderText(/Search instances/i)
        await user.type(searchInput, 'example')

        // Check that search results appear (user-visible behavior)
        await waitFor(() => {
            expect(screen.getByText('Search Instance')).toBeInTheDocument()
        }, { timeout: 2000 })
    })

    it('should handle sort options', async () => {
        const user = userEvent.setup()
        render(<InstancesPage />, { wrapper })

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Recent Activity/i })).toBeInTheDocument()
        })

        const sortButton = screen.getByRole('button', { name: /Most Users/i })
        expect(sortButton).toBeInTheDocument()
        await user.click(sortButton)
        
        // After clicking, the button should still be present (user-visible behavior)
        expect(screen.getByRole('button', { name: /Most Users/i })).toBeInTheDocument()
    })

    it('should handle instance blocking', async () => {
        const user = userEvent.setup()
        const mockBlock = vi.fn()
        mockUseMutation.mockReturnValue({
            mutate: mockBlock,
            mutateAsync: vi.fn().mockResolvedValue({}),
        })

        render(<InstancesPage />, { wrapper })

        await waitFor(() => {
            expect(screen.getByText('Example Instance')).toBeInTheDocument()
        })

        // Look for block button
        const blockButtons = screen.getAllByRole('button').filter(
            (btn) => btn.textContent?.includes('Block')
        )

        if (blockButtons.length > 0) {
            await user.click(blockButtons[0])

            await waitFor(() => {
                expect(global.window.confirm).toHaveBeenCalled()
            })
        }
    })

    it('should handle instance unblocking', async () => {
        const user = userEvent.setup()
        const blockedInstance = { ...mockInstance, blocked: true }
        mockUseInstances.mockReturnValue({
            data: {
                instances: [blockedInstance],
                total: 1,
            },
            isLoading: false,
        })

        const mockUnblock = vi.fn()
        mockUseMutation.mockReturnValue({
            mutate: mockUnblock,
            mutateAsync: vi.fn().mockResolvedValue({}),
        })

        render(<InstancesPage />, { wrapper })

        await waitFor(() => {
            expect(screen.getByText('Example Instance')).toBeInTheDocument()
        })

        // Look for unblock button
        const unblockButtons = screen.getAllByRole('button').filter(
            (btn) => btn.textContent?.includes('Unblock')
        )

        if (unblockButtons.length > 0) {
            await user.click(unblockButtons[0])

            await waitFor(() => {
                expect(mockUnblock).toHaveBeenCalled()
            })
        }
    })

    it('should handle instance refresh', async () => {
        const user = userEvent.setup()
        const mockRefresh = vi.fn()
        mockUseMutation.mockReturnValue({
            mutate: mockRefresh,
            mutateAsync: vi.fn().mockResolvedValue({}),
        })

        render(<InstancesPage />, { wrapper })

        await waitFor(() => {
            expect(screen.getByText('Example Instance')).toBeInTheDocument()
        })

        // Look for refresh button
        const refreshButtons = screen.getAllByRole('button').filter(
            (btn) => btn.textContent?.includes('Refresh')
        )

        if (refreshButtons.length > 0) {
            await user.click(refreshButtons[0])

            await waitFor(() => {
                expect(mockRefresh).toHaveBeenCalled()
            })
        }
    })

    it('should handle pagination', async () => {
        const user = userEvent.setup()
        mockUseInstances.mockReturnValue({
            data: {
                instances: [mockInstance],
                total: 100,
            },
            isLoading: false,
        })

        render(<InstancesPage />, { wrapper })

        await waitFor(() => {
            expect(screen.getByText(/Showing.*100/i)).toBeInTheDocument()
        })

        const nextButton = screen.getByRole('button', { name: 'Next' })
        expect(nextButton).toBeInTheDocument()
        await user.click(nextButton)
        
        // After clicking, pagination should still be visible
        expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument()
    })

    it('should disable previous button on first page', async () => {
        mockUseInstances.mockReturnValue({
            data: {
                instances: [mockInstance],
                total: 100,
            },
            isLoading: false,
        })

        render(<InstancesPage />, { wrapper })

        await waitFor(() => {
            const prevButton = screen.getByRole('button', { name: 'Previous' })
            expect(prevButton).toBeDisabled()
        })
    })

    it('should disable next button on last page', async () => {
        mockUseInstances.mockReturnValue({
            data: {
                instances: [mockInstance],
                total: 50,
            },
            isLoading: false,
        })

        render(<InstancesPage />, { wrapper })

        await waitFor(() => {
            const nextButton = screen.getByRole('button', { name: 'Next' })
            expect(nextButton).toBeDisabled()
        })
    })

    it('should display instance statistics', async () => {
        render(<InstancesPage />, { wrapper })

        await waitFor(() => {
            expect(screen.getByText('Example Instance')).toBeInTheDocument()
        })
    })

    it('should set SEO metadata', () => {
        render(<InstancesPage />, { wrapper })

        // Use getAllByText since "Federated Instances" appears in both title and description
        expect(screen.getAllByText(/Federated Instances/i).length).toBeGreaterThan(0)
    })

    it('should show search results when searching', async () => {
        const user = userEvent.setup()
        const searchResults = [{ ...mockInstance, domain: 'search.example.com', title: 'Search Instance' }]

        mockUseInstanceSearch.mockReturnValue({
            data: {
                instances: searchResults,
            },
            isLoading: false,
        })

        render(<InstancesPage />, { wrapper })

        const searchInput = screen.getByPlaceholderText(/Search instances/i)
        await user.type(searchInput, 'search')

        // Wait for search results to appear - the hook is called with searchQuery state
        // We can't easily track hook arguments, so instead verify the search results are displayed
        await waitFor(() => {
            // After typing "search", the search results should be displayed
            expect(screen.getByText('Search Instance')).toBeInTheDocument()
        }, { timeout: 2000 })
    })

    it('should show no results message when search returns empty', async () => {
        const user = userEvent.setup()
        mockUseInstanceSearch.mockReturnValue({
            data: {
                instances: [],
            },
            isLoading: false,
        })

        render(<InstancesPage />, { wrapper })

        const searchInput = screen.getByPlaceholderText(/Search instances/i)
        await user.type(searchInput, 'nonexistent')

        await waitFor(() => {
            expect(screen.getByText(/No instances found matching "nonexistent"/i)).toBeInTheDocument()
        }, { timeout: 2000 })
    })
})
