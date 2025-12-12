import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PrivacySettings } from '../../components/PrivacySettings'
import { clearQueryClient } from '../testUtils'

// Mock fetch
global.fetch = vi.fn()

describe('PrivacySettings Component', () => {
	let queryClient: QueryClient

	beforeEach(() => {
		queryClient = new QueryClient({
			defaultOptions: {
				queries: {
					retry: false,
					gcTime: 0,
					staleTime: 0,
					refetchOnMount: false,
					refetchOnWindowFocus: false,
					refetchOnReconnect: false,
				},
				mutations: { retry: false, gcTime: 0 },
			},
		})
		clearQueryClient(queryClient)
		vi.clearAllMocks()
	})

	afterEach(() => {
		clearQueryClient(queryClient)
	})

	const mockProfile = {
		autoAcceptFollowers: true,
	}

	const renderComponent = (profile = mockProfile, userId = 'user-1') => {
		return render(
			<QueryClientProvider client={queryClient}>
				<PrivacySettings profile={profile} userId={userId} />
			</QueryClientProvider>
		)
	}

	it('should render privacy settings', () => {
		renderComponent()

		expect(screen.getByText('Privacy Settings')).toBeInTheDocument()
		expect(screen.getByText('Auto-accept followers')).toBeInTheDocument()
	})

	it('should show toggle button for auto-accept followers', () => {
		renderComponent()

		const toggle = screen.getByRole('switch', { name: /auto-accept followers/i })
		expect(toggle).toBeInTheDocument()
		expect(toggle).toHaveAttribute('aria-checked', 'true')
	})

	it('should show toggle as off when autoAcceptFollowers is false', () => {
		renderComponent({ autoAcceptFollowers: false })

		const toggle = screen.getByRole('switch', { name: /auto-accept followers/i })
		expect(toggle).toHaveAttribute('aria-checked', 'false')
	})

	it('should toggle switch when clicked', () => {
		;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			ok: true,
			json: async () => ({ autoAcceptFollowers: false }),
		})

		renderComponent()

		const toggle = screen.getByRole('switch', { name: /auto-accept followers/i })
		fireEvent.click(toggle)

		// Should show as toggled (optimistic update)
		expect(toggle).toHaveAttribute('aria-checked', 'false')
	})
})
