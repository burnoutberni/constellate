import type { Meta, StoryObj } from '@storybook/react'

import { CommunityStats } from './CommunityStats'

const meta = {
	title: 'Components/CommunityStats',
	component: CommunityStats,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
	argTypes: {
		totalEvents: {
			control: 'number',
		},
		totalUsers: {
			control: 'number',
		},
		totalInstances: {
			control: 'number',
		},
		isLoading: {
			control: 'boolean',
		},
	},
} satisfies Meta<typeof CommunityStats>

export default meta
type Story = StoryObj<typeof CommunityStats>

export const Default: Story = {
	args: {
		totalEvents: 1234,
		totalUsers: 567,
		totalInstances: 12,
		isLoading: false,
	},
}

export const LargeNumbers: Story = {
	args: {
		totalEvents: 1234567,
		totalUsers: 987654,
		totalInstances: 1234,
		isLoading: false,
	},
}

export const SmallNumbers: Story = {
	args: {
		totalEvents: 5,
		totalUsers: 3,
		totalInstances: 1,
		isLoading: false,
	},
}

export const Loading: Story = {
	args: {
		totalEvents: 0,
		totalUsers: 0,
		totalInstances: 0,
		isLoading: true,
	},
}

export const ZeroValues: Story = {
	args: {
		totalEvents: 0,
		totalUsers: 0,
		totalInstances: 0,
		isLoading: false,
	},
}
