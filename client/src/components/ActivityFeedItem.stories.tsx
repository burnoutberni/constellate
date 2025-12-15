import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import type { Activity } from '@/types'
import { ActivityFeedItem } from './ActivityFeedItem'

const queryClient = new QueryClient({
	defaultOptions: {
		queries: { retry: false },
		mutations: { retry: false },
	},
})

const baseActivity: Activity = {
	id: '1',
	type: 'like',
	createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
	user: {
		id: 'user1',
		username: 'alice',
		name: 'Alice Smith',
		profileImage: 'https://i.pravatar.cc/150?img=1',
		isRemote: false,
	},
	event: {
		id: 'event1',
		title: 'Summer Music Festival',
		summary: 'A fantastic outdoor music festival',
		startTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
		endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(),
		location: 'Central Park, New York',
		timezone: 'America/New_York',
		visibility: 'PUBLIC',
		user: {
			id: 'user2',
			username: 'johndoe',
			name: 'John Doe',
			isRemote: false,
		},
		tags: [
			{ id: '1', tag: 'music' },
			{ id: '2', tag: 'festival' },
		],
	},
}

const meta = {
	title: 'Components/ActivityFeedItem',
	component: ActivityFeedItem,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
	args: {
		activity: baseActivity,
	},
	decorators: [
		(Story) => (
			<AuthProvider>
				<QueryClientProvider client={queryClient}>
					<MemoryRouter>
						<Story />
					</MemoryRouter>
				</QueryClientProvider>
			</AuthProvider>
		),
	],
} satisfies Meta<typeof ActivityFeedItem>

export default meta
type Story = StoryObj<typeof ActivityFeedItem>

export const Default: Story = {
	args: {
		activity: baseActivity,
	},
}

export const Like: Story = {
	args: {
		activity: baseActivity,
	},
}

export const RSVP: Story = {
	args: {
		activity: {
			...baseActivity,
			type: 'rsvp',
			data: { status: 'attending' },
		},
	},
}

export const Comment: Story = {
	args: {
		activity: {
			...baseActivity,
			type: 'comment',
			data: {
				commentContent: "This looks amazing! Can't wait to attend.",
			},
		},
	},
}

export const EventCreated: Story = {
	args: {
		activity: {
			...baseActivity,
			type: 'event_created',
		},
	},
}

export const EventShared: Story = {
	args: {
		activity: {
			...baseActivity,
			type: 'event_shared',
			sharedEvent: {
				id: 'event2',
				title: 'Tech Conference',
				summary: 'Annual technology conference',
				startTime: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
				endTime: new Date(
					Date.now() + 14 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000
				).toISOString(),
				location: 'Convention Center, San Francisco',
				timezone: 'America/Los_Angeles',
				visibility: 'PUBLIC',
				user: {
					id: 'user3',
					username: 'janedoe',
					name: 'Jane Doe',
					isRemote: false,
				},
				tags: [
					{ id: '3', tag: 'tech' },
					{ id: '4', tag: 'conference' },
				],
			},
		},
	},
}
