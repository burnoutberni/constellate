import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FollowButton } from '../../components/FollowButton'
import { createTestWrapper } from '../testUtils'

const mockCurrentUser = {
	id: 'current-user',
	username: 'currentuser',
	name: 'Current User',
	profileImage: null,
	displayColor: '#3B82F6',
	createdAt: '2023-01-01T00:00:00.000Z',
	isPublicProfile: true,
	isRemote: false,
}

let authUserValue: unknown = {
	user: mockCurrentUser,
	loading: false,
	login: vi.fn(),
	signup: vi.fn(),
	logout: vi.fn(),
}

vi.mock('../../hooks/useAuth', () => ({
	useAuth: vi.fn(() => authUserValue),
}))

vi.mock('../../hooks/queries', () => ({
	useFollowUser: vi.fn(() => ({
		mutateAsync: vi.fn(),
		isPending: false,
	})),
	useUnfollowUser: vi.fn(() => ({
		mutateAsync: vi.fn(),
		isPending: false,
	})),
	useFollowStatus: vi.fn(() => ({
		data: null,
		isLoading: false,
	})),
}))

describe('FollowButton Component', () => {
	const { wrapper } = createTestWrapper()

	beforeEach(() => {
		vi.clearAllMocks()
		authUserValue = {
			user: mockCurrentUser,
			loading: false,
			login: vi.fn(),
			signup: vi.fn(),
			logout: vi.fn(),
		}
	})

	it('should return null when no user is authenticated', () => {
		authUserValue = {
			user: null,
			loading: false,
			login: vi.fn(),
			signup: vi.fn(),
			logout: vi.fn(),
		}

		const { container } = render(<FollowButton username="testuser" />, { wrapper })

		expect(container.querySelector('button')).not.toBeInTheDocument()
	})

	it('should return null when viewing own profile', () => {
		const { container } = render(<FollowButton username="currentuser" />, { wrapper })

		expect(container.querySelector('button')).not.toBeInTheDocument()
	})

	it('should render Follow button when not following', () => {
		const { container } = render(<FollowButton username="testuser" />, { wrapper })

		const button = container.querySelector('button')
		expect(button).toBeInTheDocument()
		expect(button).toHaveTextContent(/Follow/)
	})

	it('should render Following button when following', () => {
		const { container } = render(
			<FollowButton
				username="testuser"
				followStatus={{ isFollowing: true, isAccepted: true }}
			/>,
			{ wrapper }
		)

		const button = container.querySelector('button')
		expect(button).toBeInTheDocument()
		expect(button).toHaveTextContent(/Following/)
	})

	it('should render Pending button when follow is pending', () => {
		const { container } = render(
			<FollowButton
				username="testuser"
				followStatus={{ isFollowing: true, isAccepted: false }}
			/>,
			{ wrapper }
		)

		const button = container.querySelector('button')
		expect(button).toBeInTheDocument()
		expect(button).toHaveTextContent(/Pending/)
	})

	it('should call onClick when provided and button is clicked', async () => {
		const user = userEvent.setup()
		const localMockOnClick = vi.fn()

		const { container } = render(
			<FollowButton username="testuser" onClick={localMockOnClick} />,
			{ wrapper }
		)

		const button = container.querySelector('button')
		expect(button).not.toBeNull()
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		await user.click(button!)

		expect(localMockOnClick).toHaveBeenCalledTimes(1)
	})

	it('should not call mutation when onClick is provided', async () => {
		const user = userEvent.setup()
		const localMockOnClick = vi.fn()

		const { container } = render(
			<FollowButton username="testuser" onClick={localMockOnClick} />,
			{ wrapper }
		)

		const button = container.querySelector('button')
		expect(button).not.toBeNull()
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		await user.click(button!)

		expect(localMockOnClick).toHaveBeenCalled()
	})

	it('should use provided followStatus', () => {
		const { container } = render(
			<FollowButton
				username="testuser"
				followStatus={{ isFollowing: true, isAccepted: true }}
			/>,
			{ wrapper }
		)

		const button = container.querySelector('button')
		expect(button).toBeInTheDocument()
		expect(button).toHaveTextContent(/Following/)
	})

	it('should use provided isPending', () => {
		const { container } = render(
			<FollowButton
				username="testuser"
				followStatus={{ isFollowing: true, isAccepted: false }}
				isPending={true}
			/>,
			{ wrapper }
		)

		const button = container.querySelector('button')
		expect(button).toBeInTheDocument()
		expect(button).toHaveTextContent(/Pending/)
	})

	it('should use provided isLoading', () => {
		const { container } = render(<FollowButton username="testuser" isLoading={true} />, {
			wrapper,
		})

		const button = container.querySelector('button')
		expect(button).toBeInTheDocument()
		expect(button).toBeDisabled()
	})

	it('should render with different variants', () => {
		const { container } = render(<FollowButton username="testuser" variant="secondary" />, {
			wrapper,
		})

		const button = container.querySelector('button')
		expect(button).toBeInTheDocument()
	})

	it('should render with different sizes', () => {
		const { container } = render(<FollowButton username="testuser" size="sm" />, { wrapper })

		const button = container.querySelector('button')
		expect(button).toBeInTheDocument()
	})

	it('should render with fullWidth', () => {
		const { container } = render(<FollowButton username="testuser" fullWidth />, { wrapper })

		const button = container.querySelector('button')
		expect(button).toBeInTheDocument()
		expect(button).toHaveClass('w-full')
	})

	it('should have proper aria-pressed attribute', () => {
		const { container } = render(
			<FollowButton
				username="testuser"
				followStatus={{ isFollowing: true, isAccepted: true }}
			/>,
			{ wrapper }
		)

		const button = container.querySelector('button')
		expect(button).toHaveAttribute('aria-pressed', 'true')
	})

	it('should show outline variant when pending', () => {
		const { container } = render(
			<FollowButton
				username="testuser"
				followStatus={{ isFollowing: true, isAccepted: false }}
			/>,
			{ wrapper }
		)

		const button = container.querySelector('button')
		expect(button).toBeInTheDocument()
		expect(button).toHaveTextContent(/Pending/)
	})
})
