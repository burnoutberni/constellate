import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import { ThemeProvider } from '@/design-system'

import { Navbar } from './Navbar'

const queryClient = new QueryClient({
	defaultOptions: {
		queries: { retry: false },
		mutations: { retry: false },
	},
})

const meta = {
	title: 'Components/Navbar',
	component: Navbar,
	parameters: {
		layout: 'fullscreen',
	},
	tags: ['autodocs'],
	args: {
		isConnected: false,
		user: null,
		onLogout: () => {},
	},
	argTypes: {
		onLogout: {
			control: false,
		},
	},
	decorators: [
		(Story) => (
			<ThemeProvider>
				<QueryClientProvider client={queryClient}>
					<MemoryRouter>
						<Story />
					</MemoryRouter>
				</QueryClientProvider>
			</ThemeProvider>
		),
	],
} satisfies Meta<typeof Navbar>

export default meta
type Story = StoryObj<typeof Navbar>

const mockUser = {
	id: 'user1',
	name: 'John Doe',
	email: 'john@example.com',
	username: 'johndoe',
	image: 'https://i.pravatar.cc/150?img=12',
}

export const Default: Story = {
	args: {
		isConnected: false,
		user: null,
	},
}

export const Authenticated: Story = {
	args: {
		isConnected: true,
		user: mockUser,
		onLogout: () => {
			// Logout handler
		},
	},
}

export const NotAuthenticated: Story = {
	args: {
		isConnected: false,
		user: null,
	},
}

export const WithoutImage: Story = {
	args: {
		isConnected: true,
		user: {
			...mockUser,
			image: null,
		},
		onLogout: () => {
			// Logout handler
		},
	},
}
