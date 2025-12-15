import type { Meta, StoryObj } from '@storybook/react'
import { InstanceStats } from './InstanceStats'
import type { InstanceWithStats } from '@/types'

const meta = {
	title: 'Components/InstanceStats',
	component: InstanceStats,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
} satisfies Meta<typeof InstanceStats>

export default meta
type Story = StoryObj<typeof InstanceStats>

const mockInstance: InstanceWithStats = {
	id: '1',
	domain: 'example.com',
	lastSeen: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
	blocked: false,
	userCount: 42,
	eventCount: 128,
	stats: {
		remoteUsers: 15,
		remoteEvents: 35,
		localFollowing: 8,
		localFollowers: 12,
	},
}

export const Default: Story = {
	args: {
		instance: mockInstance,
	},
}

export const WithoutLocalFollowers: Story = {
	args: {
		instance: {
			...mockInstance,
			stats: {
				remoteUsers: 15,
				remoteEvents: 35,
				localFollowing: 8,
			},
		},
	},
}

export const LargeNumbers: Story = {
	args: {
		instance: {
			...mockInstance,
			userCount: 1234,
			eventCount: 5678,
			stats: {
				remoteUsers: 567,
				remoteEvents: 1234,
				localFollowing: 89,
				localFollowers: 123,
			},
		},
	},
}
