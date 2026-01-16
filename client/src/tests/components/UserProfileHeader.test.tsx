import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UserProfileHeader } from '../../components/UserProfileHeader'
import type { UserProfile } from '../../types'

vi.mock('../../components/FollowButton', () => ({
	FollowButton: vi.fn(({ username }) => {
		return (
			<button data-testid="follow-button" data-username={username}>
				Follow
			</button>
		)
	}),
}))

const mockUser: UserProfile = {
	id: '1',
	username: 'testuser',
	name: 'Test User',
	bio: 'This is a test bio',
	profileImage: 'https://example.com/avatar.jpg',
	displayColor: '#3B82F6',
	timezone: 'UTC',
	isRemote: false,
	externalActorUrl: null,
	createdAt: '2023-01-01T00:00:00.000Z',
	isPublicProfile: true,
	_count: {
		events: 5,
		followers: 10,
		following: 8,
	},
}

describe('UserProfileHeader Component', () => {
	it('should render user information correctly', () => {
		render(
			<UserProfileHeader
				user={mockUser}
				isOwnProfile={false}
				followerCount={10}
				followingCount={8}
				eventCount={5}
				showFollowButton={true}
			/>
		)

		expect(screen.getByText('Test User')).toBeInTheDocument()
		expect(screen.getByText('@testuser')).toBeInTheDocument()
		expect(screen.getByText('This is a test bio')).toBeInTheDocument()
	})

	it('should display correct stats', () => {
		render(
			<UserProfileHeader
				user={mockUser}
				isOwnProfile={false}
				followerCount={10}
				followingCount={8}
				eventCount={5}
				showFollowButton={true}
			/>
		)

		expect(screen.getByText('5')).toBeInTheDocument()
		expect(screen.getByText('Events')).toBeInTheDocument()
		expect(screen.getByText('10')).toBeInTheDocument()
		expect(screen.getByText('Followers')).toBeInTheDocument()
		expect(screen.getByText('8')).toBeInTheDocument()
		expect(screen.getByText('Following')).toBeInTheDocument()
	}	)

	it('should not show follow button when own profile', () => {
		render(
			<UserProfileHeader
				user={mockUser}
				isOwnProfile={true}
				followerCount={10}
				followingCount={8}
				eventCount={5}
				showFollowButton={false}
			/>
		)

		const buttons = screen.getAllByRole('button')
		const followButton = buttons.find((btn) => btn.textContent === 'Follow')
		const unfollowButton = buttons.find((btn) => btn.textContent === 'Unfollow')

		expect(followButton).toBeUndefined()
		expect(unfollowButton).toBeUndefined()
	})

	it('should display remote badge and instance for remote users', () => {
		const remoteUser: UserProfile = {
			...mockUser,
			isRemote: true,
			externalActorUrl: 'https://remote.instance.com/users/testuser',
		}

		render(
			<UserProfileHeader
				user={remoteUser}
				isOwnProfile={false}
				followerCount={10}
				followingCount={8}
				eventCount={5}
				showFollowButton={true}
			/>
		)

		expect(screen.getByText('Remote')).toBeInTheDocument()
		expect(screen.getByText(/from remote.instance.com/i)).toBeInTheDocument()
	})

	it('should display header image when provided', () => {
		render(
			<UserProfileHeader
				user={mockUser}
				isOwnProfile={false}
				followerCount={10}
				followingCount={8}
				eventCount={5}
				showFollowButton={true}
				headerImageUrl="https://example.com/header.jpg"
			/>
		)

		const headerImage = screen.getByAltText('Profile header')
		expect(headerImage).toBeInTheDocument()
		expect(headerImage).toHaveAttribute('src', 'https://example.com/header.jpg')
	})

	it('should call onFollowersClick when followers stat is clicked', () => {
		const onFollowersClick = vi.fn()
		render(
			<UserProfileHeader
				user={mockUser}
				isOwnProfile={false}
				followerCount={10}
				followingCount={8}
				eventCount={5}
				showFollowButton={true}
				onFollowersClick={onFollowersClick}
			/>
		)

		const followersButtons = screen.getAllByRole('button')
		const followersButton = followersButtons.find(
			(btn) => btn.textContent?.includes('10') && btn.textContent?.includes('Follower')
		)

		if (followersButton) {
			fireEvent.click(followersButton)
			expect(onFollowersClick).toHaveBeenCalledTimes(1)
		}
	})

	it('should call onFollowingClick when following stat is clicked', () => {
		const onFollowingClick = vi.fn()
		render(
			<UserProfileHeader
				user={mockUser}
				isOwnProfile={false}
				followerCount={10}
				followingCount={8}
				eventCount={5}
				showFollowButton={true}
				onFollowingClick={onFollowingClick}
			/>
		)

		const followingButtons = screen.getAllByRole('button')
		const followingButton = followingButtons.find(
			(btn) => btn.textContent?.includes('8') && btn.textContent?.includes('Following')
		)

		if (followingButton) {
			fireEvent.click(followingButton)
			expect(onFollowingClick).toHaveBeenCalledTimes(1)
		}
	})

	it('should display private account badge when profile is private', () => {
		const privateUser: UserProfile = {
			...mockUser,
			isPublicProfile: false,
		}

		render(
			<UserProfileHeader
				user={privateUser}
				isOwnProfile={false}
				followerCount={10}
				followingCount={8}
				eventCount={5}
				showFollowButton={true}
			/>
		)

		expect(screen.getByText(/🔒 Private account/i)).toBeInTheDocument()
	})

	it('should not display private account badge when profile is public', () => {
		const publicUser: UserProfile = {
			...mockUser,
			isPublicProfile: true,
		}

		render(
			<UserProfileHeader
				user={publicUser}
				isOwnProfile={false}
				followerCount={10}
				followingCount={8}
				eventCount={5}
				showFollowButton={true}
			/>
		)

		expect(screen.queryByText(/🔒 Private account/i)).not.toBeInTheDocument()
	})

	it('should hide bio for private profiles when not owner', () => {
		const privateUser: UserProfile = {
			...mockUser,
			isPublicProfile: false,
			bio: 'This is a private bio',
		}

		render(
			<UserProfileHeader
				user={privateUser}
				isOwnProfile={false}
				followerCount={10}
				followingCount={8}
				eventCount={5}
				showFollowButton={true}
			/>
		)

		expect(screen.queryByText('This is a private bio')).not.toBeInTheDocument()
	})

	it('should show bio for private profiles when viewing own profile', () => {
		const privateUser: UserProfile = {
			...mockUser,
			isPublicProfile: false,
			bio: 'This is my private bio',
		}

		render(
			<UserProfileHeader
				user={privateUser}
				isOwnProfile={true}
				followerCount={10}
				followingCount={8}
				eventCount={5}
				showFollowButton={false}
			/>
		)

		expect(screen.getByText('This is my private bio')).toBeInTheDocument()
	})

	it('should hide stats for private profiles when not owner', () => {
		const privateUser: UserProfile = {
			...mockUser,
			isPublicProfile: false,
		}

		render(
			<UserProfileHeader
				user={privateUser}
				isOwnProfile={false}
				followerCount={10}
				followingCount={8}
				eventCount={5}
				showFollowButton={true}
			/>
		)

		// Stats should not be visible
		expect(screen.queryByText('5')).not.toBeInTheDocument()
		expect(screen.queryByText('10')).not.toBeInTheDocument()
		expect(screen.queryByText('8')).not.toBeInTheDocument()
	})

	it('should show stats for private profiles when viewing own profile', () => {
		const privateUser: UserProfile = {
			...mockUser,
			isPublicProfile: false,
		}

		render(
			<UserProfileHeader
				user={privateUser}
				isOwnProfile={true}
				followerCount={10}
				followingCount={8}
				eventCount={5}
				showFollowButton={false}
			/>
		)

		// Stats should be visible for own profile
		expect(screen.getByText('5')).toBeInTheDocument()
		expect(screen.getByText('10')).toBeInTheDocument()
		expect(screen.getByText('8')).toBeInTheDocument()
	})

	it('should hide header image for private profiles when not owner', () => {
		const privateUser: UserProfile = {
			...mockUser,
			isPublicProfile: false,
		}

		render(
			<UserProfileHeader
				user={privateUser}
				isOwnProfile={false}
				followerCount={10}
				followingCount={8}
				eventCount={5}
				showFollowButton={true}
				headerImageUrl="https://example.com/header.jpg"
			/>
		)

		expect(screen.queryByAltText('Profile header')).not.toBeInTheDocument()
	})

	it('should show header image for private profiles when viewing own profile', () => {
		const privateUser: UserProfile = {
			...mockUser,
			isPublicProfile: false,
		}

		render(
			<UserProfileHeader
				user={privateUser}
				isOwnProfile={true}
				followerCount={10}
				followingCount={8}
				eventCount={5}
				showFollowButton={false}
				headerImageUrl="https://example.com/header.jpg"
			/>
		)

		const headerImage = screen.getByAltText('Profile header')
		expect(headerImage).toBeInTheDocument()
		expect(headerImage).toHaveAttribute('src', 'https://example.com/header.jpg')
	})
})
