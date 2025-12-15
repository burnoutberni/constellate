import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@/design-system'
import { SearchBar } from './SearchBar'

const queryClient = new QueryClient({
	defaultOptions: {
		queries: { retry: false },
		mutations: { retry: false },
	},
})

const meta = {
	title: 'Components/SearchBar',
	component: SearchBar,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
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
} satisfies Meta<typeof SearchBar>

export default meta
type Story = StoryObj<typeof SearchBar>

export const Default: Story = {}
