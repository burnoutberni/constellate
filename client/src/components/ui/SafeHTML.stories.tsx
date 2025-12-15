import type { Meta, StoryObj } from '@storybook/react'

import { SafeHTML } from './SafeHTML'

const meta = {
	title: 'Base/SafeHTML',
	component: SafeHTML,
	parameters: {
		layout: 'padded',
		docs: {
			description: {
				component:
					'SafeHTML component renders HTML content after sanitizing it with DOMPurify to prevent XSS attacks. Only safe HTML tags and attributes are allowed.',
			},
		},
	},
	tags: ['autodocs'],
	argTypes: {
		html: {
			control: 'text',
			description: 'HTML content to safely render',
		},
		className: {
			control: 'text',
			description: 'Additional CSS classes to apply to the container',
		},
		tag: {
			control: 'select',
			options: ['div', 'span', 'p', 'section', 'article'],
			description: 'HTML tag to use as the container',
		},
	},
	args: {
		html: '<p>Hello <strong>world</strong>!</p>',
	},
} satisfies Meta<typeof SafeHTML>

export default meta
type Story = StoryObj<typeof SafeHTML>

export const Default: Story = {
	args: {
		html: '<p>Hello <strong>world</strong>!</p>',
	},
}

export const BasicFormatting: Story = {
	args: {
		html: '<p>This is <strong>bold</strong>, <em>italic</em>, and <u>underlined</u> text.</p>',
	},
}

export const Headings: Story = {
	render: () => (
		<div className="space-y-4">
			<SafeHTML html="<h1>Heading 1</h1>" />
			<SafeHTML html="<h2>Heading 2</h2>" />
			<SafeHTML html="<h3>Heading 3</h3>" />
			<SafeHTML html="<h4>Heading 4</h4>" />
		</div>
	),
}

export const Lists: Story = {
	render: () => (
		<div className="space-y-4">
			<SafeHTML
				html="<ul><li>Unordered list item 1</li><li>Unordered list item 2</li><li>Unordered list item 3</li></ul>"
			/>
			<SafeHTML
				html="<ol><li>Ordered list item 1</li><li>Ordered list item 2</li><li>Ordered list item 3</li></ol>"
			/>
		</div>
	),
}

export const Links: Story = {
	render: () => (
		<div className="space-y-2">
			<SafeHTML html='<p>Visit <a href="https://example.com">Example.com</a> for more info.</p>' />
			<SafeHTML
				html='<p>Email us at <a href="mailto:contact@example.com">contact@example.com</a></p>'
			/>
			<p className="text-sm text-gray-500 mt-4">
				Note: External links automatically get rel="noopener noreferrer" for security.
			</p>
		</div>
	),
}

export const CodeBlocks: Story = {
	render: () => (
		<div className="space-y-4">
			<SafeHTML html="<p>Use <code>console.log()</code> to debug.</p>" />
			<SafeHTML
				html='<pre><code>function hello() {\n  console.log("Hello, world!");\n}</code></pre>'
			/>
		</div>
	),
}

export const Blockquotes: Story = {
	args: {
		html: '<blockquote>This is a blockquote. It can contain <strong>formatted</strong> text.</blockquote>',
	},
}

export const ComplexContent: Story = {
	args: {
		html: `
			<div>
				<h2>Event Description</h2>
				<p>Join us for an amazing <strong>conference</strong> featuring:</p>
				<ul>
					<li>Keynote <em>speakers</em></li>
					<li>Networking sessions</li>
					<li>Workshops and <a href="https://example.com">more info</a></li>
				</ul>
				<p>Don't miss out!</p>
			</div>
		`,
	},
}

export const XSSProtection: Story = {
	render: () => (
		<div className="space-y-4">
			<div>
				<p className="text-sm font-semibold mb-2">Dangerous content is stripped:</p>
				<SafeHTML
					html='<p>Safe content</p><script>alert("XSS")</script><p>More safe content</p>'
				/>
				<p className="text-xs text-gray-500 mt-2">
					The {'<script>'} tag was removed - check the rendered output above.
				</p>
			</div>
			<div>
				<p className="text-sm font-semibold mb-2">Iframes are blocked:</p>
				<SafeHTML
					html='<p>Safe content</p><iframe src="evil.com"></iframe><p>More safe content</p>'
				/>
				<p className="text-xs text-gray-500 mt-2">
					The {'<iframe>'} tag was removed for security.
				</p>
			</div>
			<div>
				<p className="text-sm font-semibold mb-2">Event handlers are removed:</p>
				<SafeHTML html={'<p onclick="alert(\\\'XSS\\\')">Click me (no alert will fire)</p>'} />
				<p className="text-xs text-gray-500 mt-2">
					The onclick attribute was stripped from the paragraph tag.
				</p>
			</div>
		</div>
	),
	parameters: {
		docs: {
			description: {
				story:
					'SafeHTML protects against XSS attacks by stripping dangerous tags and attributes. Scripts, iframes, and event handlers are automatically removed.',
			},
		},
	},
}

export const EmptyContent: Story = {
	args: {
		html: '',
	},
	parameters: {
		docs: {
			description: {
				story: 'When html is empty or null, the component returns null and renders nothing.',
			},
		},
	},
}

export const WithCustomTag: Story = {
	args: {
		html: '<p>This content is rendered in a <code>&lt;span&gt;</code> tag instead of the default <code>&lt;div&gt;</code>.</p>',
		tag: 'span',
	},
}

export const WithCustomClassName: Story = {
	args: {
		html: '<p>This content has custom styling applied via className.</p>',
		className: 'text-lg text-blue-600 font-semibold',
	},
}

