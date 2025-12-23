import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ThemeProvider } from '@/design-system'

import { ThemeToggle } from './ThemeToggle'

const meta = {
	title: 'Components/ThemeToggle',
	component: ThemeToggle,
	parameters: {
		layout: 'centered',
	},
	tags: ['autodocs'],
	decorators: [
		(Story) => (
			<QueryClientProvider client={new QueryClient()}>
				<ThemeProvider>
					<Story />
				</ThemeProvider>
			</QueryClientProvider>
		),
	],
} satisfies Meta<typeof ThemeToggle>

export default meta
type Story = StoryObj<typeof ThemeToggle>

export const Default: Story = {}
