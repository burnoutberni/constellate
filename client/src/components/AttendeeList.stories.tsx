import type { Meta, StoryObj } from '@storybook/react'
import { MemoryRouter } from 'react-router-dom'

import { AttendeeList, type Attendee } from './AttendeeList'

const meta = {
	title: 'Components/AttendeeList',
	component: AttendeeList,
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
} satisfies Meta<typeof AttendeeList>

export default meta
type Story = StoryObj<typeof AttendeeList>

const mockAttendees: Attendee[] = [
	{
		user: {
			id: '1',
			username: 'alice',
			name: 'Alice Smith',
			profileImage: 'https://i.pravatar.cc/150?img=1',
		},
		status: 'attending',
	},
	{
		user: {
			id: '2',
			username: 'bob',
			name: 'Bob Johnson',
			profileImage: 'https://i.pravatar.cc/150?img=2',
		},
		status: 'attending',
	},
	{
		user: {
			id: '3',
			username: 'charlie',
			name: 'Charlie Brown',
			profileImage: null,
		},
		status: 'maybe',
	},
]

const manyAttendees: Attendee[] = Array.from({ length: 25 }, (_, i) => ({
	user: {
		id: String(i + 1),
		username: `user${i + 1}`,
		name: `User ${i + 1}`,
		profileImage: i % 3 === 0 ? `https://i.pravatar.cc/150?img=${i + 1}` : null,
	},
	status: i % 3 === 0 ? 'attending' : i % 3 === 1 ? 'maybe' : 'attending',
}))

export const Default: Story = {
	args: {
		attendees: mockAttendees,
	},
}

export const ManyAttendees: Story = {
	args: {
		attendees: manyAttendees,
		initialDisplayCount: 10,
	},
}

export const WithoutAvatars: Story = {
	args: {
		attendees: mockAttendees,
		showAvatars: false,
	},
}

export const Empty: Story = {
	args: {
		attendees: [],
	},
}

export const SingleAttendee: Story = {
	args: {
		attendees: [mockAttendees[0]],
	},
}
