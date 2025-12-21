import type { Meta, StoryObj } from '@storybook/react'
import { MemoryRouter } from 'react-router-dom'

import { ThemeProvider } from '@/design-system'
import { Event } from '@/types'

import { EventMap } from './EventMap'

const meta: Meta<typeof EventMap> = {
	title: 'Components/EventMap',
	component: EventMap,
	parameters: {
		layout: 'padded',
	},
	decorators: [
		(Story) => (
			<ThemeProvider defaultTheme="light">
				<MemoryRouter>
					<Story />
				</MemoryRouter>
			</ThemeProvider>
		),
	],
}

export default meta
type Story = StoryObj<typeof EventMap>

const mockEvents: Event[] = [
	{
		id: 'event-1',
		title: 'Central Park Meetup',
		startTime: new Date().toISOString(),
		locationLatitude: 40.7829,
		locationLongitude: -73.9654,
		timezone: 'UTC',
		tags: [
			{ id: '1', tag: 'outdoor' },
			{ id: '2', tag: 'social' },
		],
		user: {
			id: 'user-1',
			username: 'park_ranger',
			isRemote: false,
		},
	},
	{
		id: 'event-2',
		title: 'Times Square Gathering',
		startTime: new Date().toISOString(),
		locationLatitude: 40.758,
		locationLongitude: -73.9855,
		timezone: 'UTC',
		tags: [
			{ id: '3', tag: 'city' },
			{ id: '4', tag: 'nightlife' },
		],
		user: {
			id: 'user-2',
			username: 'city_guide',
			isRemote: false,
		},
	},
]

export const Default: Story = {
	args: {
		events: mockEvents,
	},
}

export const SingleEvent: Story = {
	args: {
		events: [mockEvents[0]],
	},
}

export const NoEvents: Story = {
	args: {
		events: [],
	},
}
