import type { Meta, StoryObj } from '@storybook/react'

import { Badge } from './Badge'

const meta = {
	title: 'Base/Badge',
	component: Badge,
	parameters: {
		layout: 'centered',
	},
	tags: ['autodocs'],
	argTypes: {
		variant: {
			control: 'select',
			options: [
				'default',
				'primary',
				'secondary',
				'success',
				'warning',
				'error',
				'info',
				'outlined',
			],
		},
		size: {
			control: 'select',
			options: ['sm', 'md', 'lg'],
		},
		rounded: {
			control: 'boolean',
		},
	},
	args: {
		children: 'Badge',
	},
} satisfies Meta<typeof Badge>

export default meta
type Story = StoryObj<typeof Badge>

export const Default: Story = {
	args: {
		children: 'Badge',
	},
}

export const Primary: Story = {
	args: {
		variant: 'primary',
		children: 'Primary',
	},
}

export const Secondary: Story = {
	args: {
		variant: 'secondary',
		children: 'Secondary',
	},
}

export const Success: Story = {
	args: {
		variant: 'success',
		children: 'Success',
	},
}

export const Warning: Story = {
	args: {
		variant: 'warning',
		children: 'Warning',
	},
}

export const Error: Story = {
	args: {
		variant: 'error',
		children: 'Error',
	},
}

export const Info: Story = {
	args: {
		variant: 'info',
		children: 'Info',
	},
}

export const Outlined: Story = {
	args: {
		variant: 'outlined',
		children: 'Outlined',
	},
}

export const Small: Story = {
	args: {
		size: 'sm',
		children: 'Small',
	},
}

export const Medium: Story = {
	args: {
		size: 'md',
		children: 'Medium',
	},
}

export const Large: Story = {
	args: {
		size: 'lg',
		children: 'Large',
	},
}

export const Square: Story = {
	args: {
		rounded: false,
		children: 'Square',
	},
}

export const AllVariants: Story = {
	render: () => (
		<div className="flex flex-wrap gap-2">
			<Badge variant="default">Default</Badge>
			<Badge variant="primary">Primary</Badge>
			<Badge variant="secondary">Secondary</Badge>
			<Badge variant="success">Success</Badge>
			<Badge variant="warning">Warning</Badge>
			<Badge variant="error">Error</Badge>
			<Badge variant="info">Info</Badge>
			<Badge variant="outlined">Outlined</Badge>
		</div>
	),
	parameters: {
		layout: 'padded',
	},
}

export const AllSizes: Story = {
	render: () => (
		<div className="flex items-center gap-2">
			<Badge size="sm">Small</Badge>
			<Badge size="md">Medium</Badge>
			<Badge size="lg">Large</Badge>
		</div>
	),
	parameters: {
		layout: 'padded',
	},
}
