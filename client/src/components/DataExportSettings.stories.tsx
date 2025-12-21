import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import { ThemeProvider } from '@/design-system'

import { DataExportSettings } from './DataExportSettings'

const queryClient = new QueryClient({
	defaultOptions: {
		queries: { retry: false },
		mutations: { retry: false },
	},
})

const meta = {
	title: 'Components/DataExportSettings',
	component: DataExportSettings,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
	decorators: [
		(Story) => (
			<ThemeProvider defaultTheme="light">
				<QueryClientProvider client={queryClient}>
					<MemoryRouter>
						<Story />
					</MemoryRouter>
				</QueryClientProvider>
			</ThemeProvider>
		),
	],
} satisfies Meta<typeof DataExportSettings>

export default meta
type Story = StoryObj<typeof DataExportSettings>

export const Default: Story = {}

