import type { Meta, StoryObj } from '@storybook/react'

import { Container } from './Container'

const meta = {
	title: 'Layout/Container',
	component: Container,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
} satisfies Meta<typeof Container>

export default meta
type Story = StoryObj<typeof Container>

export const Default: Story = {
	args: {
		children: (
			<div className="bg-primary-100 dark:bg-primary-900 p-4 rounded">
				Container content with default size (lg) and padding
			</div>
		),
	},
}

export const Small: Story = {
	args: {
		size: 'sm',
		children: (
			<div className="bg-primary-100 dark:bg-primary-900 p-4 rounded">
				Small container (max-w-screen-sm)
			</div>
		),
	},
}

export const Medium: Story = {
	args: {
		size: 'md',
		children: (
			<div className="bg-primary-100 dark:bg-primary-900 p-4 rounded">
				Medium container (max-w-screen-md)
			</div>
		),
	},
}

export const Large: Story = {
	args: {
		size: 'lg',
		children: (
			<div className="bg-primary-100 dark:bg-primary-900 p-4 rounded">
				Large container (max-w-screen-lg)
			</div>
		),
	},
}

export const ExtraLarge: Story = {
	args: {
		size: 'xl',
		children: (
			<div className="bg-primary-100 dark:bg-primary-900 p-4 rounded">
				Extra large container (max-w-screen-xl)
			</div>
		),
	},
}

export const Full: Story = {
	args: {
		size: 'full',
		children: (
			<div className="bg-primary-100 dark:bg-primary-900 p-4 rounded">
				Full width container (max-w-full)
			</div>
		),
	},
}

export const NoPadding: Story = {
	args: {
		padding: false,
		children: (
			<div className="bg-primary-100 dark:bg-primary-900 p-4 rounded">
				Container without horizontal padding
			</div>
		),
	},
}

