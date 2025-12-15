import type { Meta, StoryObj } from '@storybook/react'
import React, { useState } from 'react'

import { GridViewIcon, ListViewIcon } from '@/components/ui'

import { ToggleGroup, ToggleButton } from './ToggleGroup'

const meta = {
	title: 'Base/ToggleGroup',
	component: ToggleGroup,
	parameters: {
		layout: 'centered',
	},
	tags: ['autodocs'],
	args: {
		value: null,
		onValueChange: () => {},
		children: [],
	},
	argTypes: {
		value: {
			control: false,
		},
		onValueChange: {
			control: false,
		},
	},
} satisfies Meta<typeof ToggleGroup>

export default meta
type Story = StoryObj<typeof ToggleGroup>

const ToggleGroupWrapper = ({
	children,
	...props
}: Omit<React.ComponentProps<typeof ToggleGroup>, 'value' | 'onValueChange'>) => {
	const [value, setValue] = useState<string | null>(null)
	return (
		<ToggleGroup {...props} value={value} onValueChange={setValue}>
			{children}
		</ToggleGroup>
	)
}

export const Default: Story = {
	render: () => (
		<ToggleGroupWrapper>
			<ToggleButton value="option1">Option 1</ToggleButton>
			<ToggleButton value="option2">Option 2</ToggleButton>
			<ToggleButton value="option3">Option 3</ToggleButton>
		</ToggleGroupWrapper>
	),
	parameters: {
		layout: 'padded',
	},
}

export const WithIcons: Story = {
	render: () => (
		<ToggleGroupWrapper>
			<ToggleButton value="grid" icon={<GridViewIcon />} />
			<ToggleButton value="list" icon={<ListViewIcon />} />
		</ToggleGroupWrapper>
	),
	parameters: {
		layout: 'padded',
	},
}

export const WithTextAndIcons: Story = {
	render: () => (
		<ToggleGroupWrapper>
			<ToggleButton value="grid" icon={<GridViewIcon />}>
				Grid
			</ToggleButton>
			<ToggleButton value="list" icon={<ListViewIcon />}>
				List
			</ToggleButton>
		</ToggleGroupWrapper>
	),
	parameters: {
		layout: 'padded',
	},
}

export const MultipleOptions: Story = {
	render: () => (
		<ToggleGroupWrapper>
			<ToggleButton value="all">All</ToggleButton>
			<ToggleButton value="active">Active</ToggleButton>
			<ToggleButton value="pending">Pending</ToggleButton>
			<ToggleButton value="completed">Completed</ToggleButton>
		</ToggleGroupWrapper>
	),
	parameters: {
		layout: 'padded',
	},
}

const WithDefaultValueWrapper = () => {
	const [value, setValue] = useState<string | null>('option2')
	return (
		<ToggleGroup value={value} onValueChange={setValue}>
			<ToggleButton value="option1">Option 1</ToggleButton>
			<ToggleButton value="option2">Option 2</ToggleButton>
			<ToggleButton value="option3">Option 3</ToggleButton>
		</ToggleGroup>
	)
}

export const WithDefaultValue: Story = {
	render: () => <WithDefaultValueWrapper />,
	parameters: {
		layout: 'padded',
	},
}
