import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchBar } from '../../components/SearchBar'
import { createTestWrapper, clearQueryClient } from '../testUtils'
import { api } from '../../lib/api-client'

// Mock dependencies
vi.mock('../../lib/api-client', () => ({
	api: {
		get: vi.fn(),
		post: vi.fn(),
	},
}))

// Mock useThemeColors
vi.mock('../../design-system', () => ({
	useThemeColors: () => ({
		info: { 500: '#3b82f6' },
	}),
	tokens: {
		spacing: { 5: '1.25rem' },
	},
	ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))

const { wrapper, queryClient } = createTestWrapper()

describe('SearchBar', () => {
	beforeEach(() => {
		clearQueryClient(queryClient)
		vi.clearAllMocks()
	})

	afterEach(() => {
		clearQueryClient(queryClient)
	})

	it('should render search input', () => {
		render(<SearchBar />, { wrapper })
		expect(
			screen.getByPlaceholderText(/Search events, users, or @user@domain.../i)
		).toBeInTheDocument()
	})

	it('should show clear button when query is entered', async () => {
		const user = userEvent.setup()
		render(<SearchBar />, { wrapper })

		const input = screen.getByPlaceholderText(/Search events, users, or @user@domain.../i)
		await user.type(input, 'test')

		expect(screen.getByLabelText('Clear search')).toBeInTheDocument()
	})

	it('should hide clear button when query is empty', async () => {
		render(<SearchBar />, { wrapper })
		expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument()
	})

	it('should clear query and focus input when clear button is clicked', async () => {
		const user = userEvent.setup()
		render(<SearchBar />, { wrapper })

		const input = screen.getByPlaceholderText(/Search events, users, or @user@domain.../i)
		await user.type(input, 'test')

		const clearButton = screen.getByLabelText('Clear search')
		await user.click(clearButton)

		expect(input).toHaveValue('')
		expect(input).toHaveFocus()
		expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument()
	})

    it('should show spinner when loading and hide clear button', async () => {
        const user = userEvent.setup()

        // Mock a pending promise to simulate loading
        const pendingPromise = new Promise(() => {})
        ;(api.get as ReturnType<typeof vi.fn>).mockReturnValue(pendingPromise)

        render(<SearchBar />, { wrapper })

        const input = screen.getByPlaceholderText(/Search events, users, or @user@domain.../i)
        await user.type(input, 'test')

        // Wait for debounce (300ms) plus a bit more
        await waitFor(() => {
             expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument()
             expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument()
        }, { timeout: 1000 })
    })
})
