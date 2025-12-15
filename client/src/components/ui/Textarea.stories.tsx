import type { Meta, StoryObj } from '@storybook/react'
import { Textarea } from './Textarea'

const meta = {
	title: 'Base/Textarea',
	component: Textarea,
	parameters: {
		layout: 'centered',
	},
	tags: ['autodocs'],
	argTypes: {
		size: {
			control: 'select',
			options: ['sm', 'md', 'lg'],
		},
		error: {
			control: 'boolean',
		},
		fullWidth: {
			control: 'boolean',
		},
		disabled: {
			control: 'boolean',
		},
		rows: {
			control: 'number',
		},
	},
} satisfies Meta<typeof Textarea>

export default meta
type Story = StoryObj<typeof Textarea>

export const Default: Story = {
	args: {
		placeholder: 'Enter your message...',
	},
	parameters: {
		layout: 'padded',
	},
}

export const WithLabel: Story = {
	args: {
		label: 'Description',
		placeholder: 'Enter a description...',
	},
	parameters: {
		layout: 'padded',
	},
}

export const WithHelperText: Story = {
	args: {
		label: 'Bio',
		helperText: 'Tell us about yourself',
		placeholder: 'Write a short bio...',
	},
	parameters: {
		layout: 'padded',
	},
}

export const WithError: Story = {
	args: {
		label: 'Message',
		error: true,
		errorMessage: 'Message must be at least 10 characters',
		placeholder: 'Enter your message...',
	},
	parameters: {
		layout: 'padded',
	},
}

export const Required: Story = {
	args: {
		label: 'Comments',
		required: true,
		placeholder: 'Enter your comments...',
	},
	parameters: {
		layout: 'padded',
	},
}

export const Small: Story = {
	args: {
		size: 'sm',
		placeholder: 'Small textarea',
	},
	parameters: {
		layout: 'padded',
	},
}

export const Medium: Story = {
	args: {
		size: 'md',
		placeholder: 'Medium textarea',
	},
	parameters: {
		layout: 'padded',
	},
}

export const Large: Story = {
	args: {
		size: 'lg',
		placeholder: 'Large textarea',
	},
	parameters: {
		layout: 'padded',
	},
}

export const CustomRows: Story = {
	args: {
		label: 'Long Text',
		rows: 8,
		placeholder: 'Enter a longer message...',
	},
	parameters: {
		layout: 'padded',
	},
}

export const Disabled: Story = {
	args: {
		label: 'Disabled Textarea',
		value: 'This textarea is disabled',
		disabled: true,
	},
	parameters: {
		layout: 'padded',
	},
}

export const FullWidth: Story = {
	args: {
		label: 'Full Width Textarea',
		fullWidth: true,
		placeholder: 'This textarea takes full width',
	},
	parameters: {
		layout: 'padded',
	},
}

export const AllSizes: Story = {
	render: () => (
		<div className="flex flex-col gap-4 w-64">
			<Textarea size="sm" placeholder="Small textarea" />
			<Textarea size="md" placeholder="Medium textarea" />
			<Textarea size="lg" placeholder="Large textarea" />
		</div>
	),
	parameters: {
		layout: 'padded',
	},
}
