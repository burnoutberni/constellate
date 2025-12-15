import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import { queryKeys } from '@/hooks/queries'
import type { Event } from '@/types'

import { TrendingEvents } from './TrendingEvents'

// Mock trending events data
const mockTrendingEvents: Event[] = [
	{
		id: '1',
		title: 'Summer Music Festival',
		summary: 'A fantastic outdoor music festival',
		startTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
		endTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(),
		location: 'Central Park, New York',
		timezone: 'America/New_York',
		visibility: 'PUBLIC',
		user: {
			id: 'user1',
			username: 'johndoe',
			name: 'John Doe',
			isRemote: false,
		},
		tags: [
			{ id: '1', tag: 'music' },
			{ id: '2', tag: 'festival' },
		],
		_count: {
			likes: 42,
			comments: 18,
			attendance: 156,
		},
	},
	{
		id: '2',
		title: 'Tech Meetup',
		summary: 'Monthly tech meetup for developers',
		startTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
		endTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
		location: 'Tech Hub, San Francisco',
		timezone: 'America/Los_Angeles',
		visibility: 'PUBLIC',
		user: {
			id: 'user2',
			username: 'janedoe',
			name: 'Jane Doe',
			isRemote: false,
		},
		tags: [
			{ id: '3', tag: 'tech' },
			{ id: '4', tag: 'meetup' },
		],
		_count: {
			likes: 28,
			comments: 12,
			attendance: 89,
		},
	},
	{
		id: '3',
		title: 'Art Exhibition Opening',
		summary: 'Contemporary art exhibition',
		startTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
		endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(),
		location: 'Gallery District, Los Angeles',
		timezone: 'America/Los_Angeles',
		visibility: 'PUBLIC',
		user: {
			id: 'user3',
			username: 'artlover',
			name: 'Art Lover',
			isRemote: false,
		},
		tags: [
			{ id: '5', tag: 'art' },
			{ id: '6', tag: 'exhibition' },
		],
		_count: {
			likes: 35,
			comments: 8,
			attendance: 67,
		},
	},
]

const queryClient = new QueryClient({
	defaultOptions: {
		queries: { retry: false },
		mutations: { retry: false },
	},
})

// Set mock data for trending events queries
queryClient.setQueryData(queryKeys.events.trending(5, 7), {
	events: mockTrendingEvents,
	windowDays: 7,
	generatedAt: new Date().toISOString(),
})

queryClient.setQueryData(queryKeys.events.trending(10, 14), {
	events: mockTrendingEvents,
	windowDays: 14,
	generatedAt: new Date().toISOString(),
})

const meta = {
	title: 'Components/TrendingEvents',
	component: TrendingEvents,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
	decorators: [
		(Story) => (
			<QueryClientProvider client={queryClient}>
				<MemoryRouter>
					<Story />
				</MemoryRouter>
			</QueryClientProvider>
		),
	],
} satisfies Meta<typeof TrendingEvents>

export default meta
type Story = StoryObj<typeof TrendingEvents>

export const Default: Story = {
	args: {
		limit: 5,
		windowDays: 7,
	},
}

export const CustomLimit: Story = {
	args: {
		limit: 10,
		windowDays: 14,
	},
}
