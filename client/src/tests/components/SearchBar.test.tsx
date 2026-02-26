import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SearchBar } from '../../components/SearchBar'
import { createTestWrapper } from '../testUtils'
import { api } from '@/lib/api-client'

// Mock the API client
vi.mock('@/lib/api-client', () => ({
	api: {
		get: vi.fn(),
		post: vi.fn(),
	},
}))

describe('SearchBar', () => {
	const { wrapper } = createTestWrapper()

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('renders the search input', () => {
		render(<SearchBar />, { wrapper })
		const input = screen.getByPlaceholderText(/Search events, users, or @user@domain.../i)
		expect(input).toBeInTheDocument()
	})

	it('updates query state on input change', () => {
		render(<SearchBar />, { wrapper })
		const input = screen.getByPlaceholderText(/Search events, users, or @user@domain.../i) as HTMLInputElement
		fireEvent.change(input, { target: { value: 'test' } })
		expect(input.value).toBe('test')
	})

	it('shows loading spinner when searching', async () => {
		// Mock API to delay response
		// @ts-ignore
		api.get.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ users: [], events: [], remoteAccountSuggestion: null }), 500)))

		render(<SearchBar />, { wrapper })
		const input = screen.getByPlaceholderText(/Search events, users, or @user@domain.../i)

		fireEvent.change(input, { target: { value: 'test' } })

		// Wait for debounce (300ms) to trigger loading
		await waitFor(() => {
			const spinner = screen.getByRole('status', { hidden: true })
			expect(spinner).toBeInTheDocument()
		}, { timeout: 1000 })
	})

	it('shows clear button when there is text and not loading', async () => {
		// Mock API to return immediately
		// @ts-ignore
		api.get.mockResolvedValue({ users: [], events: [], remoteAccountSuggestion: null })

		render(<SearchBar />, { wrapper })
		const input = screen.getByPlaceholderText(/Search events, users, or @user@domain.../i)

		fireEvent.change(input, { target: { value: 'test' } })

		// Wait for search to complete (loading to be false)
		await waitFor(() => {
			// Initially, with no clear button implemented, the spinner might just disappear
			// Once implemented, the clear button should appear
			// For now, let's just assert that we can't find the clear button yet (as it's not implemented)
			// But the test is designed to verify the new feature, so I expect it to fail if I run it now.
			// I will write the assertion expecting it to be there, knowing it will fail,
			// confirming TDD workflow.
			const clearButton = screen.getByLabelText('Clear search')
			expect(clearButton).toBeInTheDocument()
		})
	})

	it('clears input when clear button is clicked', async () => {
		// @ts-ignore
		api.get.mockResolvedValue({ users: [], events: [], remoteAccountSuggestion: null })

		render(<SearchBar />, { wrapper })
		const input = screen.getByPlaceholderText(/Search events, users, or @user@domain.../i) as HTMLInputElement

		fireEvent.change(input, { target: { value: 'test' } })

		await waitFor(() => {
			expect(screen.getByLabelText('Clear search')).toBeInTheDocument()
		})

		const clearButton = screen.getByLabelText('Clear search')
		fireEvent.click(clearButton)

		expect(input.value).toBe('')
		expect(input).toHaveFocus()
	})
})
