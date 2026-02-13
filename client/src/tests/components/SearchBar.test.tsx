import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { SearchBar } from '../../components/SearchBar'
import { ThemeProvider } from '../../design-system/ThemeContext'

// Mock dependencies
vi.mock('../../lib/api-client', () => ({
	api: {
		get: vi.fn(),
		post: vi.fn(),
	},
}))

vi.mock('../../lib/logger', () => ({
	createLogger: () => ({
		error: vi.fn(),
	}),
}))

// Mock window.matchMedia
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

	it('should render search input', () => {
		renderSearchBar()
		expect(screen.getByPlaceholderText(/Search events, users/i)).toBeInTheDocument()
	})

	it('should update query when typing', () => {
		renderSearchBar()
		const input = screen.getByPlaceholderText(/Search events, users/i)
		fireEvent.change(input, { target: { value: 'test query' } })
		expect(input).toHaveValue('test query')
	})

	it('should show clear button when query is present', () => {
		renderSearchBar()
		const input = screen.getByPlaceholderText(/Search events, users/i)

		// Initially no clear button
		expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument()

		// Type something
		fireEvent.change(input, { target: { value: 'test' } })

		// Clear button should appear
		expect(screen.getByLabelText('Clear search')).toBeInTheDocument()
	})

	it('should clear query when clear button is clicked', () => {
		renderSearchBar()
		const input = screen.getByPlaceholderText(/Search events, users/i)

		// Type something
		fireEvent.change(input, { target: { value: 'test' } })

		// Click clear
		const clearButton = screen.getByLabelText('Clear search')
		fireEvent.click(clearButton)

		// Input should be empty
		expect(input).toHaveValue('')
	})

	it('should focus input after clearing', () => {
		renderSearchBar()
		const input = screen.getByPlaceholderText(/Search events, users/i)

		fireEvent.change(input, { target: { value: 'test' } })
		const clearButton = screen.getByLabelText('Clear search')
		fireEvent.click(clearButton)

		expect(input).toHaveFocus()
	})
})
