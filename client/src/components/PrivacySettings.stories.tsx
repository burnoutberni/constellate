import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { PrivacySettings } from './PrivacySettings'

const queryClient = new QueryClient({
	defaultOptions: {
		queries: { retry: false },
		mutations: { retry: false },
	},
})

const meta = {
	title: 'Components/PrivacySettings',
	component: PrivacySettings,
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
} satisfies Meta<typeof PrivacySettings>

export default meta
type Story = StoryObj<typeof PrivacySettings>

export const Default: Story = {
	args: {
		profile: {
			autoAcceptFollowers: false,
		},
		userId: 'user1',
	},
}

export const AutoAcceptEnabled: Story = {
	args: {
		profile: {
			autoAcceptFollowers: true,
		},
		userId: 'user1',
	},
}
