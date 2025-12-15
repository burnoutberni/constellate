import type { Meta, StoryObj } from '@storybook/react'

import type { Event } from '@/types'

import { CalendarView } from './CalendarView'

const meta = {
	title: 'Components/CalendarView',
	component: CalendarView,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
	args: {
		view: 'month',
		currentDate: new Date(),
		events: [],
		loading: false,
		onEventClick: () => {},
	},
	argTypes: {
		onEventClick: {
			control: false,
		},
		onEventHover: {
			control: false,
		},
	},
} satisfies Meta<typeof CalendarView>

export default meta
type Story = StoryObj<typeof CalendarView>

const mockEvents: Event[] = [
	{
		id: '1',
		title: 'Morning Meeting',
		startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
		endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
		visibility: 'PUBLIC',
		timezone: 'America/New_York',
		tags: [],
		user: { id: 'user1', username: 'johndoe', isRemote: false },
	},
	{
		id: '2',
		title: 'Lunch Break',
		startTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(),
		endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000).toISOString(),
		visibility: 'PUBLIC',
		timezone: 'America/New_York',
		tags: [],
		user: { id: 'user1', username: 'johndoe', isRemote: false },
	},
]

export const Default: Story = {
	args: {
		view: 'month',
		currentDate: new Date(),
		events: mockEvents,
		loading: false,
		onEventClick: (_event, _position) => {
			// Event click handler
		},
	},
}

export const MonthView: Story = {
	args: {
		view: 'month',
		currentDate: new Date(),
		events: mockEvents,
		loading: false,
		onEventClick: (_event, _position) => {
			// Event click handler
		},
	},
}

export const WeekView: Story = {
	args: {
		view: 'week',
		currentDate: new Date(),
		events: mockEvents,
		loading: false,
		onEventClick: (_event, _position) => {
			// Event click handler
		},
	},
}

export const DayView: Story = {
	args: {
		view: 'day',
		currentDate: new Date(),
		events: mockEvents,
		loading: false,
		onEventClick: (_event, _position) => {
			// Event click handler
		},
	},
}

export const Loading: Story = {
	args: {
		view: 'month',
		currentDate: new Date(),
		events: [],
		loading: true,
	},
}

export const Empty: Story = {
	args: {
		view: 'month',
		currentDate: new Date(),
		events: [],
		loading: false,
	},
}

export const WithAttendingEvents: Story = {
	args: {
		view: 'month',
		currentDate: new Date(),
		events: mockEvents,
		loading: false,
		userAttendingEventIds: new Set(['1']),
		onEventClick: (_event, _position) => {
			// Event click handler
		},
	},
}
