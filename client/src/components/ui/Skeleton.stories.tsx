import type { Meta, StoryObj } from '@storybook/react'
import { Skeleton } from './Skeleton'

const meta = {
	title: 'Base/Skeleton',
	component: Skeleton,
	parameters: {
		layout: 'centered',
	},
	tags: ['autodocs'],
} satisfies Meta<typeof Skeleton>

export default meta
type Story = StoryObj<typeof Skeleton>

export const Default: Story = {
	args: {
		className: 'h-4 w-32',
	},
}

export const Text: Story = {
	render: () => (
		<div className="space-y-2 w-64">
			<Skeleton className="h-4 w-full" />
			<Skeleton className="h-4 w-3/4" />
			<Skeleton className="h-4 w-1/2" />
		</div>
	),
	parameters: {
		layout: 'padded',
	},
}

export const Avatar: Story = {
	render: () => <Skeleton className="h-12 w-12 rounded-full" />,
	parameters: {
		layout: 'padded',
	},
}

export const Button: Story = {
	render: () => <Skeleton className="h-10 w-24 rounded-lg" />,
	parameters: {
		layout: 'padded',
	},
}

export const Card: Story = {
	render: () => (
		<div className="w-64 space-y-3">
			<Skeleton className="h-32 w-full rounded-lg" />
			<Skeleton className="h-4 w-full" />
			<Skeleton className="h-4 w-3/4" />
		</div>
	),
	parameters: {
		layout: 'padded',
	},
}

export const CardList: Story = {
	render: () => (
		<div className="space-y-4 w-80">
			{[1, 2, 3].map((i) => (
				<div key={i} className="flex gap-4">
					<Skeleton className="h-16 w-16 rounded-lg flex-shrink-0" />
					<div className="flex-1 space-y-2">
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-2/3" />
					</div>
				</div>
			))}
		</div>
	),
	parameters: {
		layout: 'padded',
	},
}

export const Table: Story = {
	render: () => (
		<div className="w-full space-y-2">
			<div className="flex gap-2">
				<Skeleton className="h-10 flex-1" />
				<Skeleton className="h-10 flex-1" />
				<Skeleton className="h-10 flex-1" />
			</div>
			{[1, 2, 3, 4].map((i) => (
				<div key={i} className="flex gap-2">
					<Skeleton className="h-12 flex-1" />
					<Skeleton className="h-12 flex-1" />
					<Skeleton className="h-12 flex-1" />
				</div>
			))}
		</div>
	),
	parameters: {
		layout: 'padded',
	},
}
