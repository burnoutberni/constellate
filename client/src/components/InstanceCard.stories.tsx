import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { InstanceCard } from './InstanceCard'
import type { InstanceWithStats } from '@/types'

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
	domain: 'example.com',
	lastSeen: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
	blocked: false,
	stats: {
		userCount: 42,
		eventCount: 128,
	},
}

export const Default: Story = {
	args: {
		instance: mockInstance,
		onBlock: (domain) => console.log('Block', domain),
		onUnblock: (domain) => console.log('Unblock', domain),
		onRefresh: (domain) => console.log('Refresh', domain),
	},
}

export const Blocked: Story = {
	args: {
		instance: {
			...mockInstance,
			blocked: true,
		},
		onBlock: (domain) => console.log('Block', domain),
		onUnblock: (domain) => console.log('Unblock', domain),
		onRefresh: (domain) => console.log('Refresh', domain),
	},
}

export const NoStats: Story = {
	args: {
		instance: {
			...mockInstance,
			stats: null,
		},
		onBlock: (domain) => console.log('Block', domain),
		onUnblock: (domain) => console.log('Unblock', domain),
		onRefresh: (domain) => console.log('Refresh', domain),
	},
}
