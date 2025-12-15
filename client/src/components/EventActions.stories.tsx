import type { Meta, StoryObj } from '@storybook/react'
import { MemoryRouter } from 'react-router-dom'

import { EventActions } from './EventActions'

const meta = {
	title: 'Components/EventActions',
	component: EventActions,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
	args: {
		username: 'johndoe',
		eventId: 'event1',
		isOwner: true,
		onDelete: () => {},
		onDuplicate: () => {},
	},
	argTypes: {
		onDelete: {
			control: false,
		},
		onDuplicate: {
			control: false,
		},
	},
	decorators: [
		(Story) => (
			<MemoryRouter>
				<Story />
			</MemoryRouter>
		),
	],
} satisfies Meta<typeof EventActions>

export default meta
type Story = StoryObj<typeof EventActions>

export const Default: Story = {
	args: {
		username: 'johndoe',
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

export const AsOwner: Story = {
	args: {
		username: 'johndoe',
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

export const Deleting: Story = {
	args: {
		username: 'johndoe',
		eventId: 'event1',
		isOwner: true,
		isDeleting: true,
		onDelete: () => {
			// Delete handler
		},
	},
}

export const Duplicating: Story = {
	args: {
		username: 'johndoe',
		eventId: 'event1',
		isOwner: true,
		isDuplicating: true,
		onDuplicate: () => {
			// Duplicate handler
		},
	},
}

export const NotOwner: Story = {
	args: {
		username: 'johndoe',
		eventId: 'event1',
		isOwner: false,
	},
}
