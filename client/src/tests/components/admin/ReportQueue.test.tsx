import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import '@testing-library/jest-dom' // Ensure matchers are available

import { ReportQueue } from '../../../components/admin/ReportQueue'
import { api } from '../../../lib/api-client'
import { createTestWrapper } from '../../testUtils'

// Mock API
vi.mock('../../../lib/api-client', () => ({
	api: {
		get: vi.fn(),
		put: vi.fn(),
	},
}))

describe('ReportQueue', () => {
	const mockReports = [
		{
			id: 'report-1',
			reporterId: 'user-1',
			reportedUserId: 'user-2',
			contentUrl: 'user:user-2',
			reason: 'Harassment in comments',
			category: 'harassment',
			status: 'pending',
			createdAt: new Date().toISOString(),
			reporter: {
				username: 'reporter_user',
			},
		},
		{
			id: 'report-2',
			reporterId: 'user-3',
			contentUrl: 'event:event-1',
			reason: 'Spam content',
			category: 'spam',
			status: 'pending',
			createdAt: new Date().toISOString(),
			reporter: {
				username: 'another_reporter',
			},
		},
	]

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('renders loading state initially', () => {
		vi.mocked(api.get).mockImplementation(() => new Promise(() => {})) // Never resolves
		const { wrapper } = createTestWrapper()
		render(<ReportQueue />, { wrapper })
		expect(document.querySelector('.animate-spin')).toBeInTheDocument()
	})

	it('renders empty state when no reports', async () => {
		vi.mocked(api.get).mockResolvedValue({ reports: [] })
		const { wrapper } = createTestWrapper()
		render(<ReportQueue />, { wrapper })

		await waitFor(() => {
			expect(screen.getByText(/No pending reports/)).toBeInTheDocument()
		})
	})

	it('renders list of reports', async () => {
		vi.mocked(api.get).mockResolvedValue({ reports: mockReports })
		const { wrapper } = createTestWrapper()
		render(<ReportQueue />, { wrapper })

		await waitFor(() => {
			expect(screen.getByText('Harassment')).toBeInTheDocument()
			expect(screen.getByText('Spam content')).toBeInTheDocument()
			expect(screen.getByText('Reported by @reporter_user')).toBeInTheDocument()
		})
	})

	it('calls update status when resolving', async () => {
		vi.mocked(api.get).mockResolvedValue({ reports: mockReports })
		vi.mocked(api.put).mockResolvedValue({})

		const { wrapper } = createTestWrapper()
		render(<ReportQueue />, { wrapper })

		await waitFor(() => {
			expect(screen.getByText('Harassment')).toBeInTheDocument()
		})

		const resolveButtons = screen.getAllByText('Resolve')
		fireEvent.click(resolveButtons[0])

		await waitFor(() => {
			expect(api.put).toHaveBeenCalledWith('/reports/report-1', { status: 'resolved' })
		})
	})

	it('calls update status when dismissing', async () => {
		vi.mocked(api.get).mockResolvedValue({ reports: mockReports })
		vi.mocked(api.put).mockResolvedValue({})

		const { wrapper } = createTestWrapper()
		render(<ReportQueue />, { wrapper })

		await waitFor(() => {
			expect(screen.getByText('Harassment')).toBeInTheDocument()
		})

		const dismissButtons = screen.getAllByText('Dismiss')
		fireEvent.click(dismissButtons[0])

		await waitFor(() => {
			expect(api.put).toHaveBeenCalledWith('/reports/report-1', { status: 'dismissed' })
		})
	})

	it('opens content in new tab when viewing content', async () => {
		vi.mocked(api.get).mockResolvedValue({
			reports: [
				{
					...mockReports[0],
					contentPath: '/@user/event-1',
				},
			],
		})

		const { wrapper } = createTestWrapper()
		render(<ReportQueue />, { wrapper })

		await waitFor(() => {
			expect(screen.getByText('Harassment')).toBeInTheDocument()
		})

		const link = screen.getByText('View Content')
		expect(link.tagName).toBe('A')
		expect(link).toHaveAttribute('href', '/@user/event-1')
		expect(link).toHaveAttribute('target', '_blank')
		expect(link).toHaveAttribute('rel', 'noopener noreferrer')
	})
})
