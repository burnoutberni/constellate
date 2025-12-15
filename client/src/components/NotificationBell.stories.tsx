import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import { NotificationBell } from './NotificationBell'

const queryClient = new QueryClient({
	defaultOptions: {
		queries: { retry: false },
		mutations: { retry: false },
	},
})

const meta = {
	title: 'Components/NotificationBell',
	component: NotificationBell,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
	decorators: [
		(Story) => (
			<QueryClientProvider client={queryClient}>
				<MemoryRouter>
					<Story />
				</MemoryRouter>
			</QueryClientProvider>
		),
	],
} satisfies Meta<typeof NotificationBell>

export default meta
type Story = StoryObj<typeof NotificationBell>

export const Default: Story = {
	args: {
		userId: 'user1',
	},
}

export const NoUserId: Story = {
	args: {
		userId: undefined,
	},
}
