import type { Meta, StoryObj } from '@storybook/react'
import { useRef, useEffect } from 'react'
import { MemoryRouter } from 'react-router-dom'

import { useUIStore } from '@/stores'

import { MentionNotifications } from './MentionNotifications'

// Interactive preview for Docs page
const DocsWrapper = () => {
	const addMentionNotification = useUIStore((state) => state.addMentionNotification)
	const dismissMentionNotification = useUIStore((state) => state.dismissMentionNotification)
	const initialized = useRef(false)

	// Set up notifications in useEffect to ensure component has subscribed to store
	useEffect(() => {
		if (!initialized.current) {
			const store = useUIStore.getState()

			// Clear existing notifications first
			store.mentionNotifications.forEach((n) => {
				dismissMentionNotification(n.id)
			})

			// Add mock notifications for Docs page
			addMentionNotification({
				id: 'doc-notification-1',
				commentId: 'comment1',
				content: 'This is a great event! Thanks for organizing it.',
				eventId: 'event1',
				eventTitle: 'Summer Music Festival',
				eventOwnerHandle: 'johndoe',
				author: {
					id: 'user1',
					username: 'alice',
					name: 'Alice Smith',
				},
				createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
			})
			addMentionNotification({
				id: 'doc-notification-2',
				commentId: 'comment2',
				content: 'Looking forward to this!',
				eventId: 'event2',
				eventTitle: 'Tech Meetup',
				eventOwnerHandle: 'janedoe',
				author: {
					id: 'user2',
					username: 'bob',
					name: 'Bob Johnson',
				},
				createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
			})
			initialized.current = true
		}
	}, [addMentionNotification, dismissMentionNotification])

	return (
		<div
			style={{
				position: 'relative',
				minHeight: '500px',
				height: '500px',
				width: '100%',
				overflow: 'visible',
			}}>
			<MemoryRouter>
				<MentionNotifications />
			</MemoryRouter>
		</div>
	)
}

const meta = {
	title: 'Components/MentionNotifications',
	component: MentionNotifications,
	parameters: {
		layout: 'fullscreen',
		docs: {
			canvas: {
				height: '500px',
			},
			story: {
				inline: false,
			},
		},
	},
	tags: ['autodocs'],
} satisfies Meta<typeof MentionNotifications>

export default meta
type Story = StoryObj<typeof MentionNotifications>

const NotificationWrapper = () => {
	const addMentionNotification = useUIStore((state) => state.addMentionNotification)
	const dismissMentionNotification = useUIStore((state) => state.dismissMentionNotification)
	const initialized = useRef(false)

	// Set up notifications in useEffect to ensure component has subscribed to store
	useEffect(() => {
		if (!initialized.current) {
			const store = useUIStore.getState()

			// Clear existing notifications first
			store.mentionNotifications.forEach((n) => {
				dismissMentionNotification(n.id)
			})

			// Add new notifications
			addMentionNotification({
				id: '1',
				commentId: 'comment1',
				content: 'This is a great event! Thanks for organizing it.',
				eventId: 'event1',
				eventTitle: 'Summer Music Festival',
				eventOwnerHandle: 'johndoe',
				author: {
					id: 'user1',
					username: 'alice',
					name: 'Alice Smith',
				},
				createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
			})
			addMentionNotification({
				id: '2',
				commentId: 'comment2',
				content: 'Looking forward to this!',
				eventId: 'event2',
				eventTitle: 'Tech Meetup',
				eventOwnerHandle: 'janedoe',
				author: {
					id: 'user2',
					username: 'bob',
					name: 'Bob Johnson',
				},
				createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
			})
			initialized.current = true
		}
	}, [addMentionNotification, dismissMentionNotification])

	return (
		<div
			style={{
				position: 'relative',
				minHeight: '500px',
				height: '500px',
				width: '100%',
				overflow: 'visible',
			}}>
			<MemoryRouter>
				<MentionNotifications />
			</MemoryRouter>
		</div>
	)
}

export const Default: Story = {
	render: DocsWrapper,
	parameters: {
		docs: {
			story: {
				inline: true,
			},
		},
	},
}

export const Interactive: Story = {
	render: () => <NotificationWrapper />,
}
