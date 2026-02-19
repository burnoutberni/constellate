import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SearchBar } from '../../components/SearchBar'
import { createTestWrapper } from '../testUtils'

// Mock api
vi.mock('@/lib/api-client', () => ({
	api: {
		get: vi.fn(),
		post: vi.fn(),
	},
}))

// Mock theme colors
vi.mock('@/design-system', async () => {
    const actual = await vi.importActual('@/design-system')
    return {
        ...actual,
        useThemeColors: vi.fn(() => ({ info: { 500: '#3b82f6' } })),
    }
})

describe('SearchBar', () => {
	const { wrapper } = createTestWrapper()

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('should render search input', () => {
		render(<SearchBar />, { wrapper })
		expect(screen.getByPlaceholderText(/search events, users/i)).toBeInTheDocument()
	})

	it('should update query and show clear button', () => {
		render(<SearchBar />, { wrapper })
		const input = screen.getByPlaceholderText(/search events, users/i)

		fireEvent.change(input, { target: { value: 'test' } })
		expect(input).toHaveValue('test')

		const clearButton = screen.getByLabelText('Clear search')
		expect(clearButton).toBeInTheDocument()
	})

	it('should clear query and focus input when clear button is clicked', () => {
		render(<SearchBar />, { wrapper })
		const input = screen.getByPlaceholderText(/search events, users/i)

		fireEvent.change(input, { target: { value: 'test' } })
		const clearButton = screen.getByLabelText('Clear search')

		fireEvent.click(clearButton)
		expect(input).toHaveValue('')
		expect(input).toHaveFocus()
	})

    it('should show loading spinner on the left immediately upon typing', () => {
        render(<SearchBar />, { wrapper })
        const input = screen.getByPlaceholderText(/search events, users/i)

        fireEvent.change(input, { target: { value: 'test' } })

        // Spinner should appear immediately due to useEffect setting isLoading(true)
        // Note: Spinner has aria-hidden="true" so we need hidden: true option
        expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument()
        // Clear button should also be present
        expect(screen.getByLabelText('Clear search')).toBeInTheDocument()
    })
})
