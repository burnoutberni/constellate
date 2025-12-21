import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import '@testing-library/jest-dom'

import { AppealQueue } from '../../../components/admin/AppealQueue'
import { api } from '../../../lib/api-client'
import { createTestWrapper } from '../../testUtils'

// Mock API
vi.mock('../../../lib/api-client', () => ({
	api: {
		get: vi.fn(),
		put: vi.fn(),
	},
}))

describe('AppealQueue', () => {
	const mockAppeals = [
		{
			id: 'appeal-1',
			userId: 'user-1',
			type: 'CONTENT_REMOVAL',
			reason: 'My content was fine',
			status: 'PENDING',
			createdAt: new Date().toISOString(),
			user: {
				username: 'appealer_one',
			},
		},
		{
			id: 'appeal-2',
			userId: 'user-2',
			type: 'ACCOUNT_SUSPENSION',
			reason: 'I did not break rules',
			status: 'PENDING',
			createdAt: new Date().toISOString(),
			user: {
				username: 'appealer_two',
			},
		},
	]

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('renders loading state initially', () => {
		vi.mocked(api.get).mockImplementation(() => new Promise(() => {}))
		const { wrapper } = createTestWrapper()
		render(<AppealQueue />, { wrapper })
		expect(document.querySelector('.animate-spin')).toBeInTheDocument()
	})

	it('renders empty state when no appeals', async () => {
		vi.mocked(api.get).mockResolvedValue({ appeals: [] })
		const { wrapper } = createTestWrapper()
		render(<AppealQueue />, { wrapper })

		await waitFor(() => {
			expect(screen.getByText(/No pending appeals/)).toBeInTheDocument()
		})
	})

	it('renders list of appeals', async () => {
		vi.mocked(api.get).mockResolvedValue({ appeals: mockAppeals })
		const { wrapper } = createTestWrapper()
		render(<AppealQueue />, { wrapper })

		await waitFor(() => {
			expect(screen.getByText('Content Removal')).toBeInTheDocument()
			expect(screen.getByText('Account Suspension')).toBeInTheDocument()
			expect(screen.getByText('Appealed by @appealer_one')).toBeInTheDocument()
			expect(screen.getByText('My content was fine')).toBeInTheDocument()
		})
	})

	it('calls update status when approving', async () => {
		vi.mocked(api.get).mockResolvedValue({ appeals: mockAppeals })
		vi.mocked(api.put).mockResolvedValue({})

		const { wrapper } = createTestWrapper()
		render(<AppealQueue />, { wrapper })

		await waitFor(() => {
			expect(screen.getByText('Content Removal')).toBeInTheDocument()
		})

		const approveButtons = screen.getAllByText('Approve')
		fireEvent.click(approveButtons[0])

		await waitFor(() => {
			expect(api.put).toHaveBeenCalledWith('/admin/appeals/appeal-1', { status: 'approved' })
		})
	})

	it('calls update status when rejecting', async () => {
		vi.mocked(api.get).mockResolvedValue({ appeals: mockAppeals })
		vi.mocked(api.put).mockResolvedValue({})

		const { wrapper } = createTestWrapper()
		render(<AppealQueue />, { wrapper })

		await waitFor(() => {
			expect(screen.getByText('Content Removal')).toBeInTheDocument()
		})

		const rejectButtons = screen.getAllByText('Reject')
		fireEvent.click(rejectButtons[0])

		await waitFor(() => {
			expect(api.put).toHaveBeenCalledWith('/admin/appeals/appeal-1', { status: 'rejected' })
		})
	})
})
