import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SearchBar } from '../../components/SearchBar'
import { createTestWrapper } from '../testUtils'

// Mock api client
vi.mock('../../lib/api-client', () => ({
	api: {
		get: vi.fn(),
		post: vi.fn(),
	},
}))

describe('SearchBar', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('renders correctly', () => {
		const { wrapper } = createTestWrapper()
		render(<SearchBar />, { wrapper })
		expect(
			screen.getByPlaceholderText('Search events, users, or @user@domain...')
		).toBeInTheDocument()
	})

	it('updates query on input change', () => {
		const { wrapper } = createTestWrapper()
		render(<SearchBar />, { wrapper })
		const input = screen.getByPlaceholderText('Search events, users, or @user@domain...')
		fireEvent.change(input, { target: { value: 'test' } })
		expect(input).toHaveValue('test')
	})

	it('shows clear button when text is entered', () => {
		const { wrapper } = createTestWrapper()
		render(<SearchBar />, { wrapper })
		const input = screen.getByPlaceholderText('Search events, users, or @user@domain...')

		// Initially no clear button
		expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument()

		// Enter text
		fireEvent.change(input, { target: { value: 'test' } })

		const clearButton = screen.getByLabelText('Clear search')
		expect(clearButton).toBeInTheDocument()
	})

	it('clears search and focuses input when clear button is clicked', () => {
		const { wrapper } = createTestWrapper()
		render(<SearchBar />, { wrapper })
		const input = screen.getByPlaceholderText('Search events, users, or @user@domain...')

		fireEvent.change(input, { target: { value: 'test' } })

		const clearButton = screen.getByLabelText('Clear search')
		fireEvent.click(clearButton)

		expect(input).toHaveValue('')
		expect(input).toHaveFocus()
	})
})
