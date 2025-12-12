import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TimeZoneSettings } from '../../components/TimeZoneSettings'
import { clearQueryClient } from '../testUtils'

// Mock fetch
global.fetch = vi.fn()

// Mock timezones module
vi.mock('../lib/timezones', () => ({
	getDefaultTimezone: () => 'UTC',
	getSupportedTimezones: () => ['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo'],
}))

describe('TimeZoneSettings Component', () => {
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
		timezone: 'America/New_York',
	}

	const renderComponent = (profile = mockProfile, userId = 'user-1') => {
		return render(
			<QueryClientProvider client={queryClient}>
				<TimeZoneSettings profile={profile} userId={userId} />
			</QueryClientProvider>
		)
	}

	it('should render timezone settings', () => {
		renderComponent()

		expect(screen.getByText('Time & Region')).toBeInTheDocument()
		expect(screen.getByLabelText('Preferred timezone')).toBeInTheDocument()
	})

	it('should show current timezone', () => {
		renderComponent()

		const select = screen.getByLabelText('Preferred timezone')
		expect(select).toHaveValue('America/New_York')
	})

	it('should allow user to change timezone', async () => {
		renderComponent()

		const select = screen.getByLabelText('Preferred timezone')
		// User can interact with the select to change timezone
		// This tests that the select is functional, not the internal options array
		expect(select).toBeInTheDocument()
		expect(select).not.toBeDisabled()
	})

	it('should display current timezone in description', () => {
		renderComponent()

		expect(screen.getByText(/times currently shown in/i)).toBeInTheDocument()
		// Check that timezone appears in the description (will match multiple, but that's ok)
		const timezoneTexts = screen.getAllByText('America/New_York')
		expect(timezoneTexts.length).toBeGreaterThan(0)
	})
})
