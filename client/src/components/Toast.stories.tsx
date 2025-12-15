import type { Meta, StoryObj } from '@storybook/react'
import React, { useState, useEffect } from 'react'

import { Toasts, type Toast } from './Toast'

// Interactive wrapper for Docs page
const InteractiveWrapper = (args: React.ComponentProps<typeof Toasts>) => {
	const [toasts, setToasts] = useState<Toast[]>([
		{
			id: 'doc-toast-1',
			message: 'This is a sample toast message for the Docs page',
			createdAt: new Date().toISOString(),
		},
	])

	// Keep toast visible by re-adding it if it gets dismissed
	useEffect(() => {
		if (toasts.length === 0) {
			// Use setTimeout to avoid synchronous setState in effect
			const timer = setTimeout(() => {
				setToasts([
					{
						id: 'doc-toast-1',
						message: 'This is a sample toast message for the Docs page',
						createdAt: new Date().toISOString(),
					},
				])
			}, 0)
			return () => clearTimeout(timer)
		}
	}, [toasts.length])

	const handleDismiss = (id: string) => {
		setToasts((prev) => prev.filter((t) => t.id !== id))
	}

	return (
		<div
			style={{
				position: 'relative',
				minHeight: '300px',
				height: '300px',
				width: '100%',
				overflow: 'visible',
			}}>
			<Toasts variant={args.variant} toasts={toasts} onDismiss={handleDismiss} />
		</div>
	)
}

const meta = {
	title: 'Components/Toast',
	component: Toasts,
	parameters: {
		layout: 'fullscreen',
		docs: {
			canvas: {
				height: '300px',
			},
		},
	},
	tags: ['autodocs'],
	render: InteractiveWrapper,
	args: {
		toasts: [],
		variant: 'success',
		onDismiss: () => {},
	},
	argTypes: {
		onDismiss: {
			control: false,
		},
	},
} satisfies Meta<typeof Toasts>

export default meta
type Story = StoryObj<typeof Toasts>

const ToastWrapper = ({ variant }: { variant: 'error' | 'success' }) => {
	const [toasts, setToasts] = useState<Toast[]>([{ id: '1', message: 'This is a toast message' }])

	const handleDismiss = (id: string) => {
		setToasts((prev) => prev.filter((t) => t.id !== id))
	}

	return (
		<div
			style={{
				position: 'relative',
				minHeight: '300px',
				height: '300px',
				width: '100%',
				overflow: 'visible',
			}}>
			<Toasts toasts={toasts} variant={variant} onDismiss={handleDismiss} />
		</div>
	)
}

export const Default: Story = {
	render: (args) => <InteractiveWrapper {...args} />,
	parameters: {
		docs: {
			story: {
				inline: true,
			},
		},
	},
}

export const Success: Story = {
	render: () => <ToastWrapper variant="success" />,
	parameters: {
		docs: {
			story: {
				inline: true,
			},
		},
	},
}

export const Error: Story = {
	render: () => <ToastWrapper variant="error" />,
	parameters: {
		docs: {
			story: {
				inline: true,
			},
		},
	},
}

const MultipleSuccessWrapper = () => {
	const [toasts, setToasts] = useState<Toast[]>([
		{ id: '1', message: 'Event created successfully' },
		{ id: '2', message: 'Profile updated' },
		{ id: '3', message: 'Settings saved' },
	])

	return (
		<div
			style={{
				position: 'relative',
				minHeight: '300px',
				height: '300px',
				width: '100%',
				overflow: 'visible',
			}}>
			<Toasts
				toasts={toasts}
				variant="success"
				onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
			/>
		</div>
	)
}

export const MultipleSuccess: Story = {
	render: () => <MultipleSuccessWrapper />,
	parameters: {
		docs: {
			story: {
				inline: true,
			},
		},
	},
}

const MultipleErrorWrapper = () => {
	const [toasts, setToasts] = useState<Toast[]>([
		{ id: '1', message: 'Failed to create event' },
		{ id: '2', message: 'Network error occurred' },
		{ id: '3', message: 'Invalid input provided' },
	])

	return (
		<div
			style={{
				position: 'relative',
				minHeight: '300px',
				height: '300px',
				width: '100%',
				overflow: 'visible',
			}}>
			<Toasts
				toasts={toasts}
				variant="error"
				onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
			/>
		</div>
	)
}

export const MultipleError: Story = {
	render: () => <MultipleErrorWrapper />,
	parameters: {
		docs: {
			story: {
				inline: true,
			},
		},
	},
}

const LongMessageWrapper = () => {
	const [toasts, setToasts] = useState<Toast[]>([
		{
			id: '1',
			message:
				'This is a very long toast message that demonstrates how the component handles longer text content that might wrap to multiple lines.',
		},
	])

	return (
		<div
			style={{
				position: 'relative',
				minHeight: '300px',
				height: '300px',
				width: '100%',
				overflow: 'visible',
			}}>
			<Toasts
				toasts={toasts}
				variant="success"
				onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
			/>
		</div>
	)
}

export const LongMessage: Story = {
	render: () => <LongMessageWrapper />,
	parameters: {
		docs: {
			story: {
				inline: true,
			},
		},
	},
}
