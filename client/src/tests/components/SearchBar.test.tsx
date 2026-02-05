import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchBar } from '../../components/SearchBar'
import { createTestWrapper, clearQueryClient } from '../testUtils'

// Mock dependencies
vi.mock('../../lib/api-client', () => ({
	api: {
		get: vi.fn().mockResolvedValue({ users: [], events: [], remoteAccountSuggestion: null }),
		post: vi.fn(),
	},
}))

vi.mock('../../lib/logger', () => ({
    createLogger: () => ({
        error: vi.fn(),
        info: vi.fn(),
    })
}))

const { wrapper, queryClient } = createTestWrapper()

describe('SearchBar Component', () => {
	beforeEach(() => {
		clearQueryClient(queryClient)
		vi.clearAllMocks()
	})

	it('should render search input', () => {
		render(<SearchBar />, { wrapper })
		expect(screen.getByPlaceholderText(/Search events, users/i)).toBeInTheDocument()
	})

	it('should update query on type', async () => {
        const user = userEvent.setup()
		render(<SearchBar />, { wrapper })
		const input = screen.getByPlaceholderText(/Search events, users/i)

        await user.type(input, 'test')
        expect(input).toHaveValue('test')
	})

    it('should show clear button when text is entered', async () => {
        const user = userEvent.setup()
        render(<SearchBar />, { wrapper })
        const input = screen.getByPlaceholderText(/Search events, users/i)

        await user.type(input, 'test')

        // This is expected to fail until implementation
        await waitFor(() => {
            const clearButton = screen.getByRole('button', { name: /clear search/i })
            expect(clearButton).toBeInTheDocument()
        })
    })

    it('should clear text when clear button is clicked', async () => {
        const user = userEvent.setup()
        render(<SearchBar />, { wrapper })
        const input = screen.getByPlaceholderText(/Search events, users/i)

        await user.type(input, 'test')

        // This is expected to fail until implementation
        const clearButton = await screen.findByRole('button', { name: /clear search/i })
        await user.click(clearButton)

        expect(input).toHaveValue('')
        expect(input).toHaveFocus()
    })
})
