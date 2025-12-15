import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { TimeZoneSettings } from './TimeZoneSettings'

const queryClient = new QueryClient({
	defaultOptions: {
		queries: { retry: false },
		mutations: { retry: false },
	},
})

const meta = {
	title: 'Components/TimeZoneSettings',
	component: TimeZoneSettings,
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
} satisfies Meta<typeof TimeZoneSettings>

export default meta
type Story = StoryObj<typeof TimeZoneSettings>

export const Default: Story = {
	args: {
		profile: {
			timezone: 'America/New_York',
		},
		userId: 'user1',
	},
}

export const UTC: Story = {
	args: {
		profile: {
			timezone: 'UTC',
		},
		userId: 'user1',
	},
}

export const EuropeLondon: Story = {
	args: {
		profile: {
			timezone: 'Europe/London',
		},
		userId: 'user1',
	},
}
