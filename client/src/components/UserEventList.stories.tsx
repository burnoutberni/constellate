import type { Meta, StoryObj } from '@storybook/react'
import { MemoryRouter } from 'react-router-dom'
import { UserEventList } from './UserEventList'
import type { Event } from '@/types'

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
		user: {
			id: 'user1',
			username: 'johndoe',
			name: 'John Doe',
		},
		_count: {
			attendance: 42,
			likes: 128,
			comments: 15,
		},
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
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
		user: {
			id: 'user1',
			username: 'johndoe',
			name: 'John Doe',
		},
		_count: {
			attendance: 15,
			likes: 45,
			comments: 8,
		},
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	},
]

export const Default: Story = {
	args: {
		events: mockEvents,
		onEventClick: (id) => console.log('Click event', id),
	},
}

export const Empty: Story = {
	args: {
		events: [],
		onEventClick: (id) => console.log('Click event', id),
	},
}

export const SingleEvent: Story = {
	args: {
		events: [mockEvents[0]],
		onEventClick: (id) => console.log('Click event', id),
	},
}
