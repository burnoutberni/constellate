import type { Meta, StoryObj } from '@storybook/react'
import { useRef, useEffect } from 'react'

import { useUIStore, type Toast } from '@/stores'

import { Toasts } from './Toast'

/**
 * Custom hook to set up toasts for Storybook stories.
 * Clears existing toasts and adds the provided toasts on mount.
 */
function useStoryToasts(toasts: Toast[]) {
	const addToast = useUIStore((state) => state.addToast)
	const clearToasts = useUIStore((state) => state.clearToasts)
	const initialized = useRef(false)
	// Store toasts in ref to capture initial value and avoid dependency issues
	const toastsRef = useRef(toasts)

	useEffect(() => {
		if (!initialized.current) {
			// Clear existing toasts first
			clearToasts()

			// Add provided toasts
			toastsRef.current.forEach((toast) => {
				addToast(toast)
			})

			initialized.current = true
		}
	}, [addToast, clearToasts])
}

/**
 * Wrapper component for toast stories that sets up toasts and renders the Toasts component.
 */
function ToastStoryWrapper({ toasts }: { toasts: Toast[] }) {
	useStoryToasts(toasts)

	return (
		<div
			style={{
				position: 'relative',
				minHeight: '300px',
				height: '300px',
				width: '100%',
				overflow: 'visible',
			}}>
			<Toasts />
		</div>
	)
}

// Interactive preview for Docs page
const DocsWrapper = () => {
	return (
		<ToastStoryWrapper
			toasts={[
				{
					id: 'doc-success-1',
					message: 'Event created successfully',
					variant: 'success',
				},
				{
					id: 'doc-error-1',
					message: 'Failed to save changes',
					variant: 'error',
				},
			]}
		/>
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
			story: {
				inline: false,
			},
		},
	},
	tags: ['autodocs'],
} satisfies Meta<typeof Toasts>

export default meta
type Story = StoryObj<typeof Toasts>

const SuccessToastWrapper = () => {
	return (
		<ToastStoryWrapper
			toasts={[
				{
					id: 'success-1',
					message: 'Operation completed successfully',
					variant: 'success',
				},
			]}
		/>
	)
}

export const Success: Story = {
	render: () => <SuccessToastWrapper />,
	parameters: {
		docs: {
			story: {
				inline: true,
			},
		},
	},
}

const ErrorToastWrapper = () => {
	return (
		<ToastStoryWrapper
			toasts={[
				{
					id: 'error-1',
					message: 'An error occurred while processing your request',
					variant: 'error',
				},
			]}
		/>
	)
}

export const Error: Story = {
	render: () => <ErrorToastWrapper />,
	parameters: {
		docs: {
			story: {
				inline: true,
			},
		},
	},
}

const MultipleSuccessWrapper = () => {
	return (
		<ToastStoryWrapper
			toasts={[
				{
					id: 'success-1',
					message: 'Event created successfully',
					variant: 'success',
				},
				{
					id: 'success-2',
					message: 'Profile updated',
					variant: 'success',
				},
				{
					id: 'success-3',
					message: 'Settings saved',
					variant: 'success',
				},
			]}
		/>
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
	return (
		<ToastStoryWrapper
			toasts={[
				{
					id: 'error-1',
					message: 'Failed to create event',
					variant: 'error',
				},
				{
					id: 'error-2',
					message: 'Network error occurred',
					variant: 'error',
				},
				{
					id: 'error-3',
					message: 'Invalid input provided',
					variant: 'error',
				},
			]}
		/>
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

const MixedToastsWrapper = () => {
	return (
		<ToastStoryWrapper
			toasts={[
				{
					id: 'success-1',
					message: 'Event created successfully',
					variant: 'success',
				},
				{
					id: 'error-1',
					message: 'Failed to send notification',
					variant: 'error',
				},
				{
					id: 'success-2',
					message: 'Settings saved',
					variant: 'success',
				},
			]}
		/>
	)
}

export const MixedToasts: Story = {
	render: () => <MixedToastsWrapper />,
	parameters: {
		docs: {
			story: {
				inline: true,
			},
		},
	},
}

const LongMessageWrapper = () => {
	return (
		<ToastStoryWrapper
			toasts={[
				{
					id: 'success-1',
					message:
						'This is a very long toast message that demonstrates how the component handles longer text content that might wrap to multiple lines.',
					variant: 'success',
				},
			]}
		/>
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

export const Default: Story = {
	render: DocsWrapper,
	parameters: {
		docs: {
			story: {
				inline: true,
			},
		},
	},
}
