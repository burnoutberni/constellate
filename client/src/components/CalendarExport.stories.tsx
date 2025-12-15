import type { Meta, StoryObj } from '@storybook/react'
import { CalendarExport } from './CalendarExport'

const meta = {
	title: 'Components/CalendarExport',
	component: CalendarExport,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
} satisfies Meta<typeof CalendarExport>

export default meta
type Story = StoryObj<typeof CalendarExport>

const mockEvent = {
	title: 'Summer Music Festival',
	description: 'A fantastic outdoor music festival',
	location: 'Central Park, New York',
	startTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
	endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(),
	timezone: 'America/New_York',
	url: 'https://example.com/festival',
}

export const Default: Story = {
	args: mockEvent,
}

export const WithoutEndTime: Story = {
	args: {
		...mockEvent,
		endTime: null,
	},
}

export const WithoutLocation: Story = {
	args: {
		...mockEvent,
		location: null,
	},
}

export const WithoutDescription: Story = {
	args: {
		...mockEvent,
		description: null,
	},
}
