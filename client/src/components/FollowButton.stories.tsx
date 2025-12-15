import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AuthContext } from '@/contexts/AuthContext'
import { queryKeys } from '@/hooks/queries'

import { FollowButton } from './FollowButton'

const queryClient = new QueryClient({
	defaultOptions: {
		queries: { retry: false },
		mutations: { retry: false },
	},
})

// Mock follow status data for Storybook
queryClient.setQueryData(queryKeys.users.followStatus('johndoe'), {
	isFollowing: false,
	isAccepted: false,
})

// Mock user for Storybook
const mockUser = {
	id: 'current-user-1',
	email: 'current@example.com',
	name: 'Current User',
	username: 'currentuser',
	image: null,
}

// Mock AuthContext value for Storybook
const mockAuthValue = {
	user: mockUser,
	loading: false,
	login: async () => {},
	sendMagicLink: async () => {},
	signup: async () => {},
	logout: async () => {},
}

const meta = {
	title: 'Components/FollowButton',
	component: FollowButton,
	parameters: {
		layout: 'centered',
	},
	tags: ['autodocs'],
	decorators: [
		(Story) => (
			<AuthContext.Provider value={mockAuthValue}>
				<QueryClientProvider client={queryClient}>
					<Story />
				</QueryClientProvider>
			</AuthContext.Provider>
		),
	],
} satisfies Meta<typeof FollowButton>

export default meta
type Story = StoryObj<typeof FollowButton>

export const Default: Story = {
	args: {
		username: 'johndoe',
	},
}

export const Primary: Story = {
	args: {
		username: 'johndoe',
		variant: 'primary',
	},
}

export const Secondary: Story = {
	args: {
		username: 'johndoe',
		variant: 'secondary',
	},
}

export const Ghost: Story = {
	args: {
		username: 'johndoe',
		variant: 'ghost',
	},
}

export const Small: Story = {
	args: {
		username: 'johndoe',
		size: 'sm',
	},
}

export const Medium: Story = {
	args: {
		username: 'johndoe',
		size: 'md',
	},
}

export const Large: Story = {
	args: {
		username: 'johndoe',
		size: 'lg',
	},
}

export const WithStatus: Story = {
	args: {
		username: 'johndoe',
		showStatus: true,
	},
}
