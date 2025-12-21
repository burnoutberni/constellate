import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import '@testing-library/jest-dom'

import { AdminPage } from '../../pages/AdminPage'
import { api } from '../../lib/api-client'
import { createTestWrapper } from '../testUtils'
import { useAuth } from '../../hooks/useAuth'

// Mock API
vi.mock('../../lib/api-client', () => ({
	api: {
		get: vi.fn(),
		post: vi.fn(),
		delete: vi.fn(),
	},
}))

// Mock useAuth
vi.mock('../../hooks/useAuth', () => ({
	useAuth: vi.fn(),
}))

// Mock Sub-components to simplify page test
vi.mock('../../components/admin/ReportQueue', () => ({
	ReportQueue: () => <div data-testid="report-queue">Report Queue</div>,
}))
vi.mock('../../components/admin/AppealQueue', () => ({
	AppealQueue: () => <div data-testid="appeal-queue">Appeal Queue</div>,
}))

describe('AdminPage', () => {
	const mockAdminUser = {
		id: 'admin-1',
		username: 'admin',
		isAdmin: true,
	}

	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(useAuth).mockReturnValue({
			user: mockAdminUser,
			logout: vi.fn(),
		} as unknown as ReturnType<typeof useAuth>)
	})

	it('renders loading state initially for profile', () => {
		vi.mocked(api.get).mockImplementation(() => new Promise(() => {}))
		const { wrapper } = createTestWrapper()
		render(<AdminPage />, { wrapper })
		expect(document.querySelector('.animate-spin')).toBeInTheDocument()
	})

	it('redirects if not admin', async () => {
		vi.mocked(useAuth).mockReturnValue({
			user: { ...mockAdminUser, isAdmin: false },
			logout: vi.fn(),
		} as unknown as ReturnType<typeof useAuth>)
		vi.mocked(api.get).mockResolvedValue({ ...mockAdminUser, isAdmin: false })

		const { wrapper } = createTestWrapper()
		render(<AdminPage />, { wrapper })

		// Should not render admin content
		await waitFor(() => {
			expect(screen.queryByText('Admin Panel')).not.toBeInTheDocument()
		})
	})

	it('renders admin panel for admin user', async () => {
		vi.mocked(api.get).mockImplementation((url) => {
			if (url === '/users/me/profile') return Promise.resolve(mockAdminUser)
			if (url === '/admin/users') return Promise.resolve({ users: [], pagination: {} })
			return Promise.resolve({})
		})

		const { wrapper } = createTestWrapper()
		render(<AdminPage />, { wrapper })

		await waitFor(() => {
			expect(screen.getByText('Admin Panel')).toBeInTheDocument()
			expect(screen.getByText('User Management')).toBeInTheDocument()
		})
	})

	it('switches tabs correctly', async () => {
		vi.mocked(api.get).mockImplementation((url) => {
			if (url === '/users/me/profile') return Promise.resolve(mockAdminUser)
			if (url === '/admin/users') return Promise.resolve({ users: [], pagination: {} })
			if (url === '/admin/api-keys') return Promise.resolve({ apiKeys: [] })
			return Promise.resolve({})
		})

		const { wrapper } = createTestWrapper()
		render(<AdminPage />, { wrapper })

		await waitFor(() => {
			expect(screen.getByText('User Management')).toBeInTheDocument()
		})

		fireEvent.click(screen.getByText('API Keys'))

		await waitFor(() => {
			expect(screen.getByText('API Key Management')).toBeInTheDocument()
		})

		fireEvent.click(screen.getByText('Reports'))

		await waitFor(() => {
			expect(screen.getByTestId('report-queue')).toBeInTheDocument()
		})

		fireEvent.click(screen.getByText('Appeals'))

		await waitFor(() => {
			expect(screen.getByTestId('appeal-queue')).toBeInTheDocument()
		})
	})
})
