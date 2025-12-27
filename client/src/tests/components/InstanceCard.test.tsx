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

    it('shows refreshing state when isRefreshing prop is true', async () => {
        const instance = createMockInstance()
        const onRefresh = vi.fn()

        render(
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>
                    <InstanceCard
                        instance={instance}
                        onRefresh={onRefresh}
                        isRefreshing={true}
                    />
                </BrowserRouter>
            </QueryClientProvider>
        )

        const refreshBtn = await screen.findByRole('button', { name: /Refreshing.../i })
        expect(refreshBtn).toBeInTheDocument()
        expect(refreshBtn).toBeDisabled()
    })

    it('shows normal refresh button when isRefreshing is false', async () => {
        const instance = createMockInstance()
        const onRefresh = vi.fn()

        render(
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>
                    <InstanceCard
                        instance={instance}
                        onRefresh={onRefresh}
                        isRefreshing={false}
                    />
                </BrowserRouter>
            </QueryClientProvider>
        )

        const refreshBtn = await screen.findByRole('button', { name: /Refresh/i })
        expect(refreshBtn).toBeInTheDocument()
        expect(refreshBtn).not.toBeDisabled()

        fireEvent.click(refreshBtn)
        expect(onRefresh).toHaveBeenCalledWith('instance.social')
    })
})
