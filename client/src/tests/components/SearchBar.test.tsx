import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SearchBar } from '../../components/SearchBar'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '../../design-system'
import { api } from '../../lib/api-client'

// Mock the API
vi.mock('../../lib/api-client', () => ({
	api: {
		get: vi.fn(),
		post: vi.fn(),
	},
}))

// Mock matchMedia for ThemeProvider
Object.defineProperty(window, 'matchMedia', {
	writable: true,
	value: vi.fn().mockImplementation((query) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(), // deprecated
		removeListener: vi.fn(), // deprecated
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	})),
})

describe('SearchBar', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	const renderSearchBar = () => {
		return render(
			<ThemeProvider>
				<BrowserRouter>
					<SearchBar />
				</BrowserRouter>
			</ThemeProvider>
		)
	}

	it('should render input field', () => {
		renderSearchBar()
		const input = screen.getByPlaceholderText(/Search events/i)
		expect(input).toBeInTheDocument()
	})

	it('should show clear button after text is entered and search completes', async () => {
		// Mock API response
		(api.get as Mock).mockResolvedValue({
			users: [],
			events: [],
			remoteAccountSuggestion: null,
		})

		renderSearchBar()
		const input = screen.getByPlaceholderText(/Search events/i)

		fireEvent.change(input, { target: { value: 'test' } })

		// Wait for debounce (300ms) and API call to finish
		// isLoading should become false
		await waitFor(
			() => {
				const clearButton = screen.getByLabelText('Clear search')
				expect(clearButton).toBeInTheDocument()
			},
			{ timeout: 1000 }
		)
	})

	it('should clear text when clear button is clicked', async () => {
		(api.get as Mock).mockResolvedValue({
			users: [],
			events: [],
			remoteAccountSuggestion: null,
		})

		renderSearchBar()
		const input = screen.getByPlaceholderText(/Search events/i)

		fireEvent.change(input, { target: { value: 'test' } })

		// Wait for clear button
		const clearButton = await screen.findByLabelText('Clear search', {}, { timeout: 1000 })

		fireEvent.click(clearButton)

		expect(input).toHaveValue('')
		expect(input).toHaveFocus()
	})

	it('should not show clear button when input is empty', () => {
		renderSearchBar()
		const clearButton = screen.queryByLabelText('Clear search')
		expect(clearButton).not.toBeInTheDocument()
	})
})
