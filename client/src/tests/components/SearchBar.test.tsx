import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { SearchBar } from '../../components/SearchBar'
import { api } from '../../lib/api-client'
import { createTestWrapper, clearQueryClient } from '../testUtils'

// Mock dependencies
const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
	const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
	return {
		...actual,
		useNavigate: () => mockNavigate,
	}
})

vi.mock('../../lib/api-client', () => ({
	api: {
		get: vi.fn(),
		post: vi.fn(),
	},
}))

const { wrapper, queryClient } = createTestWrapper()

describe('SearchBar', () => {
	beforeEach(() => {
		clearQueryClient(queryClient)
		vi.clearAllMocks()
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	const mockSearchResults = {
		users: [{ id: '1', username: 'testuser', name: 'Test User' }],
		events: [{ id: '2', title: 'Test Event', startTime: new Date().toISOString(), user: { username: 'host' } }],
		remoteAccountSuggestion: null,
	};

	it('should render input element', () => {
		render(<SearchBar />, { wrapper })
		expect(screen.getByRole('textbox')).toBeInTheDocument()
	})

	it('should debounce search requests', async () => {
		render(<SearchBar />, { wrapper })
		const input = screen.getByRole('textbox')

		fireEvent.change(input, { target: { value: 'test' } })

		// Fast forward less than debounce time (300ms)
		act(() => {
			vi.advanceTimersByTime(200)
		})
		expect(api.get).not.toHaveBeenCalled()

		// Fast forward to complete debounce
		await act(async () => {
			vi.advanceTimersByTime(150)
		})

		expect(api.get).toHaveBeenCalledWith('/user-search', expect.objectContaining({ q: 'test' }))
	})

	it('should display search results', async () => {
		vi.mocked(api.get).mockResolvedValue(mockSearchResults)

		render(<SearchBar />, { wrapper })
		const input = screen.getByRole('textbox')

		fireEvent.change(input, { target: { value: 'test' } })

		await act(async () => {
			vi.advanceTimersByTime(400)
		})

		expect(screen.getByText(/testuser/)).toBeInTheDocument()
		expect(screen.getByText(/Test Event/)).toBeInTheDocument()
	})

	it('should show clear button and clear search', async () => {
		// Mock empty results to avoid rendering dropdown
		vi.mocked(api.get).mockResolvedValue({ users: [], events: [], remoteAccountSuggestion: null })

		render(<SearchBar />, { wrapper })
		const input = screen.getByRole('textbox')

		fireEvent.change(input, { target: { value: 'test' } })

		// Wait for loading to finish
		await act(async () => {
			vi.advanceTimersByTime(400)
		})

		const clearButton = screen.getByRole('button', { name: /clear search/i })
		expect(clearButton).toBeInTheDocument()

		fireEvent.click(clearButton)

		expect(input).toHaveValue('')
		expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument()
		expect(input).toHaveFocus()
	})

	it('should handle keyboard navigation', async () => {
		vi.mocked(api.get).mockResolvedValue(mockSearchResults)

		render(<SearchBar />, { wrapper })
		const input = screen.getByRole('textbox')

		fireEvent.change(input, { target: { value: 'test' } })

		await act(async () => {
			vi.advanceTimersByTime(400)
		})

		expect(screen.getByText(/testuser/)).toBeInTheDocument()

		// ArrowDown to select first item (user)
		fireEvent.keyDown(input, { key: 'ArrowDown' })

		// ArrowDown to select second item (event)
		fireEvent.keyDown(input, { key: 'ArrowDown' })

		// Enter to navigate
		fireEvent.keyDown(input, { key: 'Enter' })

		expect(mockNavigate).toHaveBeenCalledWith('/@host/2')
	})

	it('should navigate to user profile on click', async () => {
		vi.mocked(api.get).mockResolvedValue(mockSearchResults)

		render(<SearchBar />, { wrapper })
		const input = screen.getByRole('textbox')

		fireEvent.change(input, { target: { value: 'test' } })

		await act(async () => {
			vi.advanceTimersByTime(400)
		})

		expect(screen.getByText(/testuser/)).toBeInTheDocument()

		const userItem = screen.getByText(/testuser/)
		fireEvent.click(userItem)

		expect(mockNavigate).toHaveBeenCalledWith('/@testuser')
	})

	it('should handle remote account resolution', async () => {
		const remoteResults = {
			users: [],
			events: [],
			remoteAccountSuggestion: {
				handle: '@remote@instance.com',
				username: 'remote',
				domain: 'instance.com',
			},
		}

		const resolvedUser = { user: { id: 'remote1', username: 'remote_resolved' } }

		vi.mocked(api.get).mockResolvedValue(remoteResults)
		vi.mocked(api.post).mockResolvedValue(resolvedUser)

		render(<SearchBar />, { wrapper })
		const input = screen.getByRole('textbox')

		fireEvent.change(input, { target: { value: '@remote@instance.com' } })

		await act(async () => {
			vi.advanceTimersByTime(400)
		})

		expect(screen.getByText('@remote@instance.com')).toBeInTheDocument()

		const remoteItem = screen.getByText('Lookup remote account')
		fireEvent.click(remoteItem)

		expect(api.post).toHaveBeenCalledWith('/user-search/resolve', { handle: '@remote@instance.com' }, undefined, 'Failed to resolve account')

		// Wait for async resolution
		await act(async () => {
			await Promise.resolve()
            await Promise.resolve()
		})

		expect(mockNavigate).toHaveBeenCalledWith('/@remote_resolved')
	})

	it('should close on Escape', async () => {
		vi.mocked(api.get).mockResolvedValue(mockSearchResults)

		render(<SearchBar />, { wrapper })
		const input = screen.getByRole('textbox')

		fireEvent.change(input, { target: { value: 'test' } })

		await act(async () => {
			vi.advanceTimersByTime(400)
		})

		expect(screen.getByText(/testuser/)).toBeInTheDocument()

		fireEvent.keyDown(input, { key: 'Escape' })

		expect(screen.queryByText(/testuser/)).not.toBeInTheDocument()
	})
})
