import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { SearchBar } from '../../components/SearchBar'
import { api } from '@/lib/api-client'

// Mock API
vi.mock('@/lib/api-client', () => ({
	api: {
		get: vi.fn(),
		post: vi.fn(),
	},
}))

// Mock Theme Colors
vi.mock('@/design-system', () => ({
	useThemeColors: () => ({
		info: { 500: '#3b82f6' },
	}),
}))

describe('SearchBar', () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('should render search input', () => {
		render(
			<MemoryRouter>
				<SearchBar />
			</MemoryRouter>
		)
		expect(
			screen.getByPlaceholderText('Search events, users, or @user@domain...')
		).toBeInTheDocument()
	})

	it('should show clear button when typing', async () => {
		const mockGet = vi.mocked(api.get)
		mockGet.mockResolvedValue({ users: [], events: [], remoteAccountSuggestion: null })

		render(
			<MemoryRouter>
				<SearchBar />
			</MemoryRouter>
		)
		const input = screen.getByPlaceholderText('Search events, users, or @user@domain...')

		fireEvent.change(input, { target: { value: 'test' } })

		// Advance debounce timer and allow promise resolution
		await act(async () => {
			vi.advanceTimersByTime(300)
		})

		expect(mockGet).toHaveBeenCalled()

		// The clear button should be present now
		expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument()
	})

	it('should clear input and focus when clear button is clicked', async () => {
		const mockGet = vi.mocked(api.get)
		mockGet.mockResolvedValue({ users: [], events: [], remoteAccountSuggestion: null })

		render(
			<MemoryRouter>
				<SearchBar />
			</MemoryRouter>
		)
		const input = screen.getByPlaceholderText('Search events, users, or @user@domain...')

		fireEvent.change(input, { target: { value: 'test' } })

		// Advance debounce timer
		await act(async () => {
			vi.advanceTimersByTime(300)
		})

		const clearButton = screen.getByRole('button', { name: 'Clear search' })
		fireEvent.click(clearButton)

		expect(input).toHaveValue('')
		expect(input).toHaveFocus()
		expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument()
	})

	it('should show loading spinner when searching', async () => {
		const mockGet = vi.mocked(api.get)
		mockGet.mockReturnValue(new Promise(() => {})) // Never resolves

		render(
			<MemoryRouter>
				<SearchBar />
			</MemoryRouter>
		)
		const input = screen.getByPlaceholderText('Search events, users, or @user@domain...')

		fireEvent.change(input, { target: { value: 'test' } })

		// Advance timers to trigger effect
		await act(async () => {
			vi.advanceTimersByTime(300)
		})

		expect(mockGet).toHaveBeenCalled()

		// Spinner should be visible (Clear button hidden)
		expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument()
	})
})
