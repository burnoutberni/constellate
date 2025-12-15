import type { Meta, StoryObj } from '@storybook/react'
import { useRef, useEffect } from 'react'

import { useUIStore } from '@/stores'

import { Toasts } from './Toast'

// Interactive preview for Docs page
const DocsWrapper = () => {
	const addToast = useUIStore((state) => state.addToast)
	const dismissToast = useUIStore((state) => state.dismissToast)
	const initialized = useRef(false)

	// Set up toasts in useEffect to ensure component has subscribed to store
	useEffect(() => {
		if (!initialized.current) {
			const store = useUIStore.getState()

			// Clear existing toasts first
			store.toasts.forEach((t) => {
				dismissToast(t.id)
			})

			// Add mock toasts for Docs page
			addToast({
				id: 'doc-success-1',
				message: 'Event created successfully',
				variant: 'success',
			})
			addToast({
				id: 'doc-error-1',
				message: 'Failed to save changes',
				variant: 'error',
			})
			initialized.current = true
		}
	}, [addToast, dismissToast])

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
	const addToast = useUIStore((state) => state.addToast)
	const dismissToast = useUIStore((state) => state.dismissToast)
	const initialized = useRef(false)

	useEffect(() => {
		if (!initialized.current) {
			const store = useUIStore.getState()

			// Clear existing toasts first
			store.toasts.forEach((t) => {
				dismissToast(t.id)
			})

			// Add success toast
			addToast({
				id: 'success-1',
				message: 'Operation completed successfully',
				variant: 'success',
			})
			initialized.current = true
		}
	}, [addToast, dismissToast])

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
	const addToast = useUIStore((state) => state.addToast)
	const dismissToast = useUIStore((state) => state.dismissToast)
	const initialized = useRef(false)

	useEffect(() => {
		if (!initialized.current) {
			const store = useUIStore.getState()

			// Clear existing toasts first
			store.toasts.forEach((t) => {
				dismissToast(t.id)
			})

			// Add error toast
			addToast({
				id: 'error-1',
				message: 'An error occurred while processing your request',
				variant: 'error',
			})
			initialized.current = true
		}
	}, [addToast, dismissToast])

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
	const addToast = useUIStore((state) => state.addToast)
	const dismissToast = useUIStore((state) => state.dismissToast)
	const initialized = useRef(false)

	useEffect(() => {
		if (!initialized.current) {
			const store = useUIStore.getState()

			// Clear existing toasts first
			store.toasts.forEach((t) => {
				dismissToast(t.id)
			})

			// Add multiple success toasts
			addToast({
				id: 'success-1',
				message: 'Event created successfully',
				variant: 'success',
			})
			addToast({
				id: 'success-2',
				message: 'Profile updated',
				variant: 'success',
			})
			addToast({
				id: 'success-3',
				message: 'Settings saved',
				variant: 'success',
			})
			initialized.current = true
		}
	}, [addToast, dismissToast])

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
	const addToast = useUIStore((state) => state.addToast)
	const dismissToast = useUIStore((state) => state.dismissToast)
	const initialized = useRef(false)

	useEffect(() => {
		if (!initialized.current) {
			const store = useUIStore.getState()

			// Clear existing toasts first
			store.toasts.forEach((t) => {
				dismissToast(t.id)
			})

			// Add multiple error toasts
			addToast({
				id: 'error-1',
				message: 'Failed to create event',
				variant: 'error',
			})
			addToast({
				id: 'error-2',
				message: 'Network error occurred',
				variant: 'error',
			})
			addToast({
				id: 'error-3',
				message: 'Invalid input provided',
				variant: 'error',
			})
			initialized.current = true
		}
	}, [addToast, dismissToast])

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
	const addToast = useUIStore((state) => state.addToast)
	const dismissToast = useUIStore((state) => state.dismissToast)
	const initialized = useRef(false)

	useEffect(() => {
		if (!initialized.current) {
			const store = useUIStore.getState()

			// Clear existing toasts first
			store.toasts.forEach((t) => {
				dismissToast(t.id)
			})

			// Add mixed toasts
			addToast({
				id: 'success-1',
				message: 'Event created successfully',
				variant: 'success',
			})
			addToast({
				id: 'error-1',
				message: 'Failed to send notification',
				variant: 'error',
			})
			addToast({
				id: 'success-2',
				message: 'Settings saved',
				variant: 'success',
			})
			initialized.current = true
		}
	}, [addToast, dismissToast])

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
	const addToast = useUIStore((state) => state.addToast)
	const dismissToast = useUIStore((state) => state.dismissToast)
	const initialized = useRef(false)

	useEffect(() => {
		if (!initialized.current) {
			const store = useUIStore.getState()

			// Clear existing toasts first
			store.toasts.forEach((t) => {
				dismissToast(t.id)
			})

			// Add toast with long message
			addToast({
				id: 'success-1',
				message:
					'This is a very long toast message that demonstrates how the component handles longer text content that might wrap to multiple lines.',
				variant: 'success',
			})
			initialized.current = true
		}
	}, [addToast, dismissToast])

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
