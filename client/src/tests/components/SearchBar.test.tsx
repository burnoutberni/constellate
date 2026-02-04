import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchBar } from '../../components/SearchBar'
import { createTestWrapper, clearQueryClient } from '../testUtils'
import { api } from '@/lib/api-client'

// Mock api client
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
		useThemeColors: () => ({ info: { 500: '#3b82f6' } }),
	}
})

const { wrapper, queryClient } = createTestWrapper()

describe('SearchBar Component', () => {
	beforeEach(() => {
		clearQueryClient(queryClient)
		vi.clearAllMocks()
        vi.useRealTimers() // SearchBar uses debounce with setTimeout
	})

	it('should render search input with correct aria-label', () => {
		render(<SearchBar />, { wrapper })
		const input = screen.getByLabelText('Search')
		expect(input).toBeInTheDocument()
		expect(input).toHaveAttribute('placeholder', 'Search events, users, or @user@domain...')
	})

	it('should show clear button when text is entered', async () => {
        const user = userEvent.setup()
        vi.useRealTimers()

        // Mock api.get to resolve immediately so loading finishes
        vi.mocked(api.get).mockResolvedValue({ users: [], events: [], remoteAccountSuggestion: null })

		render(<SearchBar />, { wrapper })

		const input = screen.getByLabelText('Search')
		await user.type(input, 'test')

        // Wait for loading to finish (debounce 300ms + async)
        await waitFor(() => {
            expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument()
        }, { timeout: 2000 })

		const clearButton = screen.getByLabelText('Clear search')
		expect(clearButton).toBeInTheDocument()
	})

	it('should clear input when clear button is clicked', async () => {
        const user = userEvent.setup()
        vi.useRealTimers()

        vi.mocked(api.get).mockResolvedValue({ users: [], events: [], remoteAccountSuggestion: null })

		render(<SearchBar />, { wrapper })

		const input = screen.getByLabelText('Search')
		await user.type(input, 'test')

        // Wait for loading to finish
        await waitFor(() => {
            expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument()
        }, { timeout: 2000 })

		const clearButton = screen.getByLabelText('Clear search')
		await user.click(clearButton)

		expect(input).toHaveValue('')
		expect(input).toHaveFocus()
        expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument()
	})

    it('should show results when searching', async () => {
        const user = userEvent.setup()
        vi.useRealTimers()

        // Mock API response
        vi.mocked(api.get).mockResolvedValue({
            users: [
                { id: '1', username: 'testuser', name: 'Test User' }
            ],
            events: [],
            remoteAccountSuggestion: null
        })

        render(<SearchBar />, { wrapper })

        const input = screen.getByLabelText('Search')
        await user.type(input, 'test')

        await waitFor(() => {
            expect(api.get).toHaveBeenCalled()
        }, { timeout: 2000 })

        // Results should appear
        await waitFor(() => {
            expect(screen.getByText(/testuser/i)).toBeInTheDocument()
        })
    })
})
