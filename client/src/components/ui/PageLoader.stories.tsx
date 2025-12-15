import type { Meta, StoryObj } from '@storybook/react'
import { PageLoader } from './PageLoader'

const meta = {
	title: 'Base/PageLoader',
	component: PageLoader,
	parameters: {
		layout: 'fullscreen',
	},
	tags: ['autodocs'],
	argTypes: {
		spinnerSize: {
			control: 'select',
			options: ['sm', 'md', 'lg'],
		},
	},
} satisfies Meta<typeof PageLoader>

export default meta
type Story = StoryObj<typeof PageLoader>

export const Default: Story = {
	args: {},
}

export const WithMessage: Story = {
	args: {
		message: 'Loading your content...',
	},
}

export const SmallSpinner: Story = {
	args: {
		spinnerSize: 'sm',
		message: 'Loading...',
	},
}

export const MediumSpinner: Story = {
	args: {
		spinnerSize: 'md',
		message: 'Loading...',
	},
}

export const LargeSpinner: Story = {
	args: {
		spinnerSize: 'lg',
		message: 'Loading...',
	},
}

export const CustomMessage: Story = {
	args: {
		message: 'Please wait while we fetch your data',
		spinnerSize: 'lg',
	},
}
