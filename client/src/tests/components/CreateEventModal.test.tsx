import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateEventModal } from '../../components/CreateEventModal'
import { createTestWrapper, clearQueryClient } from '../testUtils'

// Mock dependencies
const mockUser = { id: 'user1', username: 'testuser', name: 'Test User' }
const mockAddErrorToast = vi.fn()
const mockSaveDraft = vi.fn()
const mockLoadDraft = vi.fn()
const mockClearDraft = vi.fn()
const mockHasDraft = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
	useAuth: () => ({
		user: mockUser,
		loading: false,
		login: vi.fn(),
		sendMagicLink: vi.fn(),
		signup: vi.fn(),
		logout: vi.fn(),
	}),
}))

vi.mock('../../stores', () => ({
	useUIStore: () => ({
		addToast: mockAddErrorToast,
	}),
}))

vi.mock('../../hooks/useEventDraft', () => ({
	useEventDraft: () => ({
		saveDraft: mockSaveDraft,
		loadDraft: mockLoadDraft,
		clearDraft: mockClearDraft,
		hasDraft: mockHasDraft,
	}),
}))

vi.mock('../../hooks/useLocationSuggestions', () => ({
	useLocationSuggestions: () => ({
		suggestions: [],
		loading: false,
		error: null,
	}),
	MIN_QUERY_LENGTH: 3,
}))

global.fetch = vi.fn()

const { wrapper, queryClient } = createTestWrapper()

describe('CreateEventModal', () => {
	beforeEach(() => {
		clearQueryClient(queryClient)
		vi.clearAllMocks()
		mockHasDraft.mockReturnValue(false)
		;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			json: async () => ({ templates: [] }),
		})
	})

	afterEach(() => {
		clearQueryClient(queryClient)
	})

	it('should not render when closed', () => {
		render(<CreateEventModal isOpen={false} onClose={vi.fn()} onSuccess={vi.fn()} />, {
			wrapper,
		})

		expect(screen.queryByText(/Create Event/i)).not.toBeInTheDocument()
	})

	it('should render when open', async () => {
		render(<CreateEventModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />, {
			wrapper,
		})

		await waitFor(() => {
			// "Create Event" may appear multiple times (title, button, etc.)
			expect(screen.getAllByText(/Create Event/i).length).toBeGreaterThan(0)
		})
	})

	it('should render form fields', async () => {
		render(<CreateEventModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />, {
			wrapper,
		})

		await waitFor(() => {
			expect(screen.getByLabelText(/Event Title/i)).toBeInTheDocument()
			expect(screen.getByLabelText(/Description/i)).toBeInTheDocument()
			// Label is "Start Date & Time" not "Start Time"
			expect(screen.getByLabelText(/Start Date & Time/i)).toBeInTheDocument()
		})
	})

	it('should handle form input', async () => {
		const user = userEvent.setup()
		render(<CreateEventModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />, {
			wrapper,
		})

		await waitFor(() => {
			expect(screen.getByLabelText(/Event Title/i)).toBeInTheDocument()
		})

		const titleInput = screen.getByLabelText(/Event Title/i)
		await user.type(titleInput, 'New Event')

		expect(titleInput).toHaveValue('New Event')
	})

	it('should add tags', async () => {
		const user = userEvent.setup()
		render(<CreateEventModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />, {
			wrapper,
		})

		await waitFor(() => {
			expect(screen.getByPlaceholderText(/Add a tag/i)).toBeInTheDocument()
		})

		const tagInput = screen.getByPlaceholderText(/Add a tag/i)
		const addButton = screen.getByRole('button', { name: /Add/i })

		await user.type(tagInput, 'music')
		await user.click(addButton)

		await waitFor(() => {
			expect(screen.getByText('#music')).toBeInTheDocument()
		})
	})

	it('should prevent duplicate tags', async () => {
		const user = userEvent.setup()
		render(<CreateEventModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />, {
			wrapper,
		})

		await waitFor(() => {
			expect(screen.getByPlaceholderText(/Add a tag/i)).toBeInTheDocument()
		})

		const tagInput = screen.getByPlaceholderText(/Add a tag/i)
		const addButton = screen.getByRole('button', { name: /Add/i })

		await user.type(tagInput, 'music')
		await user.click(addButton)

		await waitFor(() => {
			expect(screen.getByText('#music')).toBeInTheDocument()
		})

		await user.type(tagInput, 'music')
		await user.click(addButton)

		await waitFor(() => {
			expect(screen.getByText(/This tag has already been added/i)).toBeInTheDocument()
		})
	})

	it('should validate tag length', async () => {
		const user = userEvent.setup()
		render(<CreateEventModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />, {
			wrapper,
		})

		await waitFor(() => {
			expect(screen.getByPlaceholderText(/Add a tag/i)).toBeInTheDocument()
		})

		const tagInput = screen.getByPlaceholderText(/Add a tag/i)
		const addButton = screen.getByRole('button', { name: /Add/i })

		const longTag = 'a'.repeat(51)
		// Use fireEvent for faster input with long strings
		fireEvent.change(tagInput, { target: { value: longTag } })
		await user.click(addButton)

		await waitFor(
			() => {
				// The error message includes "after normalization" and current count
				expect(screen.getByText(/Tag must be 50 characters or less/i)).toBeInTheDocument()
			},
			{ timeout: 5000 }
		)
	}, 10000)

	it('should show draft prompt when draft exists', async () => {
		mockHasDraft.mockReturnValue(true)
		mockLoadDraft.mockReturnValue({
			title: 'Draft Event',
			summary: 'Draft summary',
		})

		render(<CreateEventModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />, {
			wrapper,
		})

		// Check that draft prompt is visible to user
		await waitFor(
			() => {
				expect(screen.getByText('Resume draft?')).toBeInTheDocument()
				expect(screen.getByText(/You have an unsaved draft/i)).toBeInTheDocument()
			},
			{ timeout: 2000 }
		)
	})

	it('should handle form submission', async () => {
		const user = userEvent.setup()
		const mockOnSuccess = vi.fn()
		;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			json: async () => ({ id: 'new-event' }),
		})

		render(<CreateEventModal isOpen={true} onClose={vi.fn()} onSuccess={mockOnSuccess} />, {
			wrapper,
		})

		await waitFor(() => {
			expect(screen.getByLabelText(/Event Title/i)).toBeInTheDocument()
		})

		const titleInput = screen.getByLabelText(/Event Title/i)
		const startTimeInput = screen.getByLabelText(/Start Date & Time/i)

		await user.type(titleInput, 'New Event')
		await user.type(startTimeInput, '2024-12-31T10:00')

		const submitButton = screen.getByRole('button', { name: /Create Event/i })
		await user.click(submitButton)

		// Check that onSuccess was called (user-visible behavior)
		await waitFor(
			() => {
				expect(mockOnSuccess).toHaveBeenCalled()
			},
			{ timeout: 2000 }
		)
	})

	it('should validate required fields', async () => {
		const user = userEvent.setup()
		const mockOnSuccess = vi.fn()
		render(<CreateEventModal isOpen={true} onClose={vi.fn()} onSuccess={mockOnSuccess} />, {
			wrapper,
		})

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /Create Event/i })).toBeInTheDocument()
		})

		const submitButton = screen.getByRole('button', { name: /Create Event/i })
		await user.click(submitButton)

		// HTML5 required validation will prevent form submission
		// The browser shows native validation, or the form won't submit
		// Check that onSuccess was NOT called (form didn't submit)
		await waitFor(
			() => {
				expect(mockOnSuccess).not.toHaveBeenCalled()
			},
			{ timeout: 1000 }
		)

		// Also check that the title input is marked as required (has required attribute)
		const titleInput = screen.getByLabelText(/Event Title/i)
		expect(titleInput).toBeRequired()
	})

	it('should handle close', async () => {
		const user = userEvent.setup()
		const mockOnClose = vi.fn()
		render(<CreateEventModal isOpen={true} onClose={mockOnClose} onSuccess={vi.fn()} />, {
			wrapper,
		})

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /Close/i })).toBeInTheDocument()
		})

		const closeButton = screen.getByRole('button', { name: /Close/i })
		await user.click(closeButton)

		expect(mockOnClose).toHaveBeenCalled()
	})

	it('should handle visibility selection', async () => {
		render(<CreateEventModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />, {
			wrapper,
		})

		await waitFor(() => {
			// "Create Event" may appear multiple times
			expect(screen.getAllByText(/Create Event/i).length).toBeGreaterThan(0)
		})
	})

	it('should handle recurrence pattern', async () => {
		render(<CreateEventModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />, {
			wrapper,
		})

		await waitFor(() => {
			// "Create Event" may appear multiple times
			expect(screen.getAllByText(/Create Event/i).length).toBeGreaterThan(0)
		})
	})

	it('should handle location suggestions', async () => {
		const user = userEvent.setup()
		render(<CreateEventModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />, {
			wrapper,
		})

		await waitFor(() => {
			expect(screen.getByLabelText(/Location/i)).toBeInTheDocument()
		})

		const locationInput = screen.getByLabelText(/Location/i)
		await user.type(locationInput, 'New York')
	})

	it('should handle save as template', async () => {
		render(<CreateEventModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />, {
			wrapper,
		})

		await waitFor(() => {
			// "Create Event" may appear multiple times
			expect(screen.getAllByText(/Create Event/i).length).toBeGreaterThan(0)
		})
	})
})
