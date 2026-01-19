import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SearchBar } from '../../components/SearchBar'
import { ThemeProvider } from '../../design-system'
import { BrowserRouter } from 'react-router-dom'

// Mock api client
vi.mock('@/lib/api-client', () => ({
	api: {
		get: vi.fn(),
		post: vi.fn(),
	},
}))

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
		expect(screen.getByPlaceholderText(/search events, users/i)).toBeInTheDocument()
	})

	it('should show clear button when text is entered', () => {
		renderSearchBar()
		const input = screen.getByPlaceholderText(/search events, users/i)

		fireEvent.change(input, { target: { value: 'test' } })

		const clearButton = screen.getByLabelText('Clear search')
		expect(clearButton).toBeInTheDocument()
	})

	it('should clear input when clear button is clicked', () => {
		renderSearchBar()
		const input = screen.getByPlaceholderText(/search events, users/i)

		fireEvent.change(input, { target: { value: 'test' } })
		const clearButton = screen.getByLabelText('Clear search')

		fireEvent.click(clearButton)

		expect(input).toHaveValue('')
		expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument()
	})
})
