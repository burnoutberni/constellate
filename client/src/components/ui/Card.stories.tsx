import type { Meta, StoryObj } from '@storybook/react'
import { Button } from './Button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './Card'

const meta = {
	title: 'Base/Card',
	component: Card,
	parameters: {
		layout: 'centered',
	},
	tags: ['autodocs'],
	argTypes: {
		variant: {
			control: 'select',
			options: ['default', 'outlined', 'elevated', 'flat'],
		},
		interactive: {
			control: 'boolean',
		},
		padding: {
			control: 'select',
			options: ['none', 'sm', 'md', 'lg'],
		},
	},
	args: {
		children: 'Card content',
	},
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof Card>

export const Default: Story = {
	args: {
		children: 'Card content goes here',
	},
	parameters: {
		layout: 'padded',
	},
}

export const Outlined: Story = {
	args: {
		variant: 'outlined',
		children: 'Outlined card content',
	},
	parameters: {
		layout: 'padded',
	},
}

export const Elevated: Story = {
	args: {
		variant: 'elevated',
		children: 'Elevated card with shadow',
	},
	parameters: {
		layout: 'padded',
	},
}

export const Flat: Story = {
	args: {
		variant: 'flat',
		children: 'Flat card with background',
	},
	parameters: {
		layout: 'padded',
	},
}

export const Interactive: Story = {
	args: {
		interactive: true,
		onClick: () => alert('Card clicked!'),
		children: 'Click me!',
	},
	parameters: {
		layout: 'padded',
	},
}

export const WithHeader: Story = {
	render: () => (
		<Card>
			<CardHeader>
				<CardTitle>Card Title</CardTitle>
			</CardHeader>
			<CardContent>
				<p>This is the card content area.</p>
			</CardContent>
		</Card>
	),
	parameters: {
		layout: 'padded',
	},
}

export const WithFooter: Story = {
	render: () => (
		<Card>
			<CardHeader>
				<CardTitle>Card with Footer</CardTitle>
			</CardHeader>
			<CardContent>
				<p>Card content with actions in the footer.</p>
			</CardContent>
			<CardFooter>
				<Button variant="secondary" size="sm">
					Cancel
				</Button>
				<Button size="sm">Confirm</Button>
			</CardFooter>
		</Card>
	),
	parameters: {
		layout: 'padded',
	},
}

export const AllVariants: Story = {
	render: () => (
		<div className="grid grid-cols-2 gap-4 max-w-2xl">
			<Card variant="default">
				<CardHeader>
					<CardTitle>Default</CardTitle>
				</CardHeader>
				<CardContent>Default card variant</CardContent>
			</Card>
			<Card variant="outlined">
				<CardHeader>
					<CardTitle>Outlined</CardTitle>
				</CardHeader>
				<CardContent>Outlined card variant</CardContent>
			</Card>
			<Card variant="elevated">
				<CardHeader>
					<CardTitle>Elevated</CardTitle>
				</CardHeader>
				<CardContent>Elevated card variant</CardContent>
			</Card>
			<Card variant="flat">
				<CardHeader>
					<CardTitle>Flat</CardTitle>
				</CardHeader>
				<CardContent>Flat card variant</CardContent>
			</Card>
		</div>
	),
	parameters: {
		layout: 'padded',
	},
}
