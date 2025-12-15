import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import { LocationDiscoveryCard } from './LocationDiscoveryCard'

const queryClient = new QueryClient({
	defaultOptions: {
		queries: { retry: false },
		mutations: { retry: false },
	},
})

const meta = {
	title: 'Components/LocationDiscoveryCard',
	component: LocationDiscoveryCard,
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
} satisfies Meta<typeof LocationDiscoveryCard>

export default meta
type Story = StoryObj<typeof LocationDiscoveryCard>

export const Default: Story = {}
