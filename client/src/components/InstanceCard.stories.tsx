import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import { AuthProvider } from '@/contexts/AuthContext'
import type { InstanceWithStats } from '@/types'

import { InstanceCard } from './InstanceCard'

const queryClient = new QueryClient({
	defaultOptions: {
		queries: { retry: false },
		mutations: { retry: false },
	},
})

const meta = {
	title: 'Components/InstanceCard',
	component: InstanceCard,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
	decorators: [
		(Story) => (
			<AuthProvider>
				<QueryClientProvider client={queryClient}>
					<MemoryRouter>
						<Story />
					</MemoryRouter>
				</QueryClientProvider>
			</AuthProvider>
		),
	],
} satisfies Meta<typeof InstanceCard>

export default meta
type Story = StoryObj<typeof InstanceCard>

const mockInstance: InstanceWithStats = {
	id: '1',
	domain: 'example.com',
	baseUrl: 'https://example.com',
	isBlocked: false,
	createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
	updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
	stats: {
		remoteUsers: 42,
		remoteEvents: 128,
		localFollowing: 15,
		localFollowers: 8,
	},
}

export const Default: Story = {
	args: {
		instance: mockInstance,
		onBlock: (_domain) => {
			// Block handler
		},
		onUnblock: (_domain) => {
			// Unblock handler
		},
		onRefresh: (_domain) => {
			// Refresh handler
		},
	},
}

export const Blocked: Story = {
	args: {
		instance: {
			...mockInstance,
			isBlocked: true,
		},
		onBlock: (_domain) => {
			// Block handler
		},
		onUnblock: (_domain) => {
			// Unblock handler
		},
		onRefresh: (_domain) => {
			// Refresh handler
		},
	},
}

export const NoStats: Story = {
	args: {
		instance: {
			...mockInstance,
			stats: {
				remoteUsers: 0,
				remoteEvents: 0,
				localFollowing: 0,
			},
		},
		onBlock: (_domain) => {
			// Block handler
		},
		onUnblock: (_domain) => {
			// Unblock handler
		},
		onRefresh: (_domain) => {
			// Refresh handler
		},
	},
}
