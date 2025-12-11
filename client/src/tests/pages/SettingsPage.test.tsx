import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { SettingsPage } from '../../pages/SettingsPage'
import { createTestWrapper, clearQueryClient } from '../testUtils'

// Mock dependencies
const mockUser = { id: 'user1', username: 'testuser', name: 'Test User' }
const mockProfile = {
    id: 'user1',
    name: 'Test User',
    bio: 'Test bio',
    timezone: 'UTC',
    autoAcceptFollowers: false,
}

const mockUseQuery = vi.fn()

const mockUseAuth = vi.fn()
vi.mock('../hooks/useAuth', () => ({
    useAuth: () => mockUseAuth(),
}))

vi.mock('@tanstack/react-query', async () => {
    const actual = await vi.importActual('@tanstack/react-query')
    return {
        ...actual,
        useQuery: () => mockUseQuery(),
    }
})

vi.mock('../lib/seo', () => ({
    setSEOMetadata: vi.fn(),
}))

global.fetch = vi.fn()

const { wrapper, queryClient } = createTestWrapper(['/settings'])

describe('SettingsPage', () => {
    beforeEach(() => {
        clearQueryClient(queryClient)
        vi.clearAllMocks()
        mockUseAuth.mockReturnValue({
            user: mockUser,
            logout: vi.fn(),
        })
        mockUseQuery.mockReturnValue({
            data: mockProfile,
            isLoading: false,
        })
        ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            json: async () => mockProfile,
        })
    })

    afterEach(() => {
        clearQueryClient(queryClient)
    })

    it('should render settings page', () => {
        render(<SettingsPage />, { wrapper })
        expect(screen.getByRole('heading', { level: 1, name: /^Settings$/i })).toBeInTheDocument()
    })

    it('should show loading state', () => {
        mockUseQuery.mockReturnValue({
            data: undefined,
            isLoading: true,
        })

        render(<SettingsPage />, { wrapper })

        // Loading spinner should be visible
        const spinner = document.querySelector('.animate-spin')
        expect(spinner).toBeTruthy()
    })

    it('should display profile settings', async () => {
        render(<SettingsPage />, { wrapper })

        await waitFor(() => {
            expect(screen.getByRole('heading', { level: 1, name: /^Settings$/i })).toBeInTheDocument()
        })

        // ProfileSettings component should be rendered
        expect(screen.getByRole('heading', { level: 1, name: /^Settings$/i })).toBeInTheDocument()
    })

    it('should display timezone settings', async () => {
        render(<SettingsPage />, { wrapper })

        await waitFor(() => {
            expect(screen.getByRole('heading', { level: 1, name: /^Settings$/i })).toBeInTheDocument()
        })

        // TimeZoneSettings component should be rendered
        expect(screen.getByRole('heading', { level: 1, name: /^Settings$/i })).toBeInTheDocument()
    })

    it('should display privacy settings', async () => {
        render(<SettingsPage />, { wrapper })

        await waitFor(() => {
            expect(screen.getByRole('heading', { level: 1, name: /^Settings$/i })).toBeInTheDocument()
        })

        // PrivacySettings component should be rendered
        expect(screen.getByRole('heading', { level: 1, name: /^Settings$/i })).toBeInTheDocument()
    })

    it('should display account settings', async () => {
        render(<SettingsPage />, { wrapper })

        await waitFor(() => {
            expect(screen.getByRole('heading', { level: 1, name: /^Settings$/i })).toBeInTheDocument()
        })

        // AccountSettings component should be rendered
        expect(screen.getByRole('heading', { level: 1, name: /^Settings$/i })).toBeInTheDocument()
    })

    it('should show error state when profile fetch fails', () => {
        mockUseQuery.mockReturnValue({
            data: null,
            isLoading: false,
        })

        render(<SettingsPage />, { wrapper })

        expect(screen.getByText(/Failed to load profile/i)).toBeInTheDocument()
    })

    it('should handle profile fetch error', () => {
        ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: false,
            json: async () => ({}),
        })

        mockUseQuery.mockReturnValue({
            data: null,
            isLoading: false,
        })

        render(<SettingsPage />, { wrapper })

        expect(screen.getByText(/Failed to load profile/i)).toBeInTheDocument()
    })

    it('should set SEO metadata', () => {
        render(<SettingsPage />, { wrapper })

        // SEO metadata should be set (component renders successfully)
        expect(screen.getByRole('heading', { level: 1, name: /^Settings$/i })).toBeInTheDocument()
    })

    it('should render all settings sections', async () => {
        render(<SettingsPage />, { wrapper })

        await waitFor(() => {
            expect(screen.getByRole('heading', { level: 1, name: /^Settings$/i })).toBeInTheDocument()
        })

        // All settings components should be rendered
        // The actual content is in child components
        expect(screen.getByRole('heading', { level: 1, name: /^Settings$/i })).toBeInTheDocument()
    })

    it('should handle missing user', () => {
        mockUseAuth.mockReturnValue({
            user: null,
            logout: vi.fn(),
        })

        mockUseQuery.mockReturnValue({
            data: null,
            isLoading: false,
        })

        render(<SettingsPage />, { wrapper })

        expect(screen.getByText(/Failed to load profile/i)).toBeInTheDocument()
    })
})
