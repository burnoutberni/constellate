import type { Meta, StoryObj } from '@storybook/react'
import { MemoryRouter } from 'react-router-dom'
import { UserProfileHeader } from './UserProfileHeader'
import type { UserProfile } from '@/types'

const meta = {
	title: 'Components/UserProfileHeader',
	component: UserProfileHeader,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
	decorators: [
		(Story) => (
			<MemoryRouter>
				<Story />
			</MemoryRouter>
		),
	],
} satisfies Meta<typeof UserProfileHeader>

export default meta
type Story = StoryObj<typeof UserProfileHeader>

const mockUser: UserProfile = {
	id: 'user1',
	username: 'johndoe',
	name: 'John Doe',
	bio: 'Event organizer and music enthusiast',
	profileImage: 'https://i.pravatar.cc/150?img=12',
	displayColor: null,
	isRemote: false,
	externalActorUrl: null,
	createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
}

export const Default: Story = {
	args: {
		user: mockUser,
		isOwnProfile: false,
		followerCount: 42,
		followingCount: 15,
		eventCount: 8,
		showFollowButton: true,
		onFollowClick: () => console.log('Follow'),
		onUnfollowClick: () => console.log('Unfollow'),
		onFollowersClick: () => console.log('Followers'),
		onFollowingClick: () => console.log('Following'),
	},
}

export const OwnProfile: Story = {
	args: {
		user: mockUser,
		isOwnProfile: true,
		followerCount: 42,
		followingCount: 15,
		eventCount: 8,
		showFollowButton: false,
		onFollowersClick: () => console.log('Followers'),
		onFollowingClick: () => console.log('Following'),
	},
}

export const Following: Story = {
	args: {
		user: mockUser,
		isOwnProfile: false,
		isFollowing: true,
		followerCount: 42,
		followingCount: 15,
		eventCount: 8,
		showFollowButton: true,
		onUnfollowClick: () => console.log('Unfollow'),
	},
}

export const FollowPending: Story = {
	args: {
		user: mockUser,
		isOwnProfile: false,
		isFollowPending: true,
		followerCount: 42,
		followingCount: 15,
		eventCount: 8,
		showFollowButton: true,
	},
}

export const WithHeaderImage: Story = {
	args: {
		user: mockUser,
		isOwnProfile: false,
		followerCount: 42,
		followingCount: 15,
		eventCount: 8,
		showFollowButton: true,
		headerImageUrl: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbaf53?w=1200',
		onFollowClick: () => console.log('Follow'),
	},
}

export const RemoteUser: Story = {
	args: {
		user: {
			...mockUser,
			isRemote: true,
			externalActorUrl: 'https://example.com/users/johndoe',
		},
		isOwnProfile: false,
		followerCount: 42,
		followingCount: 15,
		eventCount: 8,
		showFollowButton: true,
		onFollowClick: () => console.log('Follow'),
	},
}

export const NoBio: Story = {
	args: {
		user: {
			...mockUser,
			bio: null,
		},
		isOwnProfile: false,
		followerCount: 42,
		followingCount: 15,
		eventCount: 8,
		showFollowButton: true,
		onFollowClick: () => console.log('Follow'),
	},
}
