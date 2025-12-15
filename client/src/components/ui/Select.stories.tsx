import type { Meta, StoryObj } from '@storybook/react'
import { Select } from './Select'

const meta = {
	title: 'Base/Select',
	component: Select,
	parameters: {
		layout: 'centered',
	},
	tags: ['autodocs'],
	args: {
		children: <option value="">Choose an option</option>,
	},
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
	},
} satisfies Meta<typeof Select>

export default meta
type Story = StoryObj<typeof Select>

export const Default: Story = {
	render: () => (
		<Select>
			<option value="">Choose an option</option>
			<option value="1">Option 1</option>
			<option value="2">Option 2</option>
			<option value="3">Option 3</option>
		</Select>
	),
	parameters: {
		layout: 'padded',
	},
}

export const WithLabel: Story = {
	render: () => (
		<Select label="Country">
			<option value="">Select a country</option>
			<option value="us">United States</option>
			<option value="uk">United Kingdom</option>
			<option value="ca">Canada</option>
		</Select>
	),
	parameters: {
		layout: 'padded',
	},
}

export const WithHelperText: Story = {
	render: () => (
		<Select label="Theme" helperText="Choose your preferred theme">
			<option value="">Select theme</option>
			<option value="light">Light</option>
			<option value="dark">Dark</option>
			<option value="auto">Auto</option>
		</Select>
	),
	parameters: {
		layout: 'padded',
	},
}

export const WithError: Story = {
	render: () => (
		<Select label="Country" error errorMessage="Please select a valid country">
			<option value="">Select a country</option>
			<option value="us">United States</option>
			<option value="uk">United Kingdom</option>
		</Select>
	),
	parameters: {
		layout: 'padded',
	},
}

export const Required: Story = {
	render: () => (
		<Select label="Country" required>
			<option value="">Select a country</option>
			<option value="us">United States</option>
			<option value="uk">United Kingdom</option>
		</Select>
	),
	parameters: {
		layout: 'padded',
	},
}

export const Small: Story = {
	render: () => (
		<Select size="sm">
			<option value="">Small select</option>
			<option value="1">Option 1</option>
		</Select>
	),
	parameters: {
		layout: 'padded',
	},
}

export const Medium: Story = {
	render: () => (
		<Select size="md">
			<option value="">Medium select</option>
			<option value="1">Option 1</option>
		</Select>
	),
	parameters: {
		layout: 'padded',
	},
}

export const Large: Story = {
	render: () => (
		<Select size="lg">
			<option value="">Large select</option>
			<option value="1">Option 1</option>
		</Select>
	),
	parameters: {
		layout: 'padded',
	},
}

export const Disabled: Story = {
	render: () => (
		<Select label="Disabled Select" disabled value="1">
			<option value="1">Option 1</option>
			<option value="2">Option 2</option>
		</Select>
	),
	parameters: {
		layout: 'padded',
	},
}

export const FullWidth: Story = {
	render: () => (
		<div className="w-64">
			<Select label="Full Width Select" fullWidth>
				<option value="">Choose an option</option>
				<option value="1">Option 1</option>
				<option value="2">Option 2</option>
			</Select>
		</div>
	),
	parameters: {
		layout: 'padded',
	},
}

export const AllSizes: Story = {
	render: () => (
		<div className="flex flex-col gap-4 w-64">
			<Select size="sm" label="Small">
				<option value="">Small</option>
				<option value="1">Option 1</option>
			</Select>
			<Select size="md" label="Medium">
				<option value="">Medium</option>
				<option value="1">Option 1</option>
			</Select>
			<Select size="lg" label="Large">
				<option value="">Large</option>
				<option value="1">Option 1</option>
			</Select>
		</div>
	),
	parameters: {
		layout: 'padded',
	},
}
