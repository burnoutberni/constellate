import type { Meta, StoryObj } from '@storybook/react'
import { MemoryRouter } from 'react-router-dom'

import type { Notification } from '@/types'

import { NotificationItem } from './NotificationItem'

const meta = {
	title: 'Components/NotificationItem',
	component: NotificationItem,
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
} satisfies Meta<typeof NotificationItem>

export default meta
type Story = StoryObj<typeof NotificationItem>

const mockNotification: Notification = {
	id: '1',
	type: 'LIKE',
	title: 'John Doe liked your event',
	read: false,
	createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
	updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
	actor: {
		id: 'user1',
		username: 'johndoe',
		name: 'John Doe',
		profileImage: 'https://i.pravatar.cc/150?img=12',
	},
	contextUrl: '/@johndoe/event1',
}

export const Default: Story = {
	args: {
		notification: mockNotification,
		onMarkRead: (_id) => {
			// Mark read handler
		},
	},
}

export const Read: Story = {
	args: {
		notification: {
			...mockNotification,
			read: true,
		},
		onMarkRead: (_id) => {
			// Mark read handler
		},
	},
}

export const Compact: Story = {
	args: {
		notification: mockNotification,
		compact: true,
		onMarkRead: (_id) => {
			// Mark read handler
		},
	},
}

export const EventComment: Story = {
	args: {
		notification: {
			...mockNotification,
			type: 'COMMENT',
		},
		onMarkRead: (_id) => {
			// Mark read handler
		},
	},
}

export const FollowRequest: Story = {
	args: {
		notification: {
			...mockNotification,
			type: 'FOLLOW',
		},
		onMarkRead: (_id) => {
			// Mark read handler
		},
	},
}

export const WithoutActor: Story = {
	args: {
		notification: {
			...mockNotification,
			actor: null,
		},
		onMarkRead: (_id) => {
			// Mark read handler
		},
	},
}
