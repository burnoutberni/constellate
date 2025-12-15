import type { Meta, StoryObj } from '@storybook/react'
import { useRef, useEffect } from 'react'

import { useUIStore } from '@/stores'

import { Toasts } from './Toast'

// Interactive preview for Docs page
const DocsWrapper = () => {
	const addErrorToast = useUIStore((state) => state.addErrorToast)
	const addSuccessToast = useUIStore((state) => state.addSuccessToast)
	const dismissErrorToast = useUIStore((state) => state.dismissErrorToast)
	const dismissSuccessToast = useUIStore((state) => state.dismissSuccessToast)
	const initialized = useRef(false)

	// Set up toasts in useEffect to ensure component has subscribed to store
	useEffect(() => {
		if (!initialized.current) {
			const store = useUIStore.getState()

			// Clear existing toasts first
			store.errorToasts.forEach((t) => {
				dismissErrorToast(t.id)
			})
			store.successToasts.forEach((t) => {
				dismissSuccessToast(t.id)
			})

			// Add mock toasts for Docs page
			addSuccessToast({
				id: 'doc-success-1',
				message: 'Event created successfully',
			})
			addErrorToast({
				id: 'doc-error-1',
				message: 'Failed to save changes',
			})
			initialized.current = true
		}
	}, [addErrorToast, addSuccessToast, dismissErrorToast, dismissSuccessToast])

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
	const addSuccessToast = useUIStore((state) => state.addSuccessToast)
	const dismissSuccessToast = useUIStore((state) => state.dismissSuccessToast)
	const initialized = useRef(false)

	useEffect(() => {
		if (!initialized.current) {
			const store = useUIStore.getState()

			// Clear existing toasts first
			store.errorToasts.forEach((t) => {
				useUIStore.getState().dismissErrorToast(t.id)
			})
			store.successToasts.forEach((t) => {
				dismissSuccessToast(t.id)
			})

			// Add success toast
			addSuccessToast({
				id: 'success-1',
				message: 'Operation completed successfully',
			})
			initialized.current = true
		}
	}, [addSuccessToast, dismissSuccessToast])

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
	const addErrorToast = useUIStore((state) => state.addErrorToast)
	const dismissErrorToast = useUIStore((state) => state.dismissErrorToast)
	const initialized = useRef(false)

	useEffect(() => {
		if (!initialized.current) {
			const store = useUIStore.getState()

			// Clear existing toasts first
			store.errorToasts.forEach((t) => {
				dismissErrorToast(t.id)
			})
			store.successToasts.forEach((t) => {
				useUIStore.getState().dismissSuccessToast(t.id)
			})

			// Add error toast
			addErrorToast({
				id: 'error-1',
				message: 'An error occurred while processing your request',
			})
			initialized.current = true
		}
	}, [addErrorToast, dismissErrorToast])

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
	const addSuccessToast = useUIStore((state) => state.addSuccessToast)
	const dismissSuccessToast = useUIStore((state) => state.dismissSuccessToast)
	const initialized = useRef(false)

	useEffect(() => {
		if (!initialized.current) {
			const store = useUIStore.getState()

			// Clear existing toasts first
			store.errorToasts.forEach((t) => {
				useUIStore.getState().dismissErrorToast(t.id)
			})
			store.successToasts.forEach((t) => {
				dismissSuccessToast(t.id)
			})

			// Add multiple success toasts
			addSuccessToast({
				id: 'success-1',
				message: 'Event created successfully',
			})
			addSuccessToast({
				id: 'success-2',
				message: 'Profile updated',
			})
			addSuccessToast({
				id: 'success-3',
				message: 'Settings saved',
			})
			initialized.current = true
		}
	}, [addSuccessToast, dismissSuccessToast])

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
	const addErrorToast = useUIStore((state) => state.addErrorToast)
	const dismissErrorToast = useUIStore((state) => state.dismissErrorToast)
	const initialized = useRef(false)

	useEffect(() => {
		if (!initialized.current) {
			const store = useUIStore.getState()

			// Clear existing toasts first
			store.errorToasts.forEach((t) => {
				dismissErrorToast(t.id)
			})
			store.successToasts.forEach((t) => {
				useUIStore.getState().dismissSuccessToast(t.id)
			})

			// Add multiple error toasts
			addErrorToast({
				id: 'error-1',
				message: 'Failed to create event',
			})
			addErrorToast({
				id: 'error-2',
				message: 'Network error occurred',
			})
			addErrorToast({
				id: 'error-3',
				message: 'Invalid input provided',
			})
			initialized.current = true
		}
	}, [addErrorToast, dismissErrorToast])

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
	const addErrorToast = useUIStore((state) => state.addErrorToast)
	const addSuccessToast = useUIStore((state) => state.addSuccessToast)
	const dismissErrorToast = useUIStore((state) => state.dismissErrorToast)
	const dismissSuccessToast = useUIStore((state) => state.dismissSuccessToast)
	const initialized = useRef(false)

	useEffect(() => {
		if (!initialized.current) {
			const store = useUIStore.getState()

			// Clear existing toasts first
			store.errorToasts.forEach((t) => {
				dismissErrorToast(t.id)
			})
			store.successToasts.forEach((t) => {
				dismissSuccessToast(t.id)
			})

			// Add mixed toasts
			addSuccessToast({
				id: 'success-1',
				message: 'Event created successfully',
			})
			addErrorToast({
				id: 'error-1',
				message: 'Failed to send notification',
			})
			addSuccessToast({
				id: 'success-2',
				message: 'Settings saved',
			})
			initialized.current = true
		}
	}, [addErrorToast, addSuccessToast, dismissErrorToast, dismissSuccessToast])

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
	const addSuccessToast = useUIStore((state) => state.addSuccessToast)
	const dismissSuccessToast = useUIStore((state) => state.dismissSuccessToast)
	const initialized = useRef(false)

	useEffect(() => {
		if (!initialized.current) {
			const store = useUIStore.getState()

			// Clear existing toasts first
			store.errorToasts.forEach((t) => {
				useUIStore.getState().dismissErrorToast(t.id)
			})
			store.successToasts.forEach((t) => {
				dismissSuccessToast(t.id)
			})

			// Add toast with long message
			addSuccessToast({
				id: 'success-1',
				message:
					'This is a very long toast message that demonstrates how the component handles longer text content that might wrap to multiple lines.',
			})
			initialized.current = true
		}
	}, [addSuccessToast, dismissSuccessToast])

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
