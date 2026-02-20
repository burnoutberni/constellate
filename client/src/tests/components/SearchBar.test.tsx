import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Mock } from 'vitest'
import { SearchBar } from '../../components/SearchBar'
import { createTestWrapper, clearQueryClient } from '../testUtils'
import { api } from '../../lib/api-client'

// Mock dependencies
const mockUseQuery = vi.fn()

vi.mock('@tanstack/react-query', async () => {
	const actual = await vi.importActual('@tanstack/react-query')
	return {
		...actual,
		useQuery: () => mockUseQuery(),
	}
})

vi.mock('../../lib/api-client', () => ({
	api: {
		get: vi.fn(),
		post: vi.fn(),
	},
}))

const { wrapper, queryClient } = createTestWrapper()

describe('SearchBar Component', () => {
	beforeEach(() => {
		clearQueryClient(queryClient)
		vi.clearAllMocks()
		// Mock api.get to return empty results
		;(api.get as Mock).mockResolvedValue({
			users: [],
			events: [],
			remoteAccountSuggestion: null,
		})
	})

	it('should render search input', () => {
		render(<SearchBar />, { wrapper })
		expect(screen.getByPlaceholderText(/search events, users/i)).toBeInTheDocument()
	})

	it('should show clear button when typing', async () => {
		const user = userEvent.setup()
		render(<SearchBar />, { wrapper })

		const input = screen.getByPlaceholderText(/search events, users/i)
		await user.type(input, 'test')

        // Wait for loading to finish (debounce + async call)
        await waitFor(() => {
            expect(screen.getByLabelText('Clear search')).toBeInTheDocument()
        })
	})

	it('should not show clear button when empty', () => {
		render(<SearchBar />, { wrapper })
		const clearButton = screen.queryByLabelText('Clear search')
		expect(clearButton).not.toBeInTheDocument()
	})

	it('should clear input and focus when clear button is clicked', async () => {
		const user = userEvent.setup()
		render(<SearchBar />, { wrapper })

		const input = screen.getByPlaceholderText(/search events, users/i)
		await user.type(input, 'test')

        // Wait for clear button to appear
        await waitFor(() => {
            expect(screen.getByLabelText('Clear search')).toBeInTheDocument()
        })

		const clearButton = screen.getByLabelText('Clear search')
		await user.click(clearButton)

		expect(input).toHaveValue('')
		expect(input).toHaveFocus()
	})
})
