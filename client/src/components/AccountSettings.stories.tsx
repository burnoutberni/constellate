import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { AccountSettings } from './AccountSettings'

const queryClient = new QueryClient({
	defaultOptions: {
		queries: { retry: false },
		mutations: { retry: false },
	},
})

const meta = {
	title: 'Components/AccountSettings',
	component: AccountSettings,
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
} satisfies Meta<typeof AccountSettings>

export default meta
type Story = StoryObj<typeof AccountSettings>

export const Default: Story = {
	args: {
		profile: {
			email: 'john@example.com',
			username: 'johndoe',
		},
	},
}

export const NoEmail: Story = {
	args: {
		profile: {
			email: null,
			username: 'johndoe',
		},
	},
}
