import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { ReportsPage } from '../../pages/ReportsPage'
import type { Report } from '../../types'
import { createTestWrapper, clearQueryClient } from '../testUtils'

// Mock dependencies
const mockUser = { id: 'user1', username: 'testuser', name: 'Test User' }

const mockReports: Report[] = [
	{
		id: 'report_1',
		createdAt: '2024-01-15T10:00:00Z',
		updatedAt: '2024-01-15T10:00:00Z',
		reporterId: 'user1',
		reportedUserId: 'user2',
		contentUrl: 'event:event_123',
		reason: 'Inappropriate content',
		category: 'inappropriate',
		status: 'pending',
	},
	{
		id: 'report_2',
		createdAt: '2024-01-14T10:00:00Z',
		updatedAt: '2024-01-16T10:00:00Z',
		reporterId: 'user1',
		reportedUserId: null,
		contentUrl: 'comment:comment_123',
		reason: 'Spam content',
		category: 'spam',
		status: 'resolved',
	},
	{
		id: 'report_3',
		createdAt: '2024-01-13T10:00:00Z',
		updatedAt: '2024-01-13T10:00:00Z',
		reporterId: 'user1',
		reportedUserId: null,
		contentUrl: 'user:user_456',
		reason: 'Harassment',
		category: 'harassment',
		status: 'dismissed',
	},
]

const mockUseQuery = vi.fn()
const mockUseQueryClient = vi.fn()
const mockInvalidateQueries = vi.fn()
const mockUseAuth = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
	useAuth: () => mockUseAuth(),
}))

vi.mock('@tanstack/react-query', async () => {
	const actual = await vi.importActual('@tanstack/react-query')
	return {
		...actual,
		useQuery: () => mockUseQuery(),
		useQueryClient: () => mockUseQueryClient(),
	}
})

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

const { wrapper, queryClient } = createTestWrapper(['/reports'])

describe('ReportsPage', () => {
	beforeEach(() => {
		clearQueryClient(queryClient)
		vi.clearAllMocks()
		mockUseAuth.mockReturnValue({
			user: mockUser,
			logout: vi.fn(),
		})
		mockUseQueryClient.mockReturnValue({
			invalidateQueries: mockInvalidateQueries,
		})
		mockUseQuery.mockReturnValue({
			data: { reports: [] },
			isLoading: false,
		})
	})

	afterEach(() => {
		clearQueryClient(queryClient)
	})

	it('should render reports page', () => {
		render(<ReportsPage />, { wrapper })
		expect(screen.getByText('My Reports')).toBeInTheDocument()
		expect(screen.getByText('View the status of your content reports')).toBeInTheDocument()
	})

	it('should show loading state', () => {
		mockUseQuery.mockReturnValue({
			data: undefined,
			isLoading: true,
		})

		render(<ReportsPage />, { wrapper })

		expect(screen.getByRole('status')).toBeInTheDocument()
	})

	it('should display reports list', async () => {
		mockUseQuery.mockReturnValue({
			data: { reports: mockReports },
			isLoading: false,
		})

		render(<ReportsPage />, { wrapper })

		await waitFor(() => {
			expect(screen.getByText('Inappropriate content')).toBeInTheDocument()
			expect(screen.getByText('Spam content')).toBeInTheDocument()
			expect(screen.getByText('Harassment')).toBeInTheDocument()
		})
	})

	it('should show empty state when no reports', () => {
		mockUseQuery.mockReturnValue({
			data: { reports: [] },
			isLoading: false,
		})

		render(<ReportsPage />, { wrapper })

		expect(screen.getByText("You haven't submitted any reports yet.")).toBeInTheDocument()
	})

	it('should display report status badges correctly', async () => {
		mockUseQuery.mockReturnValue({
			data: { reports: mockReports },
			isLoading: false,
		})

		render(<ReportsPage />, { wrapper })

		await waitFor(() => {
			expect(screen.getByText('Pending Review')).toBeInTheDocument()
			expect(screen.getByText('Resolved')).toBeInTheDocument()
			expect(screen.getByText('Dismissed')).toBeInTheDocument()
		})
	})

	it('should display report categories correctly', async () => {
		mockUseQuery.mockReturnValue({
			data: { reports: mockReports },
			isLoading: false,
		})

		render(<ReportsPage />, { wrapper })

		await waitFor(() => {
			expect(screen.getByText('Inappropriate Content')).toBeInTheDocument()
			expect(screen.getByText('Spam')).toBeInTheDocument()
			expect(screen.getByText('Harassment or Bullying')).toBeInTheDocument()
		})
	})

	it('should show appeal button for resolved reports', async () => {
		mockUseQuery.mockReturnValue({
			data: { reports: [mockReports[1]] },
			isLoading: false,
		})

		render(<ReportsPage />, { wrapper })

		await waitFor(() => {
			expect(screen.getByRole('button', { name: 'Appeal This Decision' })).toBeInTheDocument()
		})
	})

	it('should show appeal button for dismissed reports', async () => {
		mockUseQuery.mockReturnValue({
			data: { reports: [mockReports[2]] },
			isLoading: false,
		})

		render(<ReportsPage />, { wrapper })

		await waitFor(() => {
			expect(screen.getByRole('button', { name: 'Appeal This Decision' })).toBeInTheDocument()
		})
	})

	it('should not show appeal button for pending reports', async () => {
		mockUseQuery.mockReturnValue({
			data: { reports: [mockReports[0]] },
			isLoading: false,
		})

		render(<ReportsPage />, { wrapper })

		await waitFor(() => {
			expect(
				screen.queryByRole('button', { name: 'Appeal This Decision' })
			).not.toBeInTheDocument()
		})
	})

	it('should open appeal modal when appeal button is clicked', async () => {
		const user = userEvent.setup()
		mockUseQuery.mockReturnValue({
			data: { reports: [mockReports[1]] },
			isLoading: false,
		})

		render(<ReportsPage />, { wrapper })

		await waitFor(() => {
			expect(screen.getByRole('button', { name: 'Appeal This Decision' })).toBeInTheDocument()
		})

		const appealButton = screen.getByRole('button', {
			name: 'Appeal This Decision',
		})
		await user.click(appealButton)

		await waitFor(() => {
			expect(screen.getByText('Submit Appeal')).toBeInTheDocument()
		})
	})

	it('should parse and display content URL correctly', async () => {
		mockUseQuery.mockReturnValue({
			data: { reports: [mockReports[0]] },
			isLoading: false,
		})

		render(<ReportsPage />, { wrapper })

		await waitFor(() => {
			expect(screen.getByText(/event:/i)).toBeInTheDocument()
		})
	})
})

