import type { Meta, StoryObj } from '@storybook/react'
import { MemoryRouter } from 'react-router-dom'

import type { Event } from '@/types'

import { UserEventList } from './UserEventList'

const meta = {
	title: 'Components/UserEventList',
	component: UserEventList,
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
} satisfies Meta<typeof UserEventList>

export default meta
type Story = StoryObj<typeof UserEventList>

const mockEvents: Event[] = [
	{
		id: '1',
		title: 'Summer Music Festival',
		summary: 'A fantastic outdoor music festival',
		startTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
		endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(),
		location: 'Central Park, New York',
		visibility: 'PUBLIC',
		timezone: 'America/New_York',
		tags: [],
		user: {
			id: 'user1',
			username: 'johndoe',
			name: 'John Doe',
			isRemote: false,
		},
		_count: {
			attendance: 42,
			likes: 128,
			comments: 15,
		},
	},
	{
		id: '2',
		title: 'Tech Conference 2024',
		summary: 'Annual technology conference',
		startTime: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
		endTime: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000).toISOString(),
		location: 'Convention Center',
		headerImage: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbaf53?w=800',
		visibility: 'PUBLIC',
		timezone: 'America/New_York',
		tags: [],
		user: {
			id: 'user1',
			username: 'johndoe',
			name: 'John Doe',
			isRemote: false,
		},
		_count: {
			attendance: 15,
			likes: 45,
			comments: 8,
		},
	},
]

export const Default: Story = {
	args: {
		events: mockEvents,
		onEventClick: (_id) => {
			// Event click handler
		},
	},
}

export const Empty: Story = {
	args: {
		events: [],
		onEventClick: (_id) => {
			// Event click handler
		},
	},
}

export const SingleEvent: Story = {
	args: {
		events: [mockEvents[0]],
		onEventClick: (_id) => {
			// Event click handler
		},
	},
}
