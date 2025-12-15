import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { CommentForm } from './CommentForm'

const queryClient = new QueryClient({
	defaultOptions: {
		queries: { retry: false },
		mutations: { retry: false },
	},
})

const meta = {
	title: 'Components/CommentForm',
	component: CommentForm,
	parameters: {
		layout: 'padded',
	},
	tags: ['autodocs'],
	decorators: [
		(Story) => (
			<QueryClientProvider client={queryClient}>
				<Story />
			</QueryClientProvider>
		),
	],
} satisfies Meta<typeof CommentForm>

export default meta
type Story = StoryObj<typeof CommentForm>

export const Default: Story = {
	args: {
		onSubmit: async (_content) => {
			await new Promise((resolve) => setTimeout(resolve, 1000))
		},
	},
}

export const WithPlaceholder: Story = {
	args: {
		placeholder: 'Write your comment here...',
		onSubmit: async (_content) => {
			// Submit handler
		},
	},
}

export const WithInitialValue: Story = {
	args: {
		initialValue: 'This is a pre-filled comment',
		onSubmit: async (_content) => {
			// Submit handler
		},
	},
}

export const CustomLabel: Story = {
	args: {
		submitLabel: 'Reply',
		onSubmit: async (_content) => {
			// Submit handler
		},
	},
}

export const WithCancel: Story = {
	args: {
		onSubmit: async (_content) => {
			// Submit handler
		},
		onCancel: () => {
			// Cancel handler
		},
	},
}

export const Submitting: Story = {
	args: {
		isSubmitting: true,
		onSubmit: async (_content) => {
			await new Promise((resolve) => setTimeout(resolve, 2000))
		},
	},
}

export const AutoFocus: Story = {
	args: {
		autoFocus: true,
		onSubmit: async (_content) => {
			// Submit handler
		},
	},
}
