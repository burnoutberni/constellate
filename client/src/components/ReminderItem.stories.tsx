import type { Meta, StoryObj } from '@storybook/react'
import { MemoryRouter } from 'react-router-dom'

import type { ReminderWithEvent } from '@/types'

import { ReminderItem } from './ReminderItem'

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
			profileImage: 'https://i.pravatar.cc/150?img=12',
			isRemote: false,
		},
	},
	createdAt: new Date().toISOString(),
}

export const Default: Story = {
	args: {
		reminder: mockReminder,
		onDelete: (_id) => {
			// Delete handler
		},
	},
}

export const Sent: Story = {
	args: {
		reminder: {
			...mockReminder,
			status: 'SENT',
		},
		onDelete: (_id) => {
			// Delete handler
		},
	},
}

export const Failed: Story = {
	args: {
		reminder: {
			...mockReminder,
			status: 'FAILED',
		},
		onDelete: (_id) => {
			// Delete handler
		},
	},
}

export const Sending: Story = {
	args: {
		reminder: {
			...mockReminder,
			status: 'SENDING',
		},
		onDelete: (_id) => {
			// Delete handler
		},
	},
}

export const Deleting: Story = {
	args: {
		reminder: mockReminder,
		isDeleting: true,
		onDelete: (_id) => {
			// Delete handler
		},
	},
}

export const OneHourBefore: Story = {
	args: {
		reminder: {
			...mockReminder,
			minutesBeforeStart: 60,
		},
		onDelete: (_id) => {
			// Delete handler
		},
	},
}

export const OneDayBefore: Story = {
	args: {
		reminder: {
			...mockReminder,
			minutesBeforeStart: 1440,
		},
		onDelete: (_id) => {
			// Delete handler
		},
	},
}
