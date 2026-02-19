import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SearchBar } from '../../components/SearchBar'
import { createTestWrapper } from '../testUtils'
import { api } from '@/lib/api-client'
import type { Mock } from 'vitest'

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

// Mock navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom')
    return {
        ...actual,
        useNavigate: () => mockNavigate,
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

    it('should show loading spinner on the left immediately upon typing', async () => {
        render(<SearchBar />, { wrapper })
        const input = screen.getByPlaceholderText(/search events, users/i)

        fireEvent.change(input, { target: { value: 'test' } })

        // Spinner should appear immediately due to useEffect setting isLoading(true)
        await waitFor(() => {
            expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument()
        })
        expect(screen.getByLabelText('Clear search')).toBeInTheDocument()
    })

    it('should fetch and display search results including remote user', async () => {
        const mockResults = {
            users: [
                { id: '1', username: 'testuser', name: 'Test User', profileImage: 'http://img.com/1.jpg' },
                { id: '2', username: 'remoteuser', isRemote: true }
            ],
            events: [
                { id: '1', title: 'Test Event', startTime: new Date().toISOString(), location: 'Test Loc', user: { username: 'host' } }
            ],
            remoteAccountSuggestion: null
        }

        ;(api.get as Mock).mockResolvedValue(mockResults)

        render(<SearchBar />, { wrapper })
        const input = screen.getByPlaceholderText(/search events, users/i)

        fireEvent.change(input, { target: { value: 'test' } })
        fireEvent.focus(input)

        await waitFor(() => {
            expect(api.get).toHaveBeenCalledWith('/user-search', { q: 'test', limit: 5 })
        })

        await waitFor(() => {
             expect(screen.getByText('Test User')).toBeInTheDocument()
             expect(screen.getByAltText('Test User')).toHaveAttribute('src', 'http://img.com/1.jpg')

             // Check remote user
             expect(screen.getByText('remoteuser')).toBeInTheDocument()
             expect(screen.getByText('Remote')).toBeInTheDocument()
        })
    })

    it('should handle search error gracefully', async () => {
        ;(api.get as Mock).mockRejectedValue(new Error('Search failed'))
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        render(<SearchBar />, { wrapper })
        const input = screen.getByPlaceholderText(/search events, users/i)

        fireEvent.change(input, { target: { value: 'error' } })

        await waitFor(() => {
            expect(api.get).toHaveBeenCalled()
        })

        expect(screen.queryByRole('status', { hidden: true })).not.toBeInTheDocument()

        consoleSpy.mockRestore()
    })

    it('should close dropdown when clicking outside', async () => {
         const mockResults = { users: [], events: [], remoteAccountSuggestion: null }
        ;(api.get as Mock).mockResolvedValue(mockResults)

        render(<SearchBar />, { wrapper })
        const input = screen.getByPlaceholderText(/search events, users/i)

        fireEvent.change(input, { target: { value: 'test' } })
        fireEvent.focus(input)

        await waitFor(() => {
             expect(api.get).toHaveBeenCalled()
        })

        fireEvent.mouseDown(document.body)

        await waitFor(() => {
             expect(screen.queryByText('No results found')).not.toBeInTheDocument()
        })
    })

    it('should resolve remote account successfully', async () => {
         const mockResults = {
            users: [],
            events: [],
            remoteAccountSuggestion: { handle: 'user@remote.com', username: 'user', domain: 'remote.com' }
        }
        ;(api.get as Mock).mockResolvedValue(mockResults)
        ;(api.post as Mock).mockResolvedValue({ user: { id: '2', username: 'user', isRemote: true } })

        render(<SearchBar />, { wrapper })
        const input = screen.getByPlaceholderText(/search events, users/i)

        fireEvent.change(input, { target: { value: '@user@remote.com' } })
        fireEvent.focus(input)

        await waitFor(() => {
            expect(screen.getByText('Lookup remote account')).toBeInTheDocument()
        })

        const resolveButton = screen.getByText('Lookup remote account').closest('button')
        if (resolveButton) {
            fireEvent.click(resolveButton)
        }

        // Check for loading state text
        await waitFor(() => {
            expect(screen.getByText('Resolving...')).toBeInTheDocument()
        })

        await waitFor(() => {
             expect(api.post).toHaveBeenCalledWith(
                 '/user-search/resolve',
                 { handle: 'user@remote.com' },
                 undefined,
                 'Failed to resolve account'
             )
        })

        expect(mockNavigate).toHaveBeenCalledWith('/@user')
    })

    it('should handle remote account resolution error', async () => {
         const mockResults = {
            users: [],
            events: [],
            remoteAccountSuggestion: { handle: 'user@remote.com', username: 'user', domain: 'remote.com' }
        }
        ;(api.get as Mock).mockResolvedValue(mockResults)
        ;(api.post as Mock).mockRejectedValue(new Error('Failed'))
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        render(<SearchBar />, { wrapper })
        const input = screen.getByPlaceholderText(/search events, users/i)

        fireEvent.change(input, { target: { value: '@user@remote.com' } })
        fireEvent.focus(input)

        await waitFor(() => {
            expect(screen.getByText('Lookup remote account')).toBeInTheDocument()
        })

        const resolveButton = screen.getByText('Lookup remote account').closest('button')
        if (resolveButton) {
            fireEvent.click(resolveButton)
        }

        await waitFor(() => {
             expect(api.post).toHaveBeenCalled()
        })

        // Should revert to normal state after error (finally block sets resolving to false)
        await waitFor(() => {
            expect(screen.getByText('Lookup remote account')).toBeInTheDocument()
        })

        consoleSpy.mockRestore()
    })

    it('should navigate to user profile on click', async () => {
         const mockResults = {
            users: [{ id: '1', username: 'testuser' }],
            events: [],
            remoteAccountSuggestion: null
        }
        ;(api.get as Mock).mockResolvedValue(mockResults)

        render(<SearchBar />, { wrapper })
        const input = screen.getByPlaceholderText(/search events, users/i)

        fireEvent.change(input, { target: { value: 'test' } })
        fireEvent.focus(input)

        await waitFor(() => {
            expect(screen.getByText('testuser')).toBeInTheDocument()
        })

        fireEvent.click(screen.getByText('testuser'))

        expect(mockNavigate).toHaveBeenCalledWith('/@testuser')
    })

    it('should navigate to event page on click', async () => {
         const mockResults = {
            users: [],
            events: [{ id: '100', title: 'Event A', startTime: new Date().toISOString(), user: { username: 'host' } }],
            remoteAccountSuggestion: null
        }
        ;(api.get as Mock).mockResolvedValue(mockResults)

        render(<SearchBar />, { wrapper })
        const input = screen.getByPlaceholderText(/search events, users/i)

        fireEvent.change(input, { target: { value: 'Event' } })
        fireEvent.focus(input)

        await waitFor(() => {
            expect(screen.getByText('Event A')).toBeInTheDocument()
        })

        fireEvent.click(screen.getByText('Event A'))
        expect(mockNavigate).toHaveBeenCalledWith('/@host/100')
    })

    it('should handle keyboard navigation limits and multi-item navigation', async () => {
        const mockResults = {
            users: [{ id: '1', username: 'user1' }, { id: '2', username: 'user2' }],
            events: [],
            remoteAccountSuggestion: null
        }
        ;(api.get as Mock).mockResolvedValue(mockResults)

        render(<SearchBar />, { wrapper })
        const input = screen.getByPlaceholderText(/search events, users/i)

        fireEvent.change(input, { target: { value: 'test' } })
        fireEvent.focus(input)

        await waitFor(() => {
             expect(screen.getByText('user1')).toBeInTheDocument()
             expect(screen.getByText('user2')).toBeInTheDocument()
        })

        // Arrow Up from start (should stay at -1)
        fireEvent.keyDown(input, { key: 'ArrowUp' })

        // Arrow Down -> Select first item (0)
        fireEvent.keyDown(input, { key: 'ArrowDown' })

        // Arrow Down -> Select second item (1)
        fireEvent.keyDown(input, { key: 'ArrowDown' })

        // Arrow Up -> Back to first item (0)
        fireEvent.keyDown(input, { key: 'ArrowUp' })

        // Arrow Up -> Back to -1
        fireEvent.keyDown(input, { key: 'ArrowUp' })

        // Enter (at -1) -> Nothing happens
        fireEvent.keyDown(input, { key: 'Enter' })
        expect(mockNavigate).not.toHaveBeenCalled()

        // Arrow Down -> Select first item (0)
        fireEvent.keyDown(input, { key: 'ArrowDown' })

        // Enter -> Click item (user1)
        fireEvent.keyDown(input, { key: 'Enter' })

        expect(mockNavigate).toHaveBeenCalledWith('/@user1')
    })

    it('should close on Escape key', async () => {
        const mockResults = { users: [], events: [], remoteAccountSuggestion: null }
        ;(api.get as Mock).mockResolvedValue(mockResults)

        render(<SearchBar />, { wrapper })
        const input = screen.getByPlaceholderText(/search events, users/i)

        fireEvent.change(input, { target: { value: 'test' } })
        fireEvent.focus(input)

        await waitFor(() => {
             expect(screen.queryByText('No results found')).toBeInTheDocument()
        })

        fireEvent.keyDown(input, { key: 'Escape' })

        expect(screen.queryByText('No results found')).not.toBeInTheDocument()
        expect(input).not.toHaveFocus()
    })

    it('should ignore non-navigation keys', async () => {
        const mockResults = { users: [], events: [], remoteAccountSuggestion: null }
        ;(api.get as Mock).mockResolvedValue(mockResults)

        render(<SearchBar />, { wrapper })
        const input = screen.getByPlaceholderText(/search events, users/i)
        fireEvent.change(input, { target: { value: 'test' } })
        fireEvent.focus(input)

        await waitFor(() => {
             expect(screen.queryByText('No results found')).toBeInTheDocument()
        })

        fireEvent.keyDown(input, { key: 'a' })

        expect(screen.queryByText('No results found')).toBeInTheDocument()
    })

    it('should return early on keydown if closed', () => {
        render(<SearchBar />, { wrapper })
        const input = screen.getByPlaceholderText(/search events, users/i)

        // Is open is false by default
        fireEvent.keyDown(input, { key: 'ArrowDown' })

        // No error, nothing happens
    })
})
