import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { SearchBar } from '../../components/SearchBar'
import { api } from '@/lib/api-client'

// Mock react-router-dom
const navigateMock = vi.fn()
vi.mock('react-router-dom', () => ({
	useNavigate: () => navigateMock,
}))

// Mock api-client
vi.mock('@/lib/api-client', () => ({
	api: {
		get: vi.fn(),
		post: vi.fn(),
	},
}))

// Mock useThemeColors
vi.mock('@/design-system', () => ({
	useThemeColors: () => ({
		info: { 500: '#3b82f6' },
	}),
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
    createLogger: () => ({
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    })
}))

describe('SearchBar', () => {
	beforeEach(() => {
		vi.clearAllMocks()
        vi.useFakeTimers()
	})

    afterEach(() => {
        vi.useRealTimers()
    })

	it('should render search input', () => {
		render(<SearchBar />)
		expect(screen.getByPlaceholderText(/Search events, users/i)).toBeInTheDocument()
	})

	it('should show clear button when text is entered and loading is finished', async () => {
		;(api.get as Mock).mockResolvedValue({
			users: [],
			events: [],
			remoteAccountSuggestion: null,
		})

		render(<SearchBar />)
		const input = screen.getByPlaceholderText(/Search events, users/i)

		fireEvent.change(input, { target: { value: 'test' } })

        // Initially loading
        expect(screen.queryByLabelText('Loading')).toBeInTheDocument()

        // Advance timers to trigger search and finish loading
        await act(async () => {
            vi.advanceTimersByTime(300)
        })

		const clearButton = screen.getByLabelText('Clear search')
		expect(clearButton).toBeInTheDocument()
	})

	it('should clear input and focus when clear button is clicked', async () => {
		;(api.get as Mock).mockResolvedValue({
			users: [],
			events: [],
			remoteAccountSuggestion: null,
		})

		render(<SearchBar />)
		const input = screen.getByPlaceholderText(/Search events, users/i)

		fireEvent.change(input, { target: { value: 'test' } })

        await act(async () => {
            vi.advanceTimersByTime(300)
        })

		const clearButton = screen.getByLabelText('Clear search')
		fireEvent.click(clearButton)

		expect(input).toHaveValue('')
		expect(input).toHaveFocus()
	})

	it('should not show clear button when loading', async () => {
		// Return a pending promise to simulate loading
		const pendingPromise = new Promise(() => {})
		;(api.get as Mock).mockReturnValue(pendingPromise)

		render(<SearchBar />)
		const input = screen.getByPlaceholderText(/Search events, users/i)

		fireEvent.change(input, { target: { value: 'test' } })

        // Fast forward debounce timer to trigger loading state
        await act(async () => {
            vi.advanceTimersByTime(300)
        })

		// Should show spinner (which has "Loading" label), not clear button
        expect(screen.getByLabelText('Loading')).toBeInTheDocument()
		expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument()
	})
})
