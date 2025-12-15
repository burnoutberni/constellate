import type { Meta, StoryObj } from '@storybook/react'
import { CalendarView } from './CalendarView'
import type { Event } from '@/types'

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
		user: { id: 'user1', username: 'johndoe' },
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	},
	{
		id: '2',
		title: 'Lunch Break',
		startTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(),
		endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000).toISOString(),
		visibility: 'PUBLIC',
		user: { id: 'user1', username: 'johndoe' },
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	},
]

export const Default: Story = {
	args: {
		view: 'month',
		currentDate: new Date(),
		events: mockEvents,
		loading: false,
		onEventClick: (event, position) => console.log('Click', event, position),
	},
}

export const MonthView: Story = {
	args: {
		view: 'month',
		currentDate: new Date(),
		events: mockEvents,
		loading: false,
		onEventClick: (event, position) => console.log('Click', event, position),
	},
}

export const WeekView: Story = {
	args: {
		view: 'week',
		currentDate: new Date(),
		events: mockEvents,
		loading: false,
		onEventClick: (event, position) => console.log('Click', event, position),
	},
}

export const DayView: Story = {
	args: {
		view: 'day',
		currentDate: new Date(),
		events: mockEvents,
		loading: false,
		onEventClick: (event, position) => console.log('Click', event, position),
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
		onEventClick: (event, position) => console.log('Click', event, position),
	},
}
