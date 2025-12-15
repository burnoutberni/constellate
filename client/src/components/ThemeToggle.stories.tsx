import type { Meta, StoryObj } from '@storybook/react'
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
			<ThemeProvider>
				<Story />
			</ThemeProvider>
		),
	],
} satisfies Meta<typeof ThemeToggle>

export default meta
type Story = StoryObj<typeof ThemeToggle>

export const Default: Story = {}
