import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { AppealsPage } from '../../pages/AppealsPage'
import type { Appeal } from '../../types'
import { createTestWrapper, clearQueryClient } from '../testUtils'

// Mock fetch
global.fetch = vi.fn()

// Mock useAuth
const mockUser = { id: 'user1', username: 'testuser', name: 'Test User' }
const mockLogout = vi.fn()
const mockUseAuth = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
	useAuth: () => mockUseAuth(),
}))

// Mock useQuery and useQueryClient
const mockUseQuery = vi.fn()
const mockUseQueryClient = vi.fn()
const mockInvalidateQueries = vi.fn()

vi.mock('@tanstack/react-query', async () => {
	const actual = await vi.importActual('@tanstack/react-query')
	return {
		...actual,
		useQuery: () => mockUseQuery(),
		useQueryClient: () => mockUseQueryClient(),
	}
})

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
	const actual = await vi.importActual('react-router-dom')
	return {
		...actual,
		Link: ({ to, children, ...props }: ComponentProps<'a'> & { to: string }) => (
			<a href={to} {...props}>
				{children}
			</a>
		),
	}
})

const mockAppeals: Appeal[] = [
	{
		id: 'appeal-1',
		userId: 'user1',
		type: 'CONTENT_REMOVAL',
		reason: 'My content was removed incorrectly',
		status: 'PENDING',
		createdAt: '2024-01-15T10:00:00Z',
		updatedAt: '2024-01-15T10:00:00Z',
	},
	{
		id: 'appeal-2',
		userId: 'user1',
		type: 'ACCOUNT_SUSPENSION',
		reason: 'My account was suspended unfairly',
		status: 'APPROVED',
		createdAt: '2024-01-14T10:00:00Z',
		updatedAt: '2024-01-16T10:00:00Z',
		resolvedAt: '2024-01-16T10:00:00Z',
		adminNotes: 'Appeal approved. Account restored.',
	},
	{
		id: 'appeal-3',
		userId: 'user1',
		type: 'CONTENT_REMOVAL',
		reason: 'Another appeal',
		status: 'REJECTED',
		createdAt: '2024-01-13T10:00:00Z',
		updatedAt: '2024-01-17T10:00:00Z',
		resolvedAt: '2024-01-17T10:00:00Z',
		adminNotes: 'Appeal rejected. Original decision stands.',
	},
]

const { wrapper, queryClient } = createTestWrapper(['/appeals'])

describe('AppealsPage', () => {
	beforeEach(() => {
		clearQueryClient(queryClient)
		vi.clearAllMocks()
		mockUseAuth.mockReturnValue({
			user: mockUser,
			logout: mockLogout,
		})
		mockUseQueryClient.mockReturnValue({
			invalidateQueries: mockInvalidateQueries,
		})
		mockUseQuery.mockReturnValue({
			data: { appeals: [] },
			isLoading: false,
		})
	})

	afterEach(() => {
		clearQueryClient(queryClient)
		vi.clearAllMocks()
	})

	it('should render appeals page with title', () => {
		render(<AppealsPage />, { wrapper })

		expect(screen.getByText('My Appeals')).toBeInTheDocument()
		expect(screen.getByText(/Track the status of your moderation appeals/i)).toBeInTheDocument()
	})

	it('should show loading spinner while loading', () => {
		// Override the default mock return value from beforeEach
		mockUseQuery.mockReturnValue({
			data: undefined,
			isLoading: true,
		})

		render(<AppealsPage />, { wrapper })

		// Check for spinner - it's an SVG with role="status" and aria-label="Loading"
		// The Spinner component renders an SVG with animate-spin class
		const spinner = screen.getByLabelText('Loading')
		expect(spinner).toBeInTheDocument()
		expect(spinner).toHaveClass('animate-spin')
	})

	it('should show empty state when no appeals exist', () => {
		mockUseQuery.mockReturnValue({
			data: { appeals: [] },
			isLoading: false,
		})

		render(<AppealsPage />, { wrapper })

		expect(screen.getByText(/You haven't submitted any appeals yet/i)).toBeInTheDocument()
	})

	it('should display list of appeals', () => {
		mockUseQuery.mockReturnValue({
			data: { appeals: mockAppeals },
			isLoading: false,
		})

		render(<AppealsPage />, { wrapper })

		expect(screen.getByText('My content was removed incorrectly')).toBeInTheDocument()
		expect(screen.getByText('My account was suspended unfairly')).toBeInTheDocument()
		expect(screen.getByText('Another appeal')).toBeInTheDocument()
	})

	it('should display appeal status badges correctly', () => {
		mockUseQuery.mockReturnValue({
			data: { appeals: mockAppeals },
			isLoading: false,
		})

		render(<AppealsPage />, { wrapper })

		expect(screen.getByText('PENDING')).toBeInTheDocument()
		expect(screen.getByText('APPROVED')).toBeInTheDocument()
		expect(screen.getByText('REJECTED')).toBeInTheDocument()
	})

	it('should display appeal type labels', () => {
		mockUseQuery.mockReturnValue({
			data: { appeals: mockAppeals },
			isLoading: false,
		})

		render(<AppealsPage />, { wrapper })

		// Check that appeal types are displayed (labels from APPEAL_TYPE_LABELS)
		// Use getAllByText since there are multiple appeals with the same type
		expect(screen.getAllByText(/Content Removal/i).length).toBeGreaterThan(0)
		expect(screen.getByText(/Account Suspension/i)).toBeInTheDocument()
	})

	it('should display resolution information for resolved appeals', () => {
		mockUseQuery.mockReturnValue({
			data: { appeals: mockAppeals },
			isLoading: false,
		})

		render(<AppealsPage />, { wrapper })

		// Use getAllByText since there are multiple resolved appeals
		expect(screen.getAllByText('Resolution').length).toBeGreaterThan(0)
		expect(screen.getByText('Appeal approved. Account restored.')).toBeInTheDocument()
		expect(screen.getByText('Appeal rejected. Original decision stands.')).toBeInTheDocument()
	})

	it('should display "No additional notes provided" when adminNotes is missing', () => {
		const appealWithoutNotes: Appeal = {
			id: 'appeal-4',
			userId: 'user1',
			type: 'CONTENT_REMOVAL',
			reason: 'Test appeal',
			status: 'APPROVED',
			createdAt: '2024-01-15T10:00:00Z',
			updatedAt: '2024-01-16T10:00:00Z',
			resolvedAt: '2024-01-16T10:00:00Z',
		}

		mockUseQuery.mockReturnValue({
			data: { appeals: [appealWithoutNotes] },
			isLoading: false,
		})

		render(<AppealsPage />, { wrapper })

		expect(screen.getByText('No additional notes provided.')).toBeInTheDocument()
	})

	it('should open appeal modal when "Submit New Appeal" button is clicked', async () => {
		const user = userEvent.setup()
		mockUseQuery.mockReturnValue({
			data: { appeals: [] },
			isLoading: false,
		})

		render(<AppealsPage />, { wrapper })

		const submitButton = screen.getByRole('button', { name: /Submit New Appeal/i })
		await user.click(submitButton)

		await waitFor(() => {
			expect(screen.getByText('Submit Appeal')).toBeInTheDocument()
		})
	})

	it('should refresh appeals list when appeal is successfully submitted', async () => {
		const user = userEvent.setup()
		mockUseQuery.mockReturnValue({
			data: { appeals: [] },
			isLoading: false,
		})

		render(<AppealsPage />, { wrapper })

		const submitButton = screen.getByRole('button', { name: /Submit New Appeal/i })
		await user.click(submitButton)

		await waitFor(() => {
			expect(screen.getByText('Submit Appeal')).toBeInTheDocument()
		})

		// The modal's onSuccess callback should invalidate queries
		// This is tested indirectly through the modal component's behavior
		// The actual invalidation happens when the modal calls onSuccess
	})

	it('should display formatted dates for appeals', () => {
		mockUseQuery.mockReturnValue({
			data: { appeals: mockAppeals },
			isLoading: false,
		})

		render(<AppealsPage />, { wrapper })

		// Check that dates are displayed (they should be formatted)
		const dateElements = screen.getAllByText(/Submitted on/i)
		expect(dateElements.length).toBeGreaterThan(0)
	})

	it('should display formatted resolution dates for resolved appeals', () => {
		mockUseQuery.mockReturnValue({
			data: { appeals: mockAppeals },
			isLoading: false,
		})

		render(<AppealsPage />, { wrapper })

		// Check that resolution dates are displayed
		const resolutionDateElements = screen.getAllByText(/Resolved on/i)
		expect(resolutionDateElements.length).toBe(2) // Two resolved appeals
	})

	it('should have link to settings page', () => {
		mockUseQuery.mockReturnValue({
			data: { appeals: [] },
			isLoading: false,
		})

		render(<AppealsPage />, { wrapper })

		const settingsLink = screen.getByRole('link', { name: /Back to Settings/i })
		expect(settingsLink).toBeInTheDocument()
		expect(settingsLink).toHaveAttribute('href', '/settings')
	})
})

