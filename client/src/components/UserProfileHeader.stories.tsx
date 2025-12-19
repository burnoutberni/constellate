import type { Meta, StoryObj } from '@storybook/react'
import { MemoryRouter } from 'react-router-dom'

import type { UserProfile } from '@/types'

import { UserProfileHeader } from './UserProfileHeader'

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
	displayColor: '#3b82f6',
	isRemote: false,
	externalActorUrl: null,
	createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
	timezone: 'America/New_York',
	isPublicProfile: true,
}

export const Default: Story = {
	args: {
		user: mockUser,
		isOwnProfile: false,
		followerCount: 42,
		followingCount: 15,
		eventCount: 8,
		showFollowButton: true,
		onFollowClick: () => {
			// Follow handler
		},
		onUnfollowClick: () => {
			// Unfollow handler
		},
		onFollowersClick: () => {
			// Followers handler
		},
		onFollowingClick: () => {
			// Following handler
		},
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
		onFollowersClick: () => {
			// Followers handler
		},
		onFollowingClick: () => {
			// Following handler
		},
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
		onUnfollowClick: () => {
			// Unfollow handler
		},
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
		onFollowClick: () => {
			// Follow handler
		},
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
		onFollowClick: () => {
			// Follow handler
		},
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
		onFollowClick: () => {
			// Follow handler
		},
	},
}
