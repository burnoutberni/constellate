import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SearchBar } from '../../components/SearchBar'
import { createTestWrapper } from '../testUtils'
import { api } from '@/lib/api-client'

// Mock API
vi.mock('@/lib/api-client', () => ({
	api: {
		get: vi.fn(),
		post: vi.fn(),
	},
}))

describe('SearchBar Component', () => {
	const { wrapper } = createTestWrapper()

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('should render search input', () => {
		render(<SearchBar />, { wrapper })
		expect(screen.getByPlaceholderText(/Search events, users/i)).toBeInTheDocument()
	})

	it('should show clear button after search finishes', async () => {
		// Mock API response
		vi.mocked(api.get).mockResolvedValue({
			users: [],
			events: [],
			remoteAccountSuggestion: null,
		})

		render(<SearchBar />, { wrapper })
		const input = screen.getByPlaceholderText(/Search events, users/i)

		// Type something
		fireEvent.change(input, { target: { value: 'test' } })

		// Wait for clear button to appear (after debounce and API call)
		await waitFor(
			() => {
				expect(screen.getByLabelText('Clear search')).toBeInTheDocument()
			},
			{ timeout: 2000 }
		)
	})

	it('should clear input and focus when clear button is clicked', async () => {
		vi.mocked(api.get).mockResolvedValue({
			users: [],
			events: [],
			remoteAccountSuggestion: null,
		})

		render(<SearchBar />, { wrapper })
		const input = screen.getByPlaceholderText(/Search events, users/i) as HTMLInputElement

		// Type something
		fireEvent.change(input, { target: { value: 'test' } })

		// Wait for clear button
		await waitFor(
			() => {
				expect(screen.getByLabelText('Clear search')).toBeInTheDocument()
			},
			{ timeout: 2000 }
		)

		const clearButton = screen.getByLabelText('Clear search')
		fireEvent.click(clearButton)

		// Verify input is cleared and focused
		expect(input.value).toBe('')
		expect(input).toHaveFocus()
	})
})
