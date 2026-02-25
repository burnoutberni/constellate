import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SearchBar } from '../../components/SearchBar'
import { createTestWrapper } from '../testUtils'

// Mock api
vi.mock('../../lib/api-client', () => ({
	api: {
		get: vi.fn(),
		post: vi.fn(),
	},
}))

describe('SearchBar', () => {
	it('renders the search input', () => {
		const { wrapper } = createTestWrapper()
		render(<SearchBar />, { wrapper })
		expect(screen.getByPlaceholderText(/Search events, users/i)).toBeInTheDocument()
	})

	it('does not show clear button initially', () => {
		const { wrapper } = createTestWrapper()
		render(<SearchBar />, { wrapper })
		// Clear button should not be present (aria-label="Clear search")
		expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument()
	})

	it('updates query when typing', async () => {
		const { wrapper } = createTestWrapper()
		render(<SearchBar />, { wrapper })
		const input = screen.getByPlaceholderText(/Search events, users/i)

		fireEvent.change(input, { target: { value: 'test query' } })

		expect(input).toHaveValue('test query')
	})

	it('shows clear button when text is typed', async () => {
		const { wrapper } = createTestWrapper()
		render(<SearchBar />, { wrapper })
		const input = screen.getByPlaceholderText(/Search events, users/i)

		fireEvent.change(input, { target: { value: 'test' } })

		await waitFor(() => {
			expect(screen.getByLabelText('Clear search')).toBeInTheDocument()
		})
	})

	it('clears query and focuses input when clear button is clicked', async () => {
		const { wrapper } = createTestWrapper()
		render(<SearchBar />, { wrapper })
		const input = screen.getByPlaceholderText(/Search events, users/i)

		fireEvent.change(input, { target: { value: 'test' } })

		await waitFor(() => {
			expect(screen.getByLabelText('Clear search')).toBeInTheDocument()
		})

		const clearButton = screen.getByLabelText('Clear search')
		fireEvent.click(clearButton)

		expect(input).toHaveValue('')
		expect(input).toHaveFocus()
	})
})
