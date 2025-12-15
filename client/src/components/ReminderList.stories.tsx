import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ReminderList } from './ReminderList'
import type { ReminderWithEvent } from '@/types'

const queryClient = new QueryClient({
	defaultOptions: {
		queries: { retry: false },
		mutations: { retry: false },
	},
})

const meta = {
	title: 'Components/ReminderList',
	component: ReminderList,
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
} satisfies Meta<typeof ReminderList>

export default meta
type Story = StoryObj<typeof ReminderList>

const mockReminders: ReminderWithEvent[] = [
	{
		id: '1',
		eventId: 'event1',
		userId: 'user1',
		minutesBeforeStart: 30,
		status: 'PENDING',
		remindAt: new Date(Date.now() + 24 * 60 * 60 * 1000 - 30 * 60 * 1000).toISOString(),
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		event: {
			id: 'event1',
			title: 'Summer Music Festival',
			startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
			timezone: 'America/New_York',
			user: {
				id: 'user1',
				username: 'johndoe',
				name: 'John Doe',
				isRemote: false,
			},
		},
	},
	{
		id: '2',
		eventId: 'event2',
		userId: 'user1',
		minutesBeforeStart: 60,
		status: 'PENDING',
		remindAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 - 60 * 60 * 1000).toISOString(),
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		event: {
			id: 'event2',
			title: 'Team Meeting',
			startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
			timezone: 'America/New_York',
			user: {
				id: 'user1',
				username: 'johndoe',
				name: 'John Doe',
				isRemote: false,
			},
		},
	},
	{
		id: '3',
		eventId: 'event3',
		userId: 'user1',
		minutesBeforeStart: 1440,
		status: 'SENT',
		remindAt: new Date(Date.now() - 24 * 60 * 60 * 1000 - 1440 * 60 * 1000).toISOString(),
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		deliveredAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
		event: {
			id: 'event3',
			title: 'Past Event',
			startTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
			timezone: 'America/New_York',
			user: {
				id: 'user1',
				username: 'johndoe',
				name: 'John Doe',
				isRemote: false,
			},
		},
	},
]

export const Default: Story = {
	args: {
		reminders: mockReminders,
	},
}

export const Empty: Story = {
	args: {
		reminders: [],
	},
}

export const WithDelete: Story = {
	args: {
		reminders: mockReminders,
		onDelete: (reminderId, eventId) => console.log('Delete', reminderId, eventId),
	},
}
