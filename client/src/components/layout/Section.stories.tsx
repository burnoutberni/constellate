import type { Meta, StoryObj } from '@storybook/react'

import { Section } from './Section'

const meta = {
	title: 'Layout/Section',
	component: Section,
	parameters: {
		layout: 'fullscreen',
	},
	tags: ['autodocs'],
} satisfies Meta<typeof Section>

export default meta
type Story = StoryObj<typeof Section>

export const Default: Story = {
	args: {
		children: (
			<div>
				<h2 className="text-2xl font-bold mb-4">Default Section</h2>
				<p>This is a default section with contained content and default padding.</p>
			</div>
		),
	},
}

export const Muted: Story = {
	args: {
		variant: 'muted',
		children: (
			<div>
				<h2 className="text-2xl font-bold mb-4">Muted Section</h2>
				<p>This section has a muted background variant.</p>
			</div>
		),
	},
}

export const Accent: Story = {
	args: {
		variant: 'accent',
		children: (
			<div>
				<h2 className="text-2xl font-bold mb-4">Accent Section</h2>
				<p>This section has an accent background variant.</p>
			</div>
		),
	},
}

export const PaddingSizes: Story = {
	render: () => (
		<div className="space-y-0">
			<Section padding="none" variant="default">
				<div className="border-b border-neutral-200 dark:border-neutral-700 pb-4">
					<h3 className="font-semibold mb-2">No padding</h3>
					<p>This section has no vertical padding.</p>
				</div>
			</Section>
			<Section padding="sm" variant="muted">
				<div className="border-b border-neutral-200 dark:border-neutral-700 pb-4">
					<h3 className="font-semibold mb-2">Small padding</h3>
					<p>This section has small vertical padding.</p>
				</div>
			</Section>
			<Section padding="md" variant="default">
				<div className="border-b border-neutral-200 dark:border-neutral-700 pb-4">
					<h3 className="font-semibold mb-2">Medium padding</h3>
					<p>This section has medium vertical padding.</p>
				</div>
			</Section>
			<Section padding="lg" variant="muted">
				<div className="border-b border-neutral-200 dark:border-neutral-700 pb-4">
					<h3 className="font-semibold mb-2">Large padding (default)</h3>
					<p>This section has large vertical padding.</p>
				</div>
			</Section>
			<Section padding="xl" variant="default">
				<div className="border-b border-neutral-200 dark:border-neutral-700 pb-4">
					<h3 className="font-semibold mb-2">Extra large padding</h3>
					<p>This section has extra large vertical padding.</p>
				</div>
			</Section>
			<Section padding="2xl" variant="muted">
				<div>
					<h3 className="font-semibold mb-2">2XL padding</h3>
					<p>This section has 2XL vertical padding.</p>
				</div>
			</Section>
		</div>
	),
}

export const NotContained: Story = {
	args: {
		contained: false,
		children: (
			<div className="px-4">
				<h2 className="text-2xl font-bold mb-4">Full Width Section</h2>
				<p>This section is not contained, so content spans full width.</p>
			</div>
		),
	},
}

export const CustomElement: Story = {
	args: {
		as: 'article',
		children: (
			<div>
				<h2 className="text-2xl font-bold mb-4">Article Section</h2>
				<p>This section is rendered as an article element.</p>
			</div>
		),
	},
}

export const CustomContainerSize: Story = {
	args: {
		containerSize: 'sm',
		children: (
			<div>
				<h2 className="text-2xl font-bold mb-4">Small Container</h2>
				<p>This section uses a small container size.</p>
			</div>
		),
	},
}

