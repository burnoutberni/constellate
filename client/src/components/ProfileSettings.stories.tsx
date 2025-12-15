import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/design-system'
import { ProfileSettings } from './ProfileSettings'

const queryClient = new QueryClient({
	defaultOptions: {
		queries: { retry: false },
		mutations: { retry: false },
	},
})

const meta = {
	title: 'Components/ProfileSettings',
	component: ProfileSettings,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
	decorators: [
		(Story) => (
			<ThemeProvider>
				<QueryClientProvider client={queryClient}>
					<Story />
				</QueryClientProvider>
			</ThemeProvider>
		),
	],
} satisfies Meta<typeof ProfileSettings>

export default meta
type Story = StoryObj<typeof ProfileSettings>

export const Default: Story = {
	args: {
		profile: {
			id: 'user1',
			username: 'johndoe',
			name: 'John Doe',
			bio: 'Event organizer and music enthusiast',
			profileImage: 'https://i.pravatar.cc/150?img=12',
			headerImage: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbaf53?w=1200',
			displayColor: '#3b82f6',
		},
		userId: 'user1',
	},
}

export const Minimal: Story = {
	args: {
		profile: {
			id: 'user1',
			username: 'johndoe',
			name: null,
			bio: null,
			profileImage: null,
			headerImage: null,
			displayColor: '#3b82f6',
		},
		userId: 'user1',
	},
}
