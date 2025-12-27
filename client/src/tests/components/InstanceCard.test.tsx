import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import '@testing-library/jest-dom'

import { InstanceCard } from '../../components/InstanceCard'
import { api } from '../../lib/api-client'
import { createTestWrapper } from '../testUtils'
import { useAuth } from '../../hooks/useAuth'

// Mock API
vi.mock('../../lib/api-client', () => ({
    api: {
        get: vi.fn(),
    },
}))

// Mock useAuth
vi.mock('../../hooks/useAuth', () => ({
    useAuth: vi.fn(),
}))

describe('InstanceCard', () => {
    const mockInstance = {
        id: '1',
        domain: 'example.com',
        baseUrl: 'https://example.com',
        title: 'Example Instance',
        software: 'Mastodon',
        version: '4.2.0',
        userCount: 1000,
        eventCount: 500,
        isBlocked: false,
        lastActivityAt: new Date().toISOString(),
        stats: {
            remoteUsers: 10,
            remoteEvents: 20,
            localFollowing: 5,
        },
    }

    const mockAdminUser = {
        id: 'user-1',
        username: 'admin',
        isAdmin: true,
    }

    const mockRegularUser = {
        id: 'user-2',
        username: 'user',
        isAdmin: false,
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders basic instance information', () => {
        vi.mocked(useAuth).mockReturnValue({
            user: mockRegularUser,
        } as unknown as ReturnType<typeof useAuth>)
        vi.mocked(api.get).mockResolvedValue(mockRegularUser)

        const { wrapper } = createTestWrapper()
        render(
            <InstanceCard
                instance={mockInstance}
            />,
            { wrapper }
        )

        expect(screen.getByText('Example Instance')).toBeInTheDocument()
        expect(screen.getByText('example.com')).toBeInTheDocument()
        expect(screen.getByText(/Mastodon/)).toBeInTheDocument()
        expect(screen.getByText(/4.2.0/)).toBeInTheDocument()
        expect(screen.getByText('1,000')).toBeInTheDocument() // Users
        expect(screen.getByText('500')).toBeInTheDocument() // Events
    })

    it('shows blocked badge when instance is blocked', () => {
        vi.mocked(useAuth).mockReturnValue({
            user: mockRegularUser,
        } as unknown as ReturnType<typeof useAuth>)
        vi.mocked(api.get).mockResolvedValue(mockRegularUser)

        const blockedInstance = { ...mockInstance, isBlocked: true }

        const { wrapper } = createTestWrapper()
        render(
            <InstanceCard
                instance={blockedInstance}
            />,
            { wrapper }
        )

        expect(screen.getByText('Blocked')).toBeInTheDocument()
    })

    it('shows admin actions for admin user', async () => {
        vi.mocked(useAuth).mockReturnValue({
            user: mockAdminUser,
        } as unknown as ReturnType<typeof useAuth>)
        vi.mocked(api.get).mockResolvedValue(mockAdminUser)

        const { wrapper } = createTestWrapper()
        render(
            <InstanceCard
                instance={mockInstance}
                onBlock={vi.fn()}
                onRefresh={vi.fn()}
            />,
            { wrapper }
        )

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Block' })).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument()
        })
    })

    it('hides admin actions for regular user', async () => {
        vi.mocked(useAuth).mockReturnValue({
            user: mockRegularUser,
        } as unknown as ReturnType<typeof useAuth>)
        vi.mocked(api.get).mockResolvedValue(mockRegularUser)

        const { wrapper } = createTestWrapper()
        render(
            <InstanceCard
                instance={mockInstance}
                onBlock={vi.fn()}
            />,
            { wrapper }
        )

        await waitFor(() => {
            expect(screen.queryByRole('button', { name: 'Block' })).not.toBeInTheDocument()
        })
    })

    it('calls callbacks when actions clicked', async () => {
        vi.mocked(useAuth).mockReturnValue({
            user: mockAdminUser,
        } as unknown as ReturnType<typeof useAuth>)
        vi.mocked(api.get).mockResolvedValue(mockAdminUser)

        const onBlock = vi.fn()
        const onRefresh = vi.fn()

        const { wrapper } = createTestWrapper()
        render(
            <InstanceCard
                instance={mockInstance}
                onBlock={onBlock}
                onRefresh={onRefresh}
            />,
            { wrapper }
        )

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Block' })).toBeInTheDocument()
        })

        fireEvent.click(screen.getByRole('button', { name: 'Block' }))
        expect(onBlock).toHaveBeenCalledWith('example.com')

        fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
        expect(onRefresh).toHaveBeenCalledWith('example.com')
    })

    it('shows unblock button for blocked instance (admin)', async () => {
        vi.mocked(useAuth).mockReturnValue({
            user: mockAdminUser,
        } as unknown as ReturnType<typeof useAuth>)
        vi.mocked(api.get).mockResolvedValue(mockAdminUser)

        const blockedInstance = { ...mockInstance, isBlocked: true }
        const onUnblock = vi.fn()

        const { wrapper } = createTestWrapper()
        render(
            <InstanceCard
                instance={blockedInstance}
                onUnblock={onUnblock}
            />,
            { wrapper }
        )

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Unblock' })).toBeInTheDocument()
        })

        fireEvent.click(screen.getByRole('button', { name: 'Unblock' }))
        expect(onUnblock).toHaveBeenCalledWith('example.com')
    })

    it('shows refreshing state', async () => {
        vi.mocked(useAuth).mockReturnValue({
            user: mockAdminUser,
        } as unknown as ReturnType<typeof useAuth>)
        vi.mocked(api.get).mockResolvedValue(mockAdminUser)

        const { wrapper } = createTestWrapper()
        render(
            <InstanceCard
                instance={mockInstance}
                isRefreshing={true}
            />,
            { wrapper }
        )

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Refreshing...' })).toBeDisabled()
        })
    })
})
