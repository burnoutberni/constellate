import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SearchBar } from '../../components/SearchBar'
import { createTestWrapper } from '../testUtils'

// Hoist mocks
const { mockGet, mockPost } = vi.hoisted(() => {
	return {
		mockGet: vi.fn(),
		mockPost: vi.fn(),
	}
})

vi.mock('@/lib/api-client', () => ({
	api: {
		get: mockGet,
		post: mockPost,
	},
}))

describe('SearchBar', () => {
	const { wrapper } = createTestWrapper()

	beforeEach(() => {
		vi.clearAllMocks()
		mockGet.mockResolvedValue({ users: [], events: [], remoteAccountSuggestion: null })
	})

	it('should render search input', () => {
		render(<SearchBar />, { wrapper })
		const input = screen.getByPlaceholderText(/Search events, users/)
		expect(input).toBeInTheDocument()
	})

	it('should show clear button when typing', async () => {
		render(<SearchBar />, { wrapper })
		const input = screen.getByPlaceholderText(/Search events, users/)

		fireEvent.change(input, { target: { value: 'test' } })

		expect(input).toHaveValue('test')
		expect(screen.getByLabelText('Clear search')).toBeInTheDocument()
	})

	it('should clear input when clear button is clicked', async () => {
		render(<SearchBar />, { wrapper })
		const input = screen.getByPlaceholderText(/Search events, users/)

		fireEvent.change(input, { target: { value: 'test' } })
		const clearButton = screen.getByLabelText('Clear search')

		fireEvent.click(clearButton)

		expect(input).toHaveValue('')
		expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument()
		expect(input).toHaveFocus()
	})

	it('should show spinner when searching', async () => {
		// Mock API to delay response
		mockGet.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ users: [], events: [], remoteAccountSuggestion: null }), 100)))

		render(<SearchBar />, { wrapper })
		const input = screen.getByPlaceholderText(/Search events, users/)

		fireEvent.change(input, { target: { value: 'test' } })

		// Wait for debounce (300ms) to trigger search
		await waitFor(() => {
             expect(screen.getByLabelText('Loading')).toBeInTheDocument()
        }, { timeout: 1000 })
	})
})
