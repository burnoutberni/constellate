import type { Meta, StoryObj } from '@storybook/react'

import type { InstanceWithStats } from '@/types'

import { InstanceStats } from './InstanceStats'

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
	baseUrl: 'https://example.com',
	isBlocked: false,
	createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
	updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
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
			stats: {
				remoteUsers: 567,
				remoteEvents: 1234,
				localFollowing: 89,
				localFollowers: 123,
			},
		},
	},
}
