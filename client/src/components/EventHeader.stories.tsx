import type { Meta, StoryObj } from '@storybook/react'
import { MemoryRouter } from 'react-router-dom'

import { EventHeader } from './EventHeader'

const meta = {
	title: 'Components/EventHeader',
	component: EventHeader,
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
} satisfies Meta<typeof EventHeader>

export default meta
type Story = StoryObj<typeof EventHeader>

const mockOrganizer = {
	id: 'user1',
	username: 'johndoe',
	name: 'John Doe',
	profileImage: 'https://i.pravatar.cc/150?img=12',
	displayColor: null,
}

export const Default: Story = {
	args: {
		organizer: mockOrganizer,
		eventId: 'event1',
	},
}

export const AsOwner: Story = {
	args: {
		organizer: mockOrganizer,
		eventId: 'event1',
		isOwner: true,
		onDelete: () => {
			// Delete handler
		},
		onDuplicate: () => {
			// Duplicate handler
		},
	},
}

export const WithDelete: Story = {
	args: {
		organizer: mockOrganizer,
		eventId: 'event1',
		isOwner: true,
		isDeleting: true,
		onDelete: () => {
			// Delete handler
		},
	},
}

export const WithDuplicate: Story = {
	args: {
		organizer: mockOrganizer,
		eventId: 'event1',
		isOwner: true,
		isDuplicating: true,
		onDuplicate: () => {
			// Duplicate handler
		},
	},
}

export const WithoutImage: Story = {
	args: {
		organizer: {
			...mockOrganizer,
			profileImage: null,
		},
		eventId: 'event1',
	},
}
