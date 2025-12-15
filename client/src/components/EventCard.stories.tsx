import type { Meta, StoryObj } from '@storybook/react'
import { MemoryRouter } from 'react-router-dom'

import type { Event } from '@/types'

import { EventCard } from './EventCard'

const mockEvent: Event = {
	id: '1',
	title: 'Summer Music Festival',
	summary: 'A fantastic outdoor music festival featuring local and international artists',
	startTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
	endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(),
	location: 'Central Park, New York',
	url: 'https://example.com/festival',
	user: {
		id: 'user1',
		username: 'johndoe',
		name: 'John Doe',
		profileImage: 'https://i.pravatar.cc/150?img=12',
		isRemote: false,
	},
	timezone: 'America/New_York',
	tags: [],
	_count: {
		attendance: 42,
		likes: 128,
		comments: 15,
	},
}

const meta = {
	title: 'Components/EventCard',
	component: EventCard,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
	args: {
		event: mockEvent,
		variant: 'full',
		isAuthenticated: true,
	},
	decorators: [
		(Story) => (
			<MemoryRouter>
				<Story />
			</MemoryRouter>
		),
	],
} satisfies Meta<typeof EventCard>

export default meta
type Story = StoryObj<typeof EventCard>

const mockEventWithImage: Event = {
	...mockEvent,
	headerImage: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbaf53?w=800',
}

const mockCompactEvent: Event = {
	...mockEvent,
	title: 'Quick Meetup',
	summary: 'Short event description',
}

export const Default: Story = {
	args: {
		event: mockEvent,
		variant: 'full',
		isAuthenticated: true,
	},
}

export const Full: Story = {
	args: {
		event: mockEvent,
		variant: 'full',
		isAuthenticated: true,
	},
}

export const FullWithImage: Story = {
	args: {
		event: mockEventWithImage,
		variant: 'full',
		isAuthenticated: true,
	},
}

export const Compact: Story = {
	args: {
		event: mockCompactEvent,
		variant: 'compact',
		isAuthenticated: true,
	},
}

export const WithoutLocation: Story = {
	args: {
		event: {
			...mockEvent,
			location: undefined,
		},
		variant: 'full',
		isAuthenticated: true,
	},
}

export const WithoutUser: Story = {
	args: {
		event: {
			...mockEvent,
			user: undefined,
		},
		variant: 'full',
		isAuthenticated: false,
	},
}

export const NoAttendance: Story = {
	args: {
		event: {
			...mockEvent,
			_count: {
				attendance: 0,
				likes: 5,
				comments: 2,
			},
		},
		variant: 'full',
		isAuthenticated: true,
	},
}

export const Grid: Story = {
	render: () => (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			<EventCard event={mockEvent} variant="full" isAuthenticated={true} />
			<EventCard event={mockEventWithImage} variant="full" isAuthenticated={true} />
			<EventCard event={mockCompactEvent} variant="compact" isAuthenticated={true} />
		</div>
	),
	parameters: {
		layout: 'padded',
	},
}
