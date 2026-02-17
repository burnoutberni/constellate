import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SearchBar } from '../../components/SearchBar'
import { createTestWrapper, clearQueryClient } from '../testUtils'
import { api } from '@/lib/api-client'

// Mock API
vi.mock('@/lib/api-client', () => ({
	api: {
		get: vi.fn(),
		post: vi.fn(),
	},
}))

describe('SearchBar', () => {
	const { wrapper, queryClient } = createTestWrapper()

	beforeEach(() => {
		vi.clearAllMocks()
        // Mock successful response to avoid errors in component
        const mockResults = { users: [], events: [], remoteAccountSuggestion: null }
        vi.mocked(api.get).mockResolvedValue(mockResults)
	})

	afterEach(() => {
		clearQueryClient(queryClient)
	})

	it('renders with accessibility label', () => {
		render(<SearchBar />, { wrapper })
		const input = screen.getByRole('textbox', { name: /search/i })
		expect(input).toBeInTheDocument()
	})

	it('shows clear button when text is entered', async () => {
		render(<SearchBar />, { wrapper })
		const input = screen.getByRole('textbox', { name: /search/i })

		// Initially no clear button
		expect(screen.queryByLabelText(/clear search/i)).not.toBeInTheDocument()

		// Type text
		fireEvent.change(input, { target: { value: 'test query' } })

		// Check clear button appears after debounce/loading
        await waitFor(() => {
		    expect(screen.getByLabelText(/clear search/i)).toBeInTheDocument()
        })
	})

	it('clears input and focuses when clear button is clicked', async () => {
		render(<SearchBar />, { wrapper })
		const input = screen.getByRole('textbox', { name: /search/i })

		// Type text
		fireEvent.change(input, { target: { value: 'test query' } })

		// Wait for clear button
        await waitFor(() => {
            expect(screen.getByLabelText(/clear search/i)).toBeInTheDocument()
        })

        const clearButton = screen.getByLabelText(/clear search/i)

		// Click clear
		fireEvent.click(clearButton)

		// Check input is empty
		expect(input).toHaveValue('')

		// Check input is focused
		expect(input).toHaveFocus()
	})
})
