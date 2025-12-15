import type { Meta, StoryObj } from '@storybook/react'
import { MemoryRouter } from 'react-router-dom'
import { HomeHero } from './HomeHero'

const meta = {
	title: 'Components/HomeHero',
	component: HomeHero,
	parameters: {
		layout: 'fullscreen',
	},
	tags: ['autodocs'],
	args: {
		isAuthenticated: false,
	},
	decorators: [
		(Story) => (
			<MemoryRouter>
				<Story />
			</MemoryRouter>
		),
	],
} satisfies Meta<typeof HomeHero>

export default meta
type Story = StoryObj<typeof HomeHero>

export const Default: Story = {
	args: {
		isAuthenticated: false,
	},
}

export const Authenticated: Story = {
	args: {
		isAuthenticated: true,
	},
}

export const NotAuthenticated: Story = {
	args: {
		isAuthenticated: false,
	},
}
