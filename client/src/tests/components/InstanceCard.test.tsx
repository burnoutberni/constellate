import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { InstanceCard } from '../../components/InstanceCard'
import type { InstanceWithStats } from '../../types'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom')
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    }
})

// Mock api client
const mockGet = vi.fn()
vi.mock('../../lib/api-client', () => ({
    api: {
        get: (...args: unknown[]) => mockGet(...args)
    },
}))

const mockUseAuth = vi.fn()
vi.mock('../../hooks/useAuth', () => ({
    useAuth: () => mockUseAuth(),
}))

const createMockInstance = (overrides?: Partial<InstanceWithStats>): InstanceWithStats => ({
    id: '1',
    domain: 'instance.social',
    baseUrl: 'https://instance.social',
    title: 'Instance Social',
    description: 'A social instance',
    version: '1.0.0',
    software: 'Mastodon',
    iconUrl: 'https://instance.social/icon.png',
    userCount: 100,
    eventCount: 50,
    isBlocked: false,
    lastActivityAt: new Date().toISOString(),
    lastFetchedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    stats: {
        remoteUsers: 10,
        remoteEvents: 5,
        localFollowing: 2,
    },
    ...overrides,
})

const queryClient = new QueryClient({
    defaultOptions: {
        queries: { retry: false },
    },
})

describe('InstanceCard', () => {
    beforeEach(() => {
        mockUseAuth.mockReturnValue({ user: { id: 'admin', isAdmin: true }, loading: false })
        mockGet.mockResolvedValue({ isAdmin: true }) // Default to admin
        queryClient.clear()
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.clearAllMocks()
    })

    it('renders instance information correctly', () => {
        const instance = createMockInstance()
        render(
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>
                    <InstanceCard instance={instance} />
                </BrowserRouter>
            </QueryClientProvider>
        )

        expect(screen.getByText('Instance Social')).toBeInTheDocument()
        expect(screen.getByText('instance.social')).toBeInTheDocument()
        expect(screen.getByText('100')).toBeInTheDocument() // Users
        expect(screen.getByText('50')).toBeInTheDocument() // Events
    })

    it('shows block and refresh buttons for admin', async () => {
        const instance = createMockInstance()
        render(
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>
                    <InstanceCard instance={instance} />
                </BrowserRouter>
            </QueryClientProvider>
        )

        expect(await screen.findByRole('button', { name: /Block/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Refresh/i })).toBeInTheDocument()
    })

    it('does not show admin buttons for non-admin', () => {
        mockUseAuth.mockReturnValue({ user: { id: 'user', isAdmin: false }, loading: false })
        const instance = createMockInstance()
        render(
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>
                    <InstanceCard instance={instance} />
                </BrowserRouter>
            </QueryClientProvider>
        )

        expect(screen.queryByText('Block')).not.toBeInTheDocument()
        expect(screen.queryByText('Refresh')).not.toBeInTheDocument()
    })

    it('handles refresh cooldown logic', async () => {
        vi.useFakeTimers({ toFake: ['Date'] })
        const onRefresh = vi.fn()
        const now = Date.now()
        vi.setSystemTime(now)

        // Case 1: Never fetched (should be enabled)
        const neverFetched = createMockInstance({ lastFetchedAt: undefined })
        const { unmount } = render(
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>
                    <InstanceCard instance={neverFetched} onRefresh={onRefresh} />
                </BrowserRouter>
            </QueryClientProvider>
        )

        const refreshBtn = await screen.findByRole('button', { name: 'Refresh' })
        expect(refreshBtn).not.toBeDisabled()
        fireEvent.click(refreshBtn)
        expect(onRefresh).toHaveBeenCalledWith('instance.social')
        unmount()

        // Case 2: Recently fetched (within 30s) -> Disabled
        const recentFetched = createMockInstance({ lastFetchedAt: new Date(now - 10000).toISOString() })
        render(
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>
                    <InstanceCard instance={recentFetched} onRefresh={onRefresh} />
                </BrowserRouter>
            </QueryClientProvider>
        )
        const refreshBtnDisabled = await screen.findByRole('button', { name: /Refresh/i })
        expect(refreshBtnDisabled).toBeDisabled()

        // cleanup for next test part
    })

    it('shows "Refreshed!" state immediately after fetch', async () => {
        vi.useFakeTimers({ toFake: ['Date'] })
        const now = Date.now()
        vi.setSystemTime(now)
        // Within 5 seconds
        const justFetched = createMockInstance({ lastFetchedAt: new Date(now - 2000).toISOString() })

        render(
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>
                    <InstanceCard instance={justFetched} />
                </BrowserRouter>
            </QueryClientProvider>
        )

        expect(await screen.findByRole('button', { name: /Refreshed!/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Refreshed!/i })).toBeDisabled()
    })
})
