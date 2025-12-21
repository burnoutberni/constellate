import type { Meta, StoryObj } from '@storybook/react'

import { SkipLink } from './SkipLink'

const meta = {
	title: 'Components/SkipLink',
	component: SkipLink,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'SkipLink provides an accessibility feature that allows keyboard users to skip navigation and jump directly to the main content. The link appears when focused and is hidden by default.',
			},
		},
	},
	tags: ['autodocs'],
	decorators: [
		(Story) => {
			// Ensure main content exists for the skip link to target
			if (!document.getElementById('main-content')) {
				const main = document.createElement('main')
				main.id = 'main-content'
				main.className = 'p-8'
				main.innerHTML =
					'<h1>Main Content</h1><p>This is the main content area that the skip link targets.</p>'
				document.body.appendChild(main)
			}
			return <Story />
		},
	],
} satisfies Meta<typeof SkipLink>

export default meta
type Story = StoryObj<typeof SkipLink>

export const Default: Story = {}

export const WithContent: Story = {
	decorators: [
		(Story) => (
			<div>
				<Story />
				<nav className="p-4 bg-gray-100">
					<h2>Navigation</h2>
					<ul>
						<li>
							<a href="#home">Home</a>
						</li>
						<li>
							<a href="#about">About</a>
						</li>
						<li>
							<a href="#contact">Contact</a>
						</li>
					</ul>
				</nav>
				<main id="main-content" className="p-8">
					<h1>Main Content</h1>
					<p>
						This is the main content area. When you focus the skip link (by pressing Tab
						when the page loads), you can click it or press Enter to jump directly here,
						skipping the navigation.
					</p>
					<p>
						This is especially useful for keyboard users and screen reader users who
						want to quickly access the main content without having to navigate through
						all the navigation links.
					</p>
				</main>
			</div>
		),
	],
}

