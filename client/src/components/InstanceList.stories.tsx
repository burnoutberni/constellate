import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import { AuthProvider } from '@/contexts/AuthContext'
import type { InstanceWithStats } from '@/types'

import { InstanceList } from './InstanceList'

const queryClient = new QueryClient({
	defaultOptions: {
		queries: { retry: false },
		mutations: { retry: false },
	},
})

const meta = {
	title: 'Components/InstanceList',
	component: InstanceList,
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
} satisfies Meta<typeof InstanceList>

export default meta
type Story = StoryObj<typeof InstanceList>

const mockInstances: InstanceWithStats[] = [
	{
		id: '1',
		domain: 'example.com',
		baseUrl: 'https://example.com',
		title: 'Example Instance',
		description: 'A friendly instance for event sharing',
		userCount: 42,
		eventCount: 128,
		isBlocked: false,
		createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
		updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
		lastActivityAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
		stats: {
			remoteUsers: 42,
			remoteEvents: 128,
			localFollowing: 15,
			localFollowers: 8,
		},
	},
	{
		id: '2',
		domain: 'another-instance.com',
		baseUrl: 'https://another-instance.com',
		title: 'Another Instance',
		userCount: 15,
		eventCount: 35,
		isBlocked: false,
		createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
		updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
		lastActivityAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
		stats: {
			remoteUsers: 15,
			remoteEvents: 35,
			localFollowing: 5,
			localFollowers: 3,
		},
	},
	{
		id: '3',
		domain: 'blocked-instance.com',
		baseUrl: 'https://blocked-instance.com',
		title: 'Blocked Instance',
		userCount: 0,
		eventCount: 0,
		isBlocked: true,
		createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
		updatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
		lastActivityAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
		stats: {
			remoteUsers: 0,
			remoteEvents: 0,
			localFollowing: 0,
			localFollowers: 0,
		},
	},
]

export const Default: Story = {
	args: {
		instances: mockInstances,
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

export const Empty: Story = {
	args: {
		instances: [],
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
