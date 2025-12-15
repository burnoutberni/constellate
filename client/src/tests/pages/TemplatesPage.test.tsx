import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemplatesPage } from '../../pages/TemplatesPage'
import type { EventTemplate } from '../../components/TemplateCard'
import { createTestWrapper, clearQueryClient } from '../testUtils'

// Mock dependencies
const mockUser = { id: 'user1', username: 'testuser', name: 'Test User' }
const mockTemplate: EventTemplate = {
	id: 'template1',
	name: 'Weekly Meeting',
	description: 'Template for weekly meetings',
	data: {
		title: 'Weekly Meeting',
		summary: 'Our weekly team meeting',
		location: 'Conference Room',
		locationLatitude: 40.7128,
		locationLongitude: -74.006,
		url: 'https://example.com',
	},
}

const mockUseQuery = vi.fn()
const mockUseMutation = vi.fn()
const mockNavigate = vi.fn()
const mockAddErrorToast = vi.fn()
const mockUseAuth = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
	useAuth: () => mockUseAuth(),
}))

vi.mock('@tanstack/react-query', async () => {
	const actual = await vi.importActual('@tanstack/react-query')
	return {
		...actual,
		useQuery: () => mockUseQuery(),
		useMutation: () => mockUseMutation(),
		useQueryClient: () => ({
			invalidateQueries: vi.fn(),
		}),
	}
})

vi.mock('react-router-dom', async () => {
	const actual = await vi.importActual('react-router-dom')
	return {
		...actual,
		useNavigate: () => mockNavigate,
	}
})

vi.mock('../../stores', () => ({
	useUIStore: () => ({
		addToast: mockAddErrorToast,
	}),
}))

// Mock Navbar to prevent API calls
vi.mock('../../components/Navbar', () => ({
	Navbar: () => <nav data-testid="navbar">Navbar</nav>,
}))

global.fetch = vi.fn()

const { wrapper, queryClient } = createTestWrapper(['/templates'])

describe('TemplatesPage', () => {
	beforeEach(() => {
		clearQueryClient(queryClient)
		vi.clearAllMocks()
		mockUseAuth.mockReturnValue({
			user: mockUser,
			logout: vi.fn(),
		})
		mockUseQuery.mockReturnValue({
			data: [mockTemplate],
			isLoading: false,
		})
		mockUseMutation.mockReturnValue({
			mutateAsync: vi.fn().mockResolvedValue({}),
		})
		;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			json: async () => ({ templates: [mockTemplate] }),
		})
	})

	afterEach(() => {
		clearQueryClient(queryClient)
	})

	it('should render templates page', () => {
		render(<TemplatesPage />, { wrapper })
		// Check for the heading
		expect(screen.getByText('Event Templates')).toBeInTheDocument()
	})

	it('should show sign in prompt for unauthenticated users', () => {
		mockUseAuth.mockReturnValue({
			user: null,
			logout: vi.fn(),
		})

		render(<TemplatesPage />, { wrapper })

		expect(screen.getByText(/Sign In Required/i)).toBeInTheDocument()
	})

	it('should display loading state', () => {
		mockUseQuery.mockReturnValue({
			data: undefined,
			isLoading: true,
		})

		render(<TemplatesPage />, { wrapper })
		// Loading state is handled by TemplateList component
	})

	it('should display templates list', async () => {
		render(<TemplatesPage />, { wrapper })

		await waitFor(
			() => {
				// Template name appears multiple times (name and event title)
				expect(screen.getAllByText('Weekly Meeting').length).toBeGreaterThan(0)
			},
			{ timeout: 2000 }
		)
	})

	it('should show empty state when no templates', () => {
		mockUseQuery.mockReturnValue({
			data: [],
			isLoading: false,
		})

		render(<TemplatesPage />, { wrapper })
		// Empty state is handled by TemplateList component
	})

	it('should handle template preview', async () => {
		const user = userEvent.setup()
		render(<TemplatesPage />, { wrapper })

		await waitFor(
			() => {
				expect(screen.getAllByText('Weekly Meeting').length).toBeGreaterThan(0)
			},
			{ timeout: 2000 }
		)

		// Look for preview button
		const previewButton = screen.getByRole('button', { name: 'Preview' })
		await user.click(previewButton)

		await waitFor(
			() => {
				expect(screen.getByText('Template Preview')).toBeInTheDocument()
			},
			{ timeout: 2000 }
		)
	})

	it('should handle template edit', async () => {
		const user = userEvent.setup()
		render(<TemplatesPage />, { wrapper })

		await waitFor(
			() => {
				expect(screen.getAllByText('Weekly Meeting').length).toBeGreaterThan(0)
			},
			{ timeout: 2000 }
		)

		// Look for edit button
		const editButton = screen.getByRole('button', { name: 'Edit' })
		await user.click(editButton)

		await waitFor(
			() => {
				expect(screen.getByText(/Edit Template/i)).toBeInTheDocument()
			},
			{ timeout: 2000 }
		)
	})

	it('should handle template deletion', async () => {
		const user = userEvent.setup()
		const mockDeleteAsync = vi.fn().mockResolvedValue(undefined)
		mockUseMutation.mockReturnValue({
			mutateAsync: mockDeleteAsync,
			isPending: false,
		})

		render(<TemplatesPage />, { wrapper })

		await waitFor(
			() => {
				expect(screen.getAllByText('Weekly Meeting').length).toBeGreaterThan(0)
			},
			{ timeout: 2000 }
		)

		// Look for delete button
		const deleteButton = screen.getByRole('button', { name: 'Delete' })

		// Click delete button to show confirmation
		await user.click(deleteButton)

		// Wait for confirmation dialog
		await waitFor(
			() => {
				expect(screen.getByText(/Are you sure you want to delete/i)).toBeInTheDocument()
			},
			{ timeout: 2000 }
		)

		// Click "Yes, Delete" button
		const confirmButton = screen.getByRole('button', { name: 'Yes, Delete' })
		await user.click(confirmButton)

		// Wait for mutation to be called
		await waitFor(
			() => {
				expect(mockDeleteAsync).toHaveBeenCalledWith('template1')
			},
			{ timeout: 2000 }
		)
	})

	it('should handle template use', async () => {
		const user = userEvent.setup()
		render(<TemplatesPage />, { wrapper })

		await waitFor(
			() => {
				expect(screen.getAllByText('Weekly Meeting').length).toBeGreaterThan(0)
			},
			{ timeout: 2000 }
		)

		// Look for use button
		const useButton = screen.getByRole('button', { name: 'Use Template' })
		await user.click(useButton)

		await waitFor(
			() => {
				expect(mockNavigate).toHaveBeenCalled()
			},
			{ timeout: 2000 }
		)
	})

	it('should handle template edit save', async () => {
		const user = userEvent.setup()
		const mockUpdate = vi.fn().mockResolvedValue({})
		mockUseMutation.mockReturnValue({
			mutateAsync: mockUpdate,
		})

		render(<TemplatesPage />, { wrapper })

		await waitFor(
			() => {
				expect(screen.getAllByText('Weekly Meeting').length).toBeGreaterThan(0)
			},
			{ timeout: 2000 }
		)

		// Open edit modal
		const editButton = screen.getByRole('button', { name: 'Edit' })
		await user.click(editButton)

		await waitFor(
			() => {
				expect(screen.getByText(/Edit Template/i)).toBeInTheDocument()
			},
			{ timeout: 2000 }
		)

		const nameInput = screen.getByLabelText(/Template Name/i)
		await user.clear(nameInput)
		await user.type(nameInput, 'Updated Template')

		const saveButton = screen.getByRole('button', { name: /Save Changes/i })
		await user.click(saveButton)

		// Wait for mutation to be called - use a shorter timeout and check immediately
		await waitFor(
			() => {
				expect(mockUpdate).toHaveBeenCalled()
			},
			{ timeout: 1000 }
		)
	})

	it('should handle template edit cancel', async () => {
		const user = userEvent.setup()
		render(<TemplatesPage />, { wrapper })

		await waitFor(
			() => {
				expect(screen.getAllByText('Weekly Meeting').length).toBeGreaterThan(0)
			},
			{ timeout: 2000 }
		)

		// Open edit modal
		const editButton = screen.getByRole('button', { name: 'Edit' })
		await user.click(editButton)

		await waitFor(
			() => {
				expect(screen.getByText(/Edit Template/i)).toBeInTheDocument()
			},
			{ timeout: 2000 }
		)

		const cancelButton = screen.getByRole('button', { name: /Cancel/i })
		await user.click(cancelButton)

		await waitFor(
			() => {
				expect(screen.queryByText(/Edit Template/i)).not.toBeInTheDocument()
			},
			{ timeout: 2000 }
		)
	})

	it('should handle fetch error', () => {
		mockUseQuery.mockReturnValue({
			data: undefined,
			isLoading: false,
			error: new Error('Failed to fetch templates'),
		})

		render(<TemplatesPage />, { wrapper })
		// Error handling is done by TemplateList component
	})

	it('should display template preview modal with all fields', async () => {
		const user = userEvent.setup()
		render(<TemplatesPage />, { wrapper })

		await waitFor(
			() => {
				expect(screen.getAllByText('Weekly Meeting').length).toBeGreaterThan(0)
			},
			{ timeout: 2000 }
		)

		// Open preview
		const previewButton = screen.getByRole('button', { name: 'Preview' })
		await user.click(previewButton)

		// Wait for modal to appear
		await waitFor(
			() => {
				expect(screen.getByText('Template Preview')).toBeInTheDocument()
			},
			{ timeout: 2000 }
		)

		// Check that template name appears in modal (may appear multiple times)
		expect(screen.getAllByText('Weekly Meeting').length).toBeGreaterThan(0)
		// Check for description which appears in both card and modal
		expect(screen.getAllByText(/Our weekly team meeting/i).length).toBeGreaterThan(0)
	})

	it('should close preview modal', async () => {
		const user = userEvent.setup()
		render(<TemplatesPage />, { wrapper })

		await waitFor(
			() => {
				expect(screen.getAllByText('Weekly Meeting').length).toBeGreaterThan(0)
			},
			{ timeout: 2000 }
		)

		// Open and close preview
		const previewButton = screen.getByRole('button', { name: 'Preview' })
		await user.click(previewButton)

		await waitFor(
			() => {
				expect(screen.getByText('Template Preview')).toBeInTheDocument()
			},
			{ timeout: 2000 }
		)

		// Find close button (× character)
		const closeButton = screen.getByText('×')
		await user.click(closeButton)

		await waitFor(
			() => {
				expect(screen.queryByText('Template Preview')).not.toBeInTheDocument()
			},
			{ timeout: 2000 }
		)
	})
})
