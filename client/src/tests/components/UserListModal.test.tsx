import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FollowersModal } from '../../components/UserListModal'
import { createTestWrapper } from '../testUtils'
import type { User } from '../../types'

vi.mock('../../lib/api-client', () => ({
	api: {
		get: vi.fn(),
	},
}))

vi.mock('../../hooks/useAuth', () => ({
	useAuth: vi.fn(() => ({
		user: { id: 'current-user', username: 'currentuser' },
	})),
}))

const mockUsers: (User & { isPending?: boolean; isFollowing?: boolean })[] = [
	{
		id: '1',
		username: 'user1',
		name: 'User One',
		profileImage: 'https://example.com/avatar1.jpg',
		displayColor: '#3B82F6',
		createdAt: '2023-01-01T00:00:00.000Z',
		isPublicProfile: true,
		isRemote: false,
		isFollowing: true,
		isPending: false,
	},
	{
		id: '2',
		username: 'user2',
		name: 'User Two',
		profileImage: null,
		displayColor: '#10B981',
		createdAt: '2023-01-02T00:00:00.000Z',
		isPublicProfile: true,
		isRemote: false,
		isFollowing: false,
		isPending: false,
	},
	{
		id: '3',
		username: 'remoteuser',
		name: 'Remote User',
		profileImage: null,
		displayColor: '#F59E0B',
		createdAt: '2023-01-03T00:00:00.000Z',
		isPublicProfile: true,
		isRemote: true,
		isFollowing: false,
		isPending: true,
	},
]

describe('FollowersModal Component', () => {
	const { wrapper, queryClient } = createTestWrapper()
	const mockOnClose = vi.fn()

	beforeEach(() => {
		vi.clearAllMocks()
		queryClient.clear()
	})

	it('should not render when closed', () => {
		render(
			<FollowersModal
				isOpen={false}
				onClose={mockOnClose}
				username="testuser"
				type="followers"
			/>,
			{ wrapper }
		)

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
	})

	it('should render loading state when fetching data', () => {
		render(
			<FollowersModal
				isOpen={true}
				onClose={mockOnClose}
				username="testuser"
				type="followers"
			/>,
			{ wrapper }
		)

		expect(screen.getByText('Followers')).toBeInTheDocument()
	})

	it('should render empty state when no followers', async () => {
		const { api } = await import('../../lib/api-client')
		;(api.get as unknown as vi.Mock).mockResolvedValue({ followers: [] })

		render(
			<FollowersModal
				isOpen={true}
				onClose={mockOnClose}
				username="testuser"
				type="followers"
			/>,
			{ wrapper }
		)

		await waitFor(() => {
			expect(screen.getByText('No followers yet')).toBeInTheDocument()
		})
	})

	it('should render empty state when no following', async () => {
		const { api } = await import('../../lib/api-client')
		;(api.get as unknown as vi.Mock).mockResolvedValue({ following: [] })

		render(
			<FollowersModal
				isOpen={true}
				onClose={mockOnClose}
				username="testuser"
				type="following"
			/>,
			{ wrapper }
		)

		await waitFor(() => {
			expect(screen.getByText('Not following anyone yet')).toBeInTheDocument()
		})
	})

	it('should render users when followers data is loaded', async () => {
		const { api } = await import('../../lib/api-client')
		;(api.get as unknown as vi.Mock).mockResolvedValue({ followers: mockUsers })

		render(
			<FollowersModal
				isOpen={true}
				onClose={mockOnClose}
				username="testuser"
				type="followers"
			/>,
			{ wrapper }
		)

		await waitFor(() => {
			expect(screen.getByText('User One')).toBeInTheDocument()
			expect(screen.getByText('User Two')).toBeInTheDocument()
			expect(screen.getByText('Remote User')).toBeInTheDocument()
		})
	})

	it('should render users when following data is loaded', async () => {
		const { api } = await import('../../lib/api-client')
		;(api.get as unknown as vi.Mock).mockResolvedValue({ following: mockUsers })

		render(
			<FollowersModal
				isOpen={true}
				onClose={mockOnClose}
				username="testuser"
				type="following"
			/>,
			{ wrapper }
		)

		await waitFor(() => {
			expect(screen.getByText('User One')).toBeInTheDocument()
			expect(screen.getByText('User Two')).toBeInTheDocument()
		})
	})

	it('should separate local and remote users', async () => {
		const { api } = await import('../../lib/api-client')
		;(api.get as unknown as vi.Mock).mockResolvedValue({ followers: mockUsers })

		render(
			<FollowersModal
				isOpen={true}
				onClose={mockOnClose}
				username="testuser"
				type="followers"
			/>,
			{ wrapper }
		)

		await waitFor(() => {
			expect(screen.getByText('Local Users')).toBeInTheDocument()
			expect(screen.getByText('Remote Users')).toBeInTheDocument()
		})
	})

	it('should show pending badge for pending followers', async () => {
		const { api } = await import('../../lib/api-client')
		;(api.get as unknown as vi.Mock).mockResolvedValue({ followers: mockUsers })

		render(
			<FollowersModal
				isOpen={true}
				onClose={mockOnClose}
				username="testuser"
				type="followers"
			/>,
			{ wrapper }
		)

		await waitFor(() => {
			expect(screen.getByText('Remote User')).toBeInTheDocument()
		})

		const remoteUserRow = screen.getByText('Remote User').closest('.flex.items-center')
		expect(remoteUserRow).toBeInTheDocument()
		expect(remoteUserRow?.querySelector('.rounded-full')).toBeInTheDocument()
	})

	it('should show remote badge for remote users', async () => {
		const { api } = await import('../../lib/api-client')
		;(api.get as unknown as vi.Mock).mockResolvedValue({ followers: mockUsers })

		render(
			<FollowersModal
				isOpen={true}
				onClose={mockOnClose}
				username="testuser"
				type="followers"
			/>,
			{ wrapper }
		)

		await waitFor(() => {
			expect(screen.getByText('Remote')).toBeInTheDocument()
		})
	})

	it('should close when close button is clicked', async () => {
		const { api } = await import('../../lib/api-client')
		;(api.get as unknown as vi.Mock).mockResolvedValue({ followers: mockUsers })

		render(
			<FollowersModal
				isOpen={true}
				onClose={mockOnClose}
				username="testuser"
				type="followers"
			/>,
			{ wrapper }
		)

		await waitFor(() => {
			expect(screen.getByRole('dialog')).toBeInTheDocument()
		})

		const closeButton = screen.getByRole('button', { name: /×/i })
		fireEvent.click(closeButton)

		expect(mockOnClose).toHaveBeenCalledTimes(1)
	})

	it('should show correct title for followers type', async () => {
		const { api } = await import('../../lib/api-client')
		;(api.get as unknown as vi.Mock).mockResolvedValue({ followers: mockUsers })

		render(
			<FollowersModal
				isOpen={true}
				onClose={mockOnClose}
				username="testuser"
				type="followers"
			/>,
			{ wrapper }
		)

		expect(screen.getByText('Followers')).toBeInTheDocument()
	})

	it('should show correct title for following type', async () => {
		const { api } = await import('../../lib/api-client')
		;(api.get as unknown as vi.Mock).mockResolvedValue({ following: mockUsers })

		render(
			<FollowersModal
				isOpen={true}
				onClose={mockOnClose}
				username="testuser"
				type="following"
			/>,
			{ wrapper }
		)

		expect(screen.getByText('Following')).toBeInTheDocument()
	})

	it('should default to followers type', async () => {
		const { api } = await import('../../lib/api-client')
		;(api.get as unknown as vi.Mock).mockResolvedValue({ followers: mockUsers })

		render(<FollowersModal isOpen={true} onClose={mockOnClose} username="testuser" />, {
			wrapper,
		})

		expect(screen.getByText('Followers')).toBeInTheDocument()
	})

	it('should handle only local users without remote section', async () => {
		const localUsers = mockUsers.filter((u) => !u.isRemote)
		const { api } = await import('../../lib/api-client')
		;(api.get as unknown as vi.Mock).mockResolvedValue({ followers: localUsers })

		render(
			<FollowersModal
				isOpen={true}
				onClose={mockOnClose}
				username="testuser"
				type="followers"
			/>,
			{ wrapper }
		)

		await waitFor(() => {
			expect(screen.getByText('Followers')).toBeInTheDocument()
			expect(screen.queryByText('Local Users')).not.toBeInTheDocument()
			expect(screen.queryByText('Remote Users')).not.toBeInTheDocument()
		})
	})

	it('should handle only remote users', async () => {
		const remoteUsers = mockUsers.filter((u) => u.isRemote)
		const { api } = await import('../../lib/api-client')
		;(api.get as unknown as vi.Mock).mockResolvedValue({ followers: remoteUsers })

		render(
			<FollowersModal
				isOpen={true}
				onClose={mockOnClose}
				username="testuser"
				type="followers"
			/>,
			{ wrapper }
		)

		await waitFor(() => {
			expect(screen.getByText('Remote Followers')).toBeInTheDocument()
		})
	})

	it('should show loading spinner while fetching', async () => {
		render(
			<FollowersModal
				isOpen={true}
				onClose={mockOnClose}
				username="testuser"
				type="followers"
			/>,
			{ wrapper }
		)

		expect(screen.getByLabelText('Loading')).toBeInTheDocument()
	})

	it('should not fetch when closed', async () => {
		const { api } = await import('../../lib/api-client')
		;(api.get as unknown as vi.Mock).mockResolvedValue({ followers: mockUsers })

		render(
			<FollowersModal
				isOpen={false}
				onClose={mockOnClose}
				username="testuser"
				type="followers"
			/>,
			{ wrapper }
		)

		await waitFor(() => {
			expect(api.get as unknown as vi.Mock).not.toHaveBeenCalled()
		})
	})
})
