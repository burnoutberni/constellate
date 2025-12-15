import type { Meta, StoryObj } from '@storybook/react'
import { EventInfo } from './EventInfo'

const meta = {
	title: 'Components/EventInfo',
	component: EventInfo,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
} satisfies Meta<typeof EventInfo>

export default meta
type Story = StoryObj<typeof EventInfo>

const mockEvent = {
	title: 'Summer Music Festival',
	summary: 'A fantastic outdoor music festival',
	startTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
	endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(),
	location: 'Central Park, New York',
	url: 'https://example.com/festival',
	visibility: 'PUBLIC' as const,
	timezone: 'America/New_York',
	recurrencePattern: null,
	recurrenceEndDate: null,
	tags: [
		{ id: '1', tag: 'music' },
		{ id: '2', tag: 'festival' },
	],
}

export const Default: Story = {
	args: {
		event: mockEvent,
		viewerTimezone: 'America/New_York',
	},
}

export const WithoutEndTime: Story = {
	args: {
		event: {
			...mockEvent,
			endTime: null,
		},
		viewerTimezone: 'America/New_York',
	},
}

export const WithoutLocation: Story = {
	args: {
		event: {
			...mockEvent,
			location: null,
		},
		viewerTimezone: 'America/New_York',
	},
}

export const WithRecurrence: Story = {
	args: {
		event: {
			...mockEvent,
			recurrencePattern: 'WEEKLY' as const,
			recurrenceEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
		},
		viewerTimezone: 'America/New_York',
	},
}

export const DifferentTimezone: Story = {
	args: {
		event: mockEvent,
		viewerTimezone: 'Europe/London',
		eventTimezone: 'America/New_York',
	},
}

export const Private: Story = {
	args: {
		event: {
			...mockEvent,
			visibility: 'PRIVATE' as const,
		},
		viewerTimezone: 'America/New_York',
	},
}

export const NoTags: Story = {
	args: {
		event: {
			...mockEvent,
			tags: undefined,
		},
		viewerTimezone: 'America/New_York',
	},
}
