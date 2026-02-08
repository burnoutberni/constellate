import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SearchBar } from '../../components/SearchBar'
import { createTestWrapper } from '../testUtils'

// Mock the API client
vi.mock('../../lib/api-client', () => ({
	api: {
		get: vi.fn(),
		post: vi.fn(),
	},
}))

describe('SearchBar', () => {
	it('should render input element', () => {
		const { wrapper } = createTestWrapper()
		render(<SearchBar />, { wrapper })
		const input = screen.getByRole('textbox')
		expect(input).toBeInTheDocument()
	})

	it('should show clear button when text is entered', async () => {
		const { wrapper } = createTestWrapper()
		render(<SearchBar />, { wrapper })

		const input = screen.getByRole('textbox')
		fireEvent.change(input, { target: { value: 'test' } })

		// The clear button should appear
		// This test expects the "Clear search" button which doesn't exist yet
		const clearButton = await screen.findByRole('button', { name: /clear search/i })
		expect(clearButton).toBeInTheDocument()

		// Click clear button
		fireEvent.click(clearButton)

		// Input should be cleared
		expect(input).toHaveValue('')
	})
})
