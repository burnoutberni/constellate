import type { Meta, StoryObj } from '@storybook/react'

import { Button } from '../ui'

import { PageLayout } from './PageLayout'

const meta = {
	title: 'Layout/PageLayout',
	component: PageLayout,
	parameters: {
		layout: 'fullscreen',
	},
	tags: ['autodocs'],
	args: {
		children: (
			<div>
				<h2 className="text-2xl font-bold mb-4">Main Content</h2>
				<p>This is the main content area of the page layout.</p>
			</div>
		),
	},
} satisfies Meta<typeof PageLayout>

export default meta
type Story = StoryObj<typeof PageLayout>

const MockHeader = () => (
	<header className="bg-background-primary border-b border-border-default p-4">
		<div className="flex items-center justify-between">
			<h1 className="text-xl font-bold">Header</h1>
			<nav className="flex gap-2">
				<Button variant="ghost" size="sm">
					Home
				</Button>
				<Button variant="ghost" size="sm">
					About
				</Button>
			</nav>
		</div>
	</header>
)

const MockFooter = () => (
	<footer className="bg-background-secondary border-t border-border-default p-4 text-center text-sm text-text-secondary">
		Footer content
	</footer>
)

const MockSidebar = () => (
	<aside className="w-64 bg-background-secondary border-r border-border-default p-4">
		<h2 className="font-semibold mb-4">Sidebar</h2>
		<nav className="space-y-2">
			<Button variant="ghost" size="sm" className="w-full justify-start">
				Link 1
			</Button>
			<Button variant="ghost" size="sm" className="w-full justify-start">
				Link 2
			</Button>
			<Button variant="ghost" size="sm" className="w-full justify-start">
				Link 3
			</Button>
		</nav>
	</aside>
)

export const Basic: Story = {
	args: {
		children: (
			<div>
				<h2 className="text-2xl font-bold mb-4">Main Content</h2>
				<p>This is the main content area of the page layout.</p>
			</div>
		),
	},
}

export const WithHeader: Story = {
	args: {
		header: <MockHeader />,
		children: (
			<div>
				<h2 className="text-2xl font-bold mb-4">Main Content</h2>
				<p>This page layout includes a header.</p>
			</div>
		),
	},
}

export const WithHeaderAndFooter: Story = {
	args: {
		header: <MockHeader />,
		footer: <MockFooter />,
		children: (
			<div>
				<h2 className="text-2xl font-bold mb-4">Main Content</h2>
				<p>This page layout includes both a header and footer.</p>
			</div>
		),
	},
}

export const WithLeftSidebar: Story = {
	args: {
		header: <MockHeader />,
		sidebar: <MockSidebar />,
		sidebarPosition: 'left',
		children: (
			<div>
				<h2 className="text-2xl font-bold mb-4">Main Content</h2>
				<p>This page layout includes a left sidebar.</p>
			</div>
		),
	},
}

export const WithRightSidebar: Story = {
	args: {
		header: <MockHeader />,
		sidebar: <MockSidebar />,
		sidebarPosition: 'right',
		children: (
			<div>
				<h2 className="text-2xl font-bold mb-4">Main Content</h2>
				<p>This page layout includes a right sidebar.</p>
			</div>
		),
	},
}

export const FullLayout: Story = {
	args: {
		header: <MockHeader />,
		footer: <MockFooter />,
		sidebar: <MockSidebar />,
		sidebarPosition: 'left',
		children: (
			<div>
				<h2 className="text-2xl font-bold mb-4">Main Content</h2>
				<p>This is a complete page layout with header, footer, and sidebar.</p>
			</div>
		),
	},
}

export const NotContained: Story = {
	args: {
		header: <MockHeader />,
		contained: false,
		children: (
			<div className="px-4">
				<h2 className="text-2xl font-bold mb-4">Full Width Content</h2>
				<p>This content is not contained and spans the full width.</p>
			</div>
		),
	},
}

export const CustomContainerSize: Story = {
	args: {
		header: <MockHeader />,
		containerSize: 'sm',
		children: (
			<div>
				<h2 className="text-2xl font-bold mb-4">Small Container</h2>
				<p>This page layout uses a small container size.</p>
			</div>
		),
	},
}
