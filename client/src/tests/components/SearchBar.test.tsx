import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { SearchBar } from '../../components/SearchBar'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '@/design-system'

// Mock the API client
const mockGet = vi.fn().mockResolvedValue({ users: [], events: [], remoteAccountSuggestion: null })
vi.mock('@/lib/api-client', () => ({
	api: {
		get: (...args) => mockGet(...args),
		post: vi.fn(),
	},
}))

// Wrapper for router and theme context
const renderWithProviders = (component: React.ReactNode) => {
	return render(
		<ThemeProvider>
			<BrowserRouter>{component}</BrowserRouter>
		</ThemeProvider>
	)
}

describe('SearchBar Component', () => {
	it('should show clear button when text is entered and search completes', async () => {
		vi.useFakeTimers()
		renderWithProviders(<SearchBar />)

		const input = screen.getByPlaceholderText(/Search events/i)
		fireEvent.change(input, { target: { value: 'test' } })

		// Should show loading initially
		expect(screen.getByLabelText('Loading')).toBeInTheDocument()

		// Advance timer to trigger API call
		await act(async () => {
			vi.advanceTimersByTime(300)
		})

        // Allow promises to resolve
        await act(async () => {
            vi.useRealTimers() // Switch back to allow promise resolution if needed, or just wait
        })

		// Wait for clear button to appear
		const clearButton = await screen.findByLabelText('Clear search')
		expect(clearButton).toBeInTheDocument()
	})

	it('should clear text when clear button is clicked', async () => {
        // Setup initial state with results
        vi.useFakeTimers()
		renderWithProviders(<SearchBar />)

		const input = screen.getByPlaceholderText(/Search events/i)
		fireEvent.change(input, { target: { value: 'test' } })

		await act(async () => {
			vi.advanceTimersByTime(300)
		})

        vi.useRealTimers()

		const clearButton = await screen.findByLabelText('Clear search')
		fireEvent.click(clearButton)

		expect(input).toHaveValue('')
        expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument()
	})

	it('should hide clear button when input is empty', () => {
		renderWithProviders(<SearchBar />)

		const input = screen.getByPlaceholderText(/Search events/i)
		fireEvent.change(input, { target: { value: '' } })

		const clearButton = screen.queryByLabelText('Clear search')
		expect(clearButton).not.toBeInTheDocument()
	})
})
