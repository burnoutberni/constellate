import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'

import { SearchBar } from '../../components/SearchBar'
import { ThemeProvider } from '@/design-system'

// Mock API client
vi.mock('@/lib/api-client', () => ({
	api: {
		get: vi.fn(),
		post: vi.fn(),
	},
}))

const createWrapper = () => {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
		},
	})

	return ({ children }: { children: React.ReactNode }) => (
		<ThemeProvider>
			<QueryClientProvider client={queryClient}>
				<MemoryRouter>{children}</MemoryRouter>
			</QueryClientProvider>
		</ThemeProvider>
	)
}

describe('SearchBar Component', () => {
	it('should render search input', () => {
		render(<SearchBar />, { wrapper: createWrapper() })
		expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
	})

	it('should show clear button when typing', async () => {
		render(<SearchBar />, { wrapper: createWrapper() })

		const input = screen.getByPlaceholderText(/search/i)
		fireEvent.change(input, { target: { value: 'test query' } })

		// Clear button should appear
		const clearButton = await screen.findByLabelText('Clear search')
		expect(clearButton).toBeInTheDocument()
	})

	it('should clear input when clear button is clicked', async () => {
		render(<SearchBar />, { wrapper: createWrapper() })

		const input = screen.getByPlaceholderText(/search/i) as HTMLInputElement
		fireEvent.change(input, { target: { value: 'test query' } })

		const clearButton = await screen.findByLabelText('Clear search')
		fireEvent.click(clearButton)

		expect(input.value).toBe('')
		expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument()
	})

	it('should focus input after clearing', async () => {
		render(<SearchBar />, { wrapper: createWrapper() })

		const input = screen.getByPlaceholderText(/search/i)
		fireEvent.change(input, { target: { value: 'test query' } })

		const clearButton = await screen.findByLabelText('Clear search')
		fireEvent.click(clearButton)

		expect(input).toHaveFocus()
	})
})
