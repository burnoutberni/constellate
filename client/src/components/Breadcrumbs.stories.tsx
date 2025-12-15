import type { Meta, StoryObj } from '@storybook/react'
import { MemoryRouter } from 'react-router-dom'
import { Breadcrumbs } from './Breadcrumbs'

const meta = {
	title: 'Components/Breadcrumbs',
	component: Breadcrumbs,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
	decorators: [
		(Story) => (
			<MemoryRouter>
				<Story />
			</MemoryRouter>
		),
	],
} satisfies Meta<typeof Breadcrumbs>

export default meta
type Story = StoryObj<typeof Breadcrumbs>

export const Default: Story = {
	args: {
		items: [
			{ label: 'Home', href: '/' },
			{ label: 'Events', href: '/events' },
			{ label: 'Summer Festival' },
		],
	},
}

export const Short: Story = {
	args: {
		items: [{ label: 'Home', href: '/' }, { label: 'Settings' }],
	},
}

export const Long: Story = {
	args: {
		items: [
			{ label: 'Home', href: '/' },
			{ label: 'Events', href: '/events' },
			{ label: 'Categories', href: '/events/categories' },
			{ label: 'Music', href: '/events/categories/music' },
			{ label: 'Festivals' },
		],
	},
}

export const SingleItem: Story = {
	args: {
		items: [{ label: 'Home' }],
	},
}
