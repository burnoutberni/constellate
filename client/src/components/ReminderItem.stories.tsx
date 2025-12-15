import type { Meta, StoryObj } from '@storybook/react'
import { MemoryRouter } from 'react-router-dom'
import { ReminderItem } from './ReminderItem'
import type { ReminderWithEvent } from '@/types'

const meta = {
	title: 'Components/ReminderItem',
	component: ReminderItem,
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
} satisfies Meta<typeof ReminderItem>

export default meta
type Story = StoryObj<typeof ReminderItem>

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
			profileImage: 'https://i.pravatar.cc/150?img=12',
		},
	},
	createdAt: new Date().toISOString(),
}

export const Default: Story = {
	args: {
		reminder: mockReminder,
		onDelete: (id) => console.log('Delete', id),
	},
}

export const Sent: Story = {
	args: {
		reminder: {
			...mockReminder,
			status: 'SENT',
		},
		onDelete: (id) => console.log('Delete', id),
	},
}

export const Failed: Story = {
	args: {
		reminder: {
			...mockReminder,
			status: 'FAILED',
		},
		onDelete: (id) => console.log('Delete', id),
	},
}

export const Sending: Story = {
	args: {
		reminder: {
			...mockReminder,
			status: 'SENDING',
		},
		onDelete: (id) => console.log('Delete', id),
	},
}

export const Deleting: Story = {
	args: {
		reminder: mockReminder,
		isDeleting: true,
		onDelete: (id) => console.log('Delete', id),
	},
}

export const OneHourBefore: Story = {
	args: {
		reminder: {
			...mockReminder,
			minutesBefore: 60,
		},
		onDelete: (id) => console.log('Delete', id),
	},
}

export const OneDayBefore: Story = {
	args: {
		reminder: {
			...mockReminder,
			minutesBefore: 1440,
		},
		onDelete: (id) => console.log('Delete', id),
	},
}
