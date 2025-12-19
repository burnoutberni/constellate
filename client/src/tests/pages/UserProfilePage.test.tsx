import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { UserProfilePage } from '../../pages/UserProfilePage'
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

// Mock query hooks
const mockUseUserProfile = vi.fn()
const mockUseFollowStatus = vi.fn()
const mockUseFollowUser = vi.fn()
const mockUseUnfollowUser = vi.fn()

vi.mock('../../hooks/queries', async () => {
	const actual = await vi.importActual('../../hooks/queries')
	return {
		...actual,
		useUserProfile: () => mockUseUserProfile(),
		useFollowStatus: () => mockUseFollowStatus(),
		useFollowUser: () => mockUseFollowUser(),
		useUnfollowUser: () => mockUseUnfollowUser(),
	}
})

// Mock UI store
const mockOpenFollowersModal = vi.fn()
const mockCloseFollowersModal = vi.fn()

vi.mock('../../stores', () => ({
	useUIStore: () => ({
		followersModalOpen: false,
		followersModalUsername: null,
		followersModalType: null,
		openFollowersModal: mockOpenFollowersModal,
		closeFollowersModal: mockCloseFollowersModal,
	}),
}))

// Mock useErrorHandler
vi.mock('../../hooks/useErrorHandler', () => ({
	useErrorHandler: () => vi.fn(),
	useMutationErrorHandler: () => vi.fn(),
}))

// Mock useQuery for Navbar component
vi.mock('@tanstack/react-query', async () => {
	const actual = await vi.importActual('@tanstack/react-query')
	return {
		...actual,
		useQuery: () => ({
			data: null,
			isLoading: false,
		}),
	}
})

const { wrapper, queryClient } = createTestWrapper(['/@testuser'])

describe('UserProfilePage', () => {
	const mockFollowMutation = {
		mutateAsync: vi.fn(),
		isPending: false,
	}

	const mockUnfollowMutation = {
		mutateAsync: vi.fn(),
		isPending: false,
	}

	beforeEach(() => {
		clearQueryClient(queryClient)
		vi.clearAllMocks()
		mockUseAuth.mockReturnValue({
			user: mockUser,
			logout: mockLogout,
		})
		mockUseFollowUser.mockReturnValue(mockFollowMutation)
		mockUseUnfollowUser.mockReturnValue(mockUnfollowMutation)
		mockUseFollowStatus.mockReturnValue({
			data: { isFollowing: false, isAccepted: true },
		})
	})

	afterEach(() => {
		clearQueryClient(queryClient)
	})

	it('should show private profile message when viewing private profile not following', async () => {
		mockUseUserProfile.mockReturnValue({
			data: {
				user: {
					id: 'user2',
					username: 'privateuser',
					name: 'Private User',
					isPublicProfile: false,
					_count: { events: 5, followers: 10, following: 8 },
				},
				events: [],
			},
			isLoading: false,
			error: null,
		})

		render(<UserProfilePage />, { wrapper })

		await waitFor(() => {
			expect(
				screen.getByText('This profile is private. Follow to see their events.')
			).toBeInTheDocument()
		})
	})

	it('should show events list when viewing public profile', async () => {
		const mockEvents = [
			{ id: 'event1', title: 'Test Event 1', startTime: '2024-01-01T10:00:00Z' },
			{ id: 'event2', title: 'Test Event 2', startTime: '2024-01-02T10:00:00Z' },
		]

		mockUseUserProfile.mockReturnValue({
			data: {
				user: {
					id: 'user2',
					username: 'publicuser',
					name: 'Public User',
					isPublicProfile: true,
					_count: { events: 2, followers: 10, following: 8 },
				},
				events: mockEvents,
			},
			isLoading: false,
			error: null,
		})

		render(<UserProfilePage />, { wrapper })

		await waitFor(() => {
			expect(screen.getByText(/Events \(2\)/)).toBeInTheDocument()
		})

		expect(
			screen.queryByText('This profile is private. Follow to see their events.')
		).not.toBeInTheDocument()
	})

	it('should show events list when viewing own profile even if private', async () => {
		const mockEvents = [{ id: 'event1', title: 'My Event', startTime: '2024-01-01T10:00:00Z' }]

		mockUseUserProfile.mockReturnValue({
			data: {
				user: {
					id: 'user1', // Same as mockUser.id
					username: 'testuser',
					name: 'Test User',
					isPublicProfile: false,
					_count: { events: 1, followers: 10, following: 8 },
				},
				events: mockEvents,
			},
			isLoading: false,
			error: null,
		})

		render(<UserProfilePage />, { wrapper })

		await waitFor(() => {
			expect(screen.getByText(/Events \(1\)/)).toBeInTheDocument()
		})

		expect(
			screen.queryByText('This profile is private. Follow to see their events.')
		).not.toBeInTheDocument()
	})

	it('should show events list when following private profile', async () => {
		const mockEvents = [
			{ id: 'event1', title: 'Followed Event', startTime: '2024-01-01T10:00:00Z' },
		]

		mockUseUserProfile.mockReturnValue({
			data: {
				user: {
					id: 'user2',
					username: 'privateuser',
					name: 'Private User',
					isPublicProfile: false,
					_count: { events: 1, followers: 10, following: 8 },
				},
				events: mockEvents,
			},
			isLoading: false,
			error: null,
		})

		mockUseFollowStatus.mockReturnValue({
			data: { isFollowing: true, isAccepted: true },
		})

		render(<UserProfilePage />, { wrapper })

		await waitFor(() => {
			expect(screen.getByText(/Events \(1\)/)).toBeInTheDocument()
		})

		expect(
			screen.queryByText('This profile is private. Follow to see their events.')
		).not.toBeInTheDocument()
	})

	it('should show follow button in private message when authenticated', async () => {
		mockUseUserProfile.mockReturnValue({
			data: {
				user: {
					id: 'user2',
					username: 'privateuser',
					name: 'Private User',
					isPublicProfile: false,
					_count: { events: 5, followers: 10, following: 8 },
				},
				events: [],
			},
			isLoading: false,
			error: null,
		})

		render(<UserProfilePage />, { wrapper })

		await waitFor(() => {
			const privateMessage = screen.getByText(
				'This profile is private. Follow to see their events.'
			)
			expect(privateMessage).toBeInTheDocument()

			// Find the follow button within the private message container
			const privateMessageContainer = privateMessage.closest('div')
			const followButton = privateMessageContainer?.querySelector('button')
			expect(followButton).toBeInTheDocument()
			expect(followButton).toHaveTextContent(/follow/i)
		})
	})

	it('should not show follow button in private message when unauthenticated', async () => {
		mockUseAuth.mockReturnValue({
			user: null,
			logout: mockLogout,
		})

		mockUseUserProfile.mockReturnValue({
			data: {
				user: {
					id: 'user2',
					username: 'privateuser',
					name: 'Private User',
					isPublicProfile: false,
					_count: { events: 5, followers: 10, following: 8 },
				},
				events: [],
			},
			isLoading: false,
			error: null,
		})

		render(<UserProfilePage />, { wrapper })

		await waitFor(() => {
			expect(
				screen.getByText('This profile is private. Follow to see their events.')
			).toBeInTheDocument()
		})

		expect(screen.queryByRole('button', { name: /follow/i })).not.toBeInTheDocument()
	})

	it('should show loading state', () => {
		mockUseUserProfile.mockReturnValue({
			data: undefined,
			isLoading: true,
			error: null,
		})

		render(<UserProfilePage />, { wrapper })

		// Spinner should be visible (checking for spinner class)
		const spinner = document.querySelector('.animate-spin')
		expect(spinner).toBeTruthy()
	})

	it('should show error message when profile fails to load', async () => {
		mockUseUserProfile.mockReturnValue({
			data: undefined,
			isLoading: false,
			error: new Error('Failed to load profile'),
		})

		render(<UserProfilePage />, { wrapper })

		await waitFor(() => {
			expect(screen.getByText('Failed to load profile')).toBeInTheDocument()
		})
	})
})
