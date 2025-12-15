import type { Meta, StoryObj } from '@storybook/react'

import { AddIcon, ArrowRightIcon } from '@/components/ui'

import { Button } from './Button'

const meta = {
	title: 'Base/Button',
	component: Button,
	parameters: {
		layout: 'centered',
	},
	tags: ['autodocs'],
	argTypes: {
		variant: {
			control: 'select',
			options: ['primary', 'secondary', 'ghost', 'danger'],
		},
		size: {
			control: 'select',
			options: ['sm', 'md', 'lg'],
		},
		loading: {
			control: 'boolean',
		},
		fullWidth: {
			control: 'boolean',
		},
		disabled: {
			control: 'boolean',
		},
	},
	args: {
		children: 'Button',
	},
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof Button>

export const Primary: Story = {
	args: {
		variant: 'primary',
		children: 'Button',
	},
}

export const Secondary: Story = {
	args: {
		variant: 'secondary',
		children: 'Button',
	},
}

export const Ghost: Story = {
	args: {
		variant: 'ghost',
		children: 'Button',
	},
}

export const Danger: Story = {
	args: {
		variant: 'danger',
		children: 'Delete',
	},
}

export const Small: Story = {
	args: {
		size: 'sm',
		children: 'Small Button',
	},
}

export const Medium: Story = {
	args: {
		size: 'md',
		children: 'Medium Button',
	},
}

export const Large: Story = {
	args: {
		size: 'lg',
		children: 'Large Button',
	},
}

export const Loading: Story = {
	args: {
		loading: true,
		children: 'Loading...',
	},
}

export const Disabled: Story = {
	args: {
		disabled: true,
		children: 'Disabled',
	},
}

export const FullWidth: Story = {
	args: {
		fullWidth: true,
		children: 'Full Width Button',
	},
	parameters: {
		layout: 'padded',
	},
}

export const WithLeftIcon: Story = {
	args: {
		leftIcon: <AddIcon />,
		children: 'Add Item',
	},
}

export const WithRightIcon: Story = {
	args: {
		rightIcon: <ArrowRightIcon />,
		children: 'Continue',
	},
}

export const AllVariants: Story = {
	args: {
		children: 'Button',
	},
	render: () => (
		<div className="flex flex-col gap-4">
			<div className="flex gap-2">
				<Button variant="primary">Primary</Button>
				<Button variant="secondary">Secondary</Button>
				<Button variant="ghost">Ghost</Button>
				<Button variant="danger">Danger</Button>
			</div>
			<div className="flex gap-2">
				<Button size="sm">Small</Button>
				<Button size="md">Medium</Button>
				<Button size="lg">Large</Button>
			</div>
			<div className="flex gap-2">
				<Button loading>Loading</Button>
				<Button disabled>Disabled</Button>
			</div>
		</div>
	),
	parameters: {
		layout: 'padded',
	},
}
