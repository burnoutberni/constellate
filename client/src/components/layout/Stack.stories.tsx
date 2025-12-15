import type { Meta, StoryObj } from '@storybook/react'
import { Stack } from './Stack'
import { Card } from '../ui'

const meta = {
	title: 'Layout/Stack',
	component: Stack,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
} satisfies Meta<typeof Stack>

export default meta
type Story = StoryObj<typeof Stack>

const SampleCard = ({ children }: { children: React.ReactNode }) => (
	<Card padding="md" className="bg-primary-50 dark:bg-primary-950/20">
		{children}
	</Card>
)

export const Column: Story = {
	args: {
		direction: 'column',
		gap: 'md',
		children: (
			<>
				<SampleCard>Item 1</SampleCard>
				<SampleCard>Item 2</SampleCard>
				<SampleCard>Item 3</SampleCard>
			</>
		),
	},
}

export const Row: Story = {
	args: {
		direction: 'row',
		gap: 'md',
		children: (
			<>
				<SampleCard>Item 1</SampleCard>
				<SampleCard>Item 2</SampleCard>
				<SampleCard>Item 3</SampleCard>
			</>
		),
	},
}

export const Responsive: Story = {
	args: {
		direction: 'column',
		directionMd: 'row',
		gap: 'md',
		children: (
			<>
				<SampleCard>Column on mobile, row on medium+</SampleCard>
				<SampleCard>Item 2</SampleCard>
				<SampleCard>Item 3</SampleCard>
			</>
		),
	},
}

export const AlignCenter: Story = {
	args: {
		direction: 'row',
		align: 'center',
		gap: 'md',
		children: (
			<>
				<SampleCard>Centered</SampleCard>
				<SampleCard>Items</SampleCard>
			</>
		),
	},
}

export const JustifyBetween: Story = {
	args: {
		direction: 'row',
		justify: 'between',
		gap: 'md',
		children: (
			<>
				<SampleCard>Left</SampleCard>
				<SampleCard>Right</SampleCard>
			</>
		),
	},
}

export const Gaps: Story = {
	render: () => (
		<div className="space-y-4">
			<Stack direction="row" gap="none">
				<SampleCard>No gap</SampleCard>
				<SampleCard>No gap</SampleCard>
			</Stack>
			<Stack direction="row" gap="xs">
				<SampleCard>XS gap</SampleCard>
				<SampleCard>XS gap</SampleCard>
			</Stack>
			<Stack direction="row" gap="sm">
				<SampleCard>SM gap</SampleCard>
				<SampleCard>SM gap</SampleCard>
			</Stack>
			<Stack direction="row" gap="md">
				<SampleCard>MD gap</SampleCard>
				<SampleCard>MD gap</SampleCard>
			</Stack>
			<Stack direction="row" gap="lg">
				<SampleCard>LG gap</SampleCard>
				<SampleCard>LG gap</SampleCard>
			</Stack>
			<Stack direction="row" gap="xl">
				<SampleCard>XL gap</SampleCard>
				<SampleCard>XL gap</SampleCard>
			</Stack>
		</div>
	),
}

export const Wrapped: Story = {
	args: {
		direction: 'row',
		wrap: true,
		gap: 'md',
		children: (
			<>
				<SampleCard>Item 1</SampleCard>
				<SampleCard>Item 2</SampleCard>
				<SampleCard>Item 3</SampleCard>
				<SampleCard>Item 4</SampleCard>
				<SampleCard>Item 5</SampleCard>
			</>
		),
	},
}
