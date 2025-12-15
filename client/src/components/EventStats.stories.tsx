import type { Meta, StoryObj } from '@storybook/react'
import { EventStats } from './EventStats'

const meta = {
	title: 'Components/EventStats',
	component: EventStats,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
} satisfies Meta<typeof EventStats>

export default meta
type Story = StoryObj<typeof EventStats>

export const Default: Story = {
	args: {
		totalEvents: 42,
		upcomingEvents: 15,
	},
}

export const WithTodayEvents: Story = {
	args: {
		totalEvents: 42,
		upcomingEvents: 15,
		todayEvents: 3,
	},
}

export const WithActiveUsers: Story = {
	args: {
		totalEvents: 42,
		upcomingEvents: 15,
		activeUsers: 128,
	},
}

export const Full: Story = {
	args: {
		totalEvents: 42,
		upcomingEvents: 15,
		todayEvents: 3,
		activeUsers: 128,
	},
}

export const Loading: Story = {
	args: {
		totalEvents: 0,
		upcomingEvents: 0,
		isLoading: true,
	},
}

export const ZeroEvents: Story = {
	args: {
		totalEvents: 0,
		upcomingEvents: 0,
	},
}
