import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { SearchBar } from '../../components/SearchBar'
import { createTestWrapper } from '../testUtils'

// Mock the API client
vi.mock('@/lib/api-client', () => ({
	api: {
		get: vi.fn().mockResolvedValue({ users: [], events: [], remoteAccountSuggestion: null }),
		post: vi.fn(),
	},
}))

describe('SearchBar', () => {
	const { wrapper } = createTestWrapper()

	beforeEach(() => {
		vi.clearAllMocks()
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('should render search input', () => {
		render(<SearchBar />, { wrapper })
		const input = screen.getByPlaceholderText(/Search events, users/i)
		expect(input).toBeInTheDocument()
	})

	it('should show clear button when typing', async () => {
		render(<SearchBar />, { wrapper })
		const input = screen.getByPlaceholderText(/Search events, users/i)

		fireEvent.change(input, { target: { value: 'test' } })

		// Advance timers to trigger the api call and resolve loading state
		await act(async () => {
			vi.advanceTimersByTime(300)
		})

		// Clear button should appear
		const clearButton = screen.getByLabelText('Clear search')
		expect(clearButton).toBeInTheDocument()
	})

	it('should clear input when clear button is clicked', async () => {
		render(<SearchBar />, { wrapper })
		const input = screen.getByPlaceholderText(/Search events, users/i)

		fireEvent.change(input, { target: { value: 'test' } })

		// Advance timers to trigger the api call and resolve loading state
		await act(async () => {
			vi.advanceTimersByTime(300)
		})

		const clearButton = screen.getByLabelText('Clear search')
		fireEvent.click(clearButton)

		expect(input).toHaveValue('')
		expect(input).toHaveFocus()
	})

	it('should not show clear button when input is empty', () => {
		render(<SearchBar />, { wrapper })
		const clearButton = screen.queryByLabelText('Clear search')
		expect(clearButton).not.toBeInTheDocument()
	})
})
