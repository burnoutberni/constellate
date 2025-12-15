import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ReminderItemWithDelete } from './ReminderItemWithDelete'
import type { ReminderWithEvent } from '@/types'

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
	minutesBefore: 30,
	status: 'PENDING',
	event: {
		id: 'event1',
		title: 'Summer Music Festival',
		startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
		user: {
			id: 'user1',
			username: 'johndoe',
			name: 'John Doe',
		},
	},
	createdAt: new Date().toISOString(),
}

export const Default: Story = {
	args: {
		reminder: mockReminder,
	},
}
