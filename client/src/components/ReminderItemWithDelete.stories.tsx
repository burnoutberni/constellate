import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import type { ReminderWithEvent } from '@/types'

import { ReminderItemWithDelete } from './ReminderItemWithDelete'

const queryClient = new QueryClient({
	defaultOptions: {
		queries: { retry: false },
		mutations: { retry: false },
	},
})

const meta = {
	title: 'Components/ReminderItemWithDelete',
	component: ReminderItemWithDelete,
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
} satisfies Meta<typeof ReminderItemWithDelete>

export default meta
type Story = StoryObj<typeof ReminderItemWithDelete>

const mockReminder: ReminderWithEvent = {
	id: '1',
	minutesBeforeStart: 30,
	eventId: 'event1',
	userId: 'user1',
	remindAt: new Date(Date.now() + 24 * 60 * 60 * 1000 - 30 * 60 * 1000).toISOString(),
	updatedAt: new Date().toISOString(),
	status: 'PENDING',
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
	createdAt: new Date().toISOString(),
}

export const Default: Story = {
	args: {
		reminder: mockReminder,
	},
}
