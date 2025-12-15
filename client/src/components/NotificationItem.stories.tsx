import type { Meta, StoryObj } from '@storybook/react'
import { MemoryRouter } from 'react-router-dom'
import { NotificationItem } from './NotificationItem'
import type { Notification } from '@/types'

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
	type: 'event_like',
	read: false,
	createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
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
		onMarkRead: (id) => console.log('Mark read', id),
	},
}

export const Read: Story = {
	args: {
		notification: {
			...mockNotification,
			read: true,
		},
		onMarkRead: (id) => console.log('Mark read', id),
	},
}

export const Compact: Story = {
	args: {
		notification: mockNotification,
		compact: true,
		onMarkRead: (id) => console.log('Mark read', id),
	},
}

export const EventComment: Story = {
	args: {
		notification: {
			...mockNotification,
			type: 'event_comment',
		},
		onMarkRead: (id) => console.log('Mark read', id),
	},
}

export const FollowRequest: Story = {
	args: {
		notification: {
			...mockNotification,
			type: 'follow_request',
		},
		onMarkRead: (id) => console.log('Mark read', id),
	},
}

export const WithoutActor: Story = {
	args: {
		notification: {
			...mockNotification,
			actor: null,
		},
		onMarkRead: (id) => console.log('Mark read', id),
	},
}
