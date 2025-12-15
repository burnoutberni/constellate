import type { Meta, StoryObj } from '@storybook/react'

import { EyeIcon, SearchIcon } from '@/components/ui'

import { Input } from './Input'

const meta = {
	title: 'Base/Input',
	component: Input,
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
		type: {
			control: 'select',
			options: ['text', 'email', 'password', 'number', 'tel', 'url'],
		},
	},
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof Input>

export const Default: Story = {
	args: {
		placeholder: 'Enter text...',
	},
	parameters: {
		layout: 'padded',
	},
}

export const WithLabel: Story = {
	args: {
		label: 'Email Address',
		placeholder: 'you@example.com',
		type: 'email',
	},
	parameters: {
		layout: 'padded',
	},
}

export const WithHelperText: Story = {
	args: {
		label: 'Username',
		helperText: 'Choose a unique username',
		placeholder: 'johndoe',
	},
	parameters: {
		layout: 'padded',
	},
}

export const WithError: Story = {
	args: {
		label: 'Email',
		error: true,
		errorMessage: 'Please enter a valid email address',
		placeholder: 'invalid-email',
	},
	parameters: {
		layout: 'padded',
	},
}

export const Required: Story = {
	args: {
		label: 'Password',
		required: true,
		type: 'password',
		placeholder: 'Enter password',
	},
	parameters: {
		layout: 'padded',
	},
}

export const Small: Story = {
	args: {
		size: 'sm',
		placeholder: 'Small input',
	},
	parameters: {
		layout: 'padded',
	},
}

export const Medium: Story = {
	args: {
		size: 'md',
		placeholder: 'Medium input',
	},
	parameters: {
		layout: 'padded',
	},
}

export const Large: Story = {
	args: {
		size: 'lg',
		placeholder: 'Large input',
	},
	parameters: {
		layout: 'padded',
	},
}

export const Disabled: Story = {
	args: {
		label: 'Disabled Input',
		value: 'Cannot edit this',
		disabled: true,
	},
	parameters: {
		layout: 'padded',
	},
}

export const WithLeftIcon: Story = {
	args: {
		label: 'Search',
		leftIcon: <SearchIcon />,
		placeholder: 'Search...',
	},
	parameters: {
		layout: 'padded',
	},
}

export const WithRightIcon: Story = {
	args: {
		label: 'Password',
		type: 'password',
		rightIcon: <EyeIcon />,
		placeholder: 'Enter password',
	},
	parameters: {
		layout: 'padded',
	},
}

export const FullWidth: Story = {
	args: {
		label: 'Full Width Input',
		fullWidth: true,
		placeholder: 'This input takes full width',
	},
	parameters: {
		layout: 'padded',
	},
}

export const AllSizes: Story = {
	render: () => (
		<div className="flex flex-col gap-4 w-64">
			<Input size="sm" placeholder="Small input" />
			<Input size="md" placeholder="Medium input" />
			<Input size="lg" placeholder="Large input" />
		</div>
	),
	parameters: {
		layout: 'padded',
	},
}
