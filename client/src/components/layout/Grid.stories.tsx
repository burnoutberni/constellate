import type { Meta, StoryObj } from '@storybook/react'
import { Grid } from './Grid'
import { Card } from '../ui'

const meta = {
	title: 'Layout/Grid',
	component: Grid,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
} satisfies Meta<typeof Grid>

export default meta
type Story = StoryObj<typeof Grid>

const SampleCard = ({ children }: { children: React.ReactNode }) => (
	<Card padding="md" className="bg-primary-50 dark:bg-primary-950/20">
		{children}
	</Card>
)

export const OneColumn: Story = {
	args: {
		cols: 1,
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

export const TwoColumns: Story = {
	args: {
		cols: 2,
		gap: 'md',
		children: (
			<>
				<SampleCard>Item 1</SampleCard>
				<SampleCard>Item 2</SampleCard>
				<SampleCard>Item 3</SampleCard>
				<SampleCard>Item 4</SampleCard>
			</>
		),
	},
}

export const ThreeColumns: Story = {
	args: {
		cols: 3,
		gap: 'md',
		children: (
			<>
				<SampleCard>Item 1</SampleCard>
				<SampleCard>Item 2</SampleCard>
				<SampleCard>Item 3</SampleCard>
				<SampleCard>Item 4</SampleCard>
				<SampleCard>Item 5</SampleCard>
				<SampleCard>Item 6</SampleCard>
			</>
		),
	},
}

export const Responsive: Story = {
	args: {
		cols: 1,
		colsSm: 2,
		colsMd: 3,
		colsLg: 4,
		gap: 'md',
		children: (
			<>
				<SampleCard>1 col mobile</SampleCard>
				<SampleCard>2 cols small</SampleCard>
				<SampleCard>3 cols medium</SampleCard>
				<SampleCard>4 cols large</SampleCard>
				<SampleCard>Item 5</SampleCard>
				<SampleCard>Item 6</SampleCard>
				<SampleCard>Item 7</SampleCard>
				<SampleCard>Item 8</SampleCard>
			</>
		),
	},
}

export const EqualHeight: Story = {
	args: {
		cols: 3,
		gap: 'md',
		equalHeight: true,
		children: (
			<>
				<SampleCard>
					<div>Short content</div>
				</SampleCard>
				<SampleCard>
					<div>
						This is longer content that will make this card taller than the others
					</div>
				</SampleCard>
				<SampleCard>
					<div>Medium content here</div>
				</SampleCard>
			</>
		),
	},
}

export const Gaps: Story = {
	render: () => (
		<div className="space-y-8">
			<div>
				<h3 className="mb-2 text-sm font-semibold">No gap</h3>
				<Grid cols={3} gap="none">
					<SampleCard>1</SampleCard>
					<SampleCard>2</SampleCard>
					<SampleCard>3</SampleCard>
				</Grid>
			</div>
			<div>
				<h3 className="mb-2 text-sm font-semibold">Small gap</h3>
				<Grid cols={3} gap="sm">
					<SampleCard>1</SampleCard>
					<SampleCard>2</SampleCard>
					<SampleCard>3</SampleCard>
				</Grid>
			</div>
			<div>
				<h3 className="mb-2 text-sm font-semibold">Medium gap</h3>
				<Grid cols={3} gap="md">
					<SampleCard>1</SampleCard>
					<SampleCard>2</SampleCard>
					<SampleCard>3</SampleCard>
				</Grid>
			</div>
			<div>
				<h3 className="mb-2 text-sm font-semibold">Large gap</h3>
				<Grid cols={3} gap="lg">
					<SampleCard>1</SampleCard>
					<SampleCard>2</SampleCard>
					<SampleCard>3</SampleCard>
				</Grid>
			</div>
			<div>
				<h3 className="mb-2 text-sm font-semibold">Extra large gap</h3>
				<Grid cols={3} gap="xl">
					<SampleCard>1</SampleCard>
					<SampleCard>2</SampleCard>
					<SampleCard>3</SampleCard>
				</Grid>
			</div>
		</div>
	),
}
