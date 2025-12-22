import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

import { NotificationSettings } from './NotificationSettings'

// Mock the hooks
vi.mock('@/hooks/queries', () => ({
	useEmailPreferences: () => ({
		data: {
			preferences: {
				FOLLOW: true,
				COMMENT: true,
				LIKE: false,
				MENTION: true,
				EVENT: true,
				SYSTEM: true,
			},
		},
		isLoading: false,
		error: null,
	}),
	useUpdateEmailPreferences: () => ({
		mutate: vi.fn(),
		isPending: false,
	}),
	useResetEmailPreferences: () => ({
		mutate: vi.fn(),
		isPending: false,
	}),
}))

// Create a client for Storybook
const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: false,
		},
	},
})

const meta = {
	title: 'Components/NotificationSettings',
	component: NotificationSettings,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
	decorators: [
		(Story) => (
			<QueryClientProvider client={queryClient}>
				<Story />
			</QueryClientProvider>
		),
	],
} satisfies Meta<typeof NotificationSettings>

export default meta
type Story = StoryObj<typeof NotificationSettings>

export const Default: Story = {
	args: {
		emailMode: false,
	},
}

export const EmailMode: Story = {
	args: {
		emailMode: true,
	},
}
