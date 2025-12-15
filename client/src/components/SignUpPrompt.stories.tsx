import type { Meta, StoryObj } from '@storybook/react'
import { MemoryRouter } from 'react-router-dom'

import { SignUpPrompt } from './SignUpPrompt'

const meta = {
	title: 'Components/SignUpPrompt',
	component: SignUpPrompt,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
	args: {
		variant: 'card',
		action: 'rsvp',
	},
	decorators: [
		(Story) => (
			<MemoryRouter>
				<Story />
			</MemoryRouter>
		),
	],
} satisfies Meta<typeof SignUpPrompt>

export default meta
type Story = StoryObj<typeof SignUpPrompt>

export const Default: Story = {
	args: {
		variant: 'card',
		action: 'rsvp',
	},
}

export const Inline: Story = {
	args: {
		variant: 'inline',
		action: 'comment',
	},
}

export const Card: Story = {
	args: {
		variant: 'card',
		action: 'rsvp',
	},
}

export const Like: Story = {
	args: {
		variant: 'card',
		action: 'like',
	},
}

export const Share: Story = {
	args: {
		variant: 'card',
		action: 'share',
	},
}

export const Follow: Story = {
	args: {
		variant: 'card',
		action: 'follow',
	},
}

export const CustomMessage: Story = {
	args: {
		variant: 'card',
		message: 'Sign up to access all features',
	},
}
