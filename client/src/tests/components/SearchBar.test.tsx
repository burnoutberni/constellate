import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchBar } from '../../components/SearchBar'
import { createTestWrapper } from '../testUtils'
import { api } from '@/lib/api-client'

// Mock api client
vi.mock('@/lib/api-client', () => ({
	api: {
		get: vi.fn(),
		post: vi.fn(),
	},
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
	createLogger: () => ({
		error: vi.fn(),
		info: vi.fn(),
	}),
}))

const { wrapper } = createTestWrapper()

describe('SearchBar Component', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('should render search input with accessible label', () => {
		render(<SearchBar />, { wrapper })
		// This might fail before the refactor if aria-label is missing,
		// but checking for placeholder first to verify basic render if needed.
        // We expect the refactor to add the label.
		expect(screen.getByLabelText(/Search events, users/i)).toBeInTheDocument()
	})

	it('should have correct accessibility attributes', () => {
		render(<SearchBar />, { wrapper })
		// We expect the input to have role="combobox"
		const input = screen.getByRole('combobox')

		expect(input).toHaveAttribute('aria-autocomplete', 'list')
		expect(input).toHaveAttribute('aria-expanded', 'false')
	})

	it('should show results and manage focus', async () => {
		vi.useRealTimers()
		const user = userEvent.setup()
		const mockResults = {
			users: [
				{ id: '1', username: 'testuser', name: 'Test User' },
				{ id: '2', username: 'other', name: 'Other User' },
			],
			events: [],
			remoteAccountSuggestion: null,
		}

		vi.mocked(api.get).mockResolvedValue(mockResults)

		render(<SearchBar />, { wrapper })
		const input = screen.getByRole('combobox')

		await user.type(input, 'test')

		await waitFor(() => {
			// Expect the listbox to appear
			expect(screen.getByRole('listbox')).toBeInTheDocument()
		})

		expect(input).toHaveAttribute('aria-expanded', 'true')
		expect(input).toHaveAttribute('aria-controls', 'search-results-listbox')

		// Test keyboard navigation
		await user.keyboard('{ArrowDown}')

		const options = screen.getAllByRole('option')
		expect(options[0]).toHaveAttribute('aria-selected', 'true')

		// Check active descendant
		expect(input).toHaveAttribute('aria-activedescendant', options[0].id)
	})
})
