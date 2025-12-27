import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InstanceDetailPage } from '../../pages/InstanceDetailPage'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '../../design-system'

// Mock Hooks
const mockUseInstanceDetail = vi.fn()
const mockUseInstanceEvents = vi.fn()
const mockUseBlockInstance = vi.fn()
const mockUseUnblockInstance = vi.fn()
const mockUseRefreshInstance = vi.fn()

vi.mock('../../hooks/queries', async () => {
    const actual = await vi.importActual('../../hooks/queries')
    return {
        ...actual,
        useInstanceDetail: (domain: string) => mockUseInstanceDetail(domain),
        useInstanceEvents: (domain: string, limit: number, offset: number, time: string) =>
            mockUseInstanceEvents(domain, limit, offset, time),
        useBlockInstance: () => mockUseBlockInstance(),
        useUnblockInstance: () => mockUseUnblockInstance(),
        useRefreshInstance: () => mockUseRefreshInstance(),
    }
})

const mockUseAuth = vi.fn()
vi.mock('../../hooks/useAuth', () => ({
    useAuth: () => mockUseAuth(),
}))

// Mock api client
const mockGet = vi.fn()
vi.mock('../../lib/api-client', () => ({
    api: {
        get: (...args: unknown[]) => mockGet(...args)
    },
}))

const queryClient = new QueryClient({
    defaultOptions: {
        queries: { retry: false },
    },
})

describe('InstanceDetailPage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseAuth.mockReturnValue({
            user: { id: 'admin', isAdmin: true },
            loading: false,
            logout: vi.fn()
        })

        mockUseBlockInstance.mockReturnValue({ mutate: vi.fn(), isPending: false })
        mockUseUnblockInstance.mockReturnValue({ mutate: vi.fn(), isPending: false })
        mockUseRefreshInstance.mockReturnValue({ mutate: vi.fn(), isPending: false })
        mockGet.mockResolvedValue({ isAdmin: true })
    })


    // ... imports

    const renderPage = (domain = 'test.social') => {
        return render(
            <QueryClientProvider client={queryClient}>
                <ThemeProvider>
                    <MemoryRouter initialEntries={[`/instances/${domain}`]}>
                        <Routes>
                            <Route path="/instances/:domain" element={<InstanceDetailPage />} />
                        </Routes>
                    </MemoryRouter>
                </ThemeProvider>
            </QueryClientProvider>
        )
    }

    it('renders loading state', () => {
        mockUseInstanceDetail.mockReturnValue({ isLoading: true })
        mockUseInstanceEvents.mockReturnValue({ isLoading: true })

        renderPage()
        expect(screen.getByText('Loading instance details...')).toBeInTheDocument()
    })

    it('renders error state', () => {
        mockUseInstanceDetail.mockReturnValue({ error: new Error('Failed to fetch') })

        renderPage()
        expect(screen.getByText('Failed to fetch')).toBeInTheDocument()
    })

    it('renders instance details and events', () => {
        mockUseInstanceDetail.mockReturnValue({
            data: {
                domain: 'test.social',
                title: 'Test Instance',
                stats: { remoteUsers: 10, remoteEvents: 5, localFollowing: 1 }
            },
            isLoading: false
        })

        mockUseInstanceEvents.mockReturnValue({
            data: {
                events: [
                    { id: '1', title: 'Event 1', startTime: new Date().toISOString() },
                    { id: '2', title: 'Event 2', startTime: new Date().toISOString() }
                ],
                total: 10,
                limit: 5,
                offset: 0
            },
            isLoading: false
        })

        renderPage()

        expect(screen.getAllByText('Test Instance').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Event 1').length).toBeGreaterThan(0)
    })

    it('handles pagination in EventsListSection', () => {
        mockUseInstanceDetail.mockReturnValue({
            data: {
                domain: 'test.social',
                stats: { remoteUsers: 0, remoteEvents: 0, localFollowing: 0 }
            },
            isLoading: false
        })

        // First render calls with offset 0
        mockUseInstanceEvents.mockReturnValue({
            data: {
                events: [{ id: '1', title: 'Event 1' }],
                total: 10,
                limit: 5,
                offset: 0
            },
            isLoading: false
        })

        renderPage()

        // Find next button for upcoming events (first one usually)
        const nextButtons = screen.getAllByText('Next')
        const nextButton = nextButtons[0]

        fireEvent.click(nextButton)

        // Verify hook was called with new offset
        expect(mockUseInstanceEvents).toHaveBeenCalledWith('test.social', 5, 5, 'upcoming')
    })

    it('calls mutation hooks on admin actions', () => {
        const mockBlock = vi.fn()
        mockUseBlockInstance.mockReturnValue({ mutate: mockBlock, isPending: false })

        const mockRefresh = vi.fn()
        mockUseRefreshInstance.mockReturnValue({ mutate: mockRefresh, isPending: false })

        mockUseInstanceDetail.mockReturnValue({
            data: {
                domain: 'test.social',
                isBlocked: false,
                stats: { remoteUsers: 0, remoteEvents: 0, localFollowing: 0 }
            },
            isLoading: false
        })
        mockUseInstanceEvents.mockReturnValue({ data: { events: [] }, isLoading: false })

        renderPage()

        fireEvent.click(screen.getByText('Block Instance'))
        // Confirm modal
        fireEvent.click(screen.getByText('Block'))

        expect(mockBlock).toHaveBeenCalledWith('test.social', expect.any(Object))

        fireEvent.click(screen.getByText('Refresh Instance'))
        expect(mockRefresh).toHaveBeenCalledWith('test.social')
    })
})
