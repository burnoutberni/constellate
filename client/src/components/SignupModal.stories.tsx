import type { Meta, StoryObj } from '@storybook/react'
import { MemoryRouter } from 'react-router-dom'
import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { SignupModal } from './SignupModal'
import { Button } from './ui'

// Interactive wrapper for Docs page (inline story - no portal)
const InteractiveWrapper = (args: React.ComponentProps<typeof SignupModal>) => {
	const [isOpen, setIsOpen] = useState(true)
	const containerRef = React.useRef<HTMLDivElement>(null)
	const scrollPositionRef = React.useRef<{ x: number; y: number } | null>(null)
	const preventFocusRef = React.useRef(true)

	// Save scroll position on mount and prevent auto-scroll aggressively
	React.useEffect(() => {
		scrollPositionRef.current = { x: window.scrollX, y: window.scrollY }
		preventFocusRef.current = true

		// Prevent any scroll changes for an extended period after mount
		const preventScroll = () => {
			if (scrollPositionRef.current) {
				window.scrollTo(scrollPositionRef.current.x, scrollPositionRef.current.y)
			}
		}

		// Use requestAnimationFrame for smoother scroll prevention
		let rafId: number
		const preventScrollLoop = () => {
			preventScroll()
			if (scrollPositionRef.current) {
				rafId = requestAnimationFrame(preventScrollLoop)
			}
		}
		rafId = requestAnimationFrame(preventScrollLoop)

		const timeoutId = setTimeout(() => {
			cancelAnimationFrame(rafId)
			scrollPositionRef.current = null
			preventFocusRef.current = false
		}, 2000) // Extended to 2 seconds

		return () => {
			cancelAnimationFrame(rafId)
			clearTimeout(timeoutId)
		}
	}, [])

	// Prevent body scroll lock and auto-scroll in Storybook docs
	React.useEffect(() => {
		if (isOpen) {
			// Override the Modal's body scroll lock for docs view
			const originalOverflow = document.body.style.overflow
			document.body.style.overflow = ''

			// Prevent auto-scroll and focus during initial period
			const handleFocus = (e: FocusEvent) => {
				// Prevent focus entirely during the initial period
				if (preventFocusRef.current) {
					e.preventDefault()
					e.stopPropagation()
					if (e.target instanceof HTMLElement) {
						e.target.blur()
					}
					return
				}

				// After initial period, prevent scroll but allow focus
				if (e.target instanceof HTMLElement) {
					e.target.scrollIntoView = () => {}
					if (scrollPositionRef.current) {
						window.scrollTo(scrollPositionRef.current.x, scrollPositionRef.current.y)
					}
				}
			}

			// Remove autoFocus from all inputs to prevent initial focus
			const removeAutoFocus = () => {
				const inputs = containerRef.current?.querySelectorAll(
					'input[autofocus], input[autoFocus]'
				)
				inputs?.forEach((input) => {
					if (input instanceof HTMLInputElement) {
						input.removeAttribute('autofocus')
						input.removeAttribute('autoFocus')
						input.blur()
					}
				})
			}

			// Try to remove autoFocus very frequently during initial period
			removeAutoFocus()
			const timeoutIds = [
				setTimeout(removeAutoFocus, 10),
				setTimeout(removeAutoFocus, 25),
				setTimeout(removeAutoFocus, 50),
				setTimeout(removeAutoFocus, 100),
				setTimeout(removeAutoFocus, 200),
				setTimeout(removeAutoFocus, 500),
				setTimeout(removeAutoFocus, 1000),
			]

			document.addEventListener('focusin', handleFocus, true)
			document.addEventListener('focus', handleFocus, true)

			return () => {
				timeoutIds.forEach((id) => clearTimeout(id))
				document.body.style.overflow = originalOverflow
				document.removeEventListener('focusin', handleFocus, true)
			}
		}
	}, [isOpen])

	if (!isOpen) {
		return (
			<div
				style={{
					position: 'relative',
					minHeight: '800px',
					height: '800px',
					width: '100%',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
				}}>
				<Button onClick={() => setIsOpen(true)}>Open Modal</Button>
			</div>
		)
	}

	// Use portal for non-inline stories (they're in iframes, so portal to body is safe)
	const modal = (
		<SignupModal
			{...args}
			isOpen={isOpen}
			onClose={() => setIsOpen(false)}
			onSuccess={() => {
				console.log('Success')
				setIsOpen(false)
			}}
		/>
	)

	return (
		<div
			ref={containerRef}
			style={{
				position: 'relative',
				minHeight: '800px',
				height: '800px',
				width: '100%',
				display: 'flex',
				flexDirection: 'column',
			}}>
			{/* Spacer to maintain container height when modal is portaled */}
			<div style={{ flex: '1 1 auto', minHeight: '800px', height: '800px', width: '100%' }} />
			{typeof document !== 'undefined' && createPortal(modal, document.body)}
			{typeof document === 'undefined' && modal}
		</div>
	)
}

const meta = {
	title: 'Components/SignupModal',
	component: SignupModal,
	parameters: {
		layout: 'fullscreen',
		docs: {
			canvas: {
				height: '800px',
			},
			story: {
				inline: false,
				iframeHeight: 800,
			},
		},
	},
	tags: ['autodocs'],
	args: {
		isOpen: false,
		onClose: () => {},
		onSuccess: () => {},
	},
	argTypes: {
		onClose: {
			control: false,
		},
		onSuccess: {
			control: false,
		},
	},
	decorators: [
		(Story) => (
			<AuthProvider>
				<MemoryRouter>
					<Story />
				</MemoryRouter>
			</AuthProvider>
		),
	],
} satisfies Meta<typeof SignupModal>

export default meta
type Story = StoryObj<typeof SignupModal>

// Interactive wrapper for action-specific stories (non-inline - use portal)
const ActionWrapper = ({ action }: { action?: 'rsvp' | 'like' | 'comment' }) => {
	const [isOpen, setIsOpen] = useState(true)
	const containerRef = React.useRef<HTMLDivElement>(null)
	const scrollPositionRef = React.useRef<{ x: number; y: number } | null>(null)
	const preventFocusRef = React.useRef(true)

	// Save scroll position on mount and prevent auto-scroll aggressively
	React.useEffect(() => {
		scrollPositionRef.current = { x: window.scrollX, y: window.scrollY }
		preventFocusRef.current = true

		// Prevent any scroll changes for an extended period after mount
		const preventScroll = () => {
			if (scrollPositionRef.current) {
				window.scrollTo(scrollPositionRef.current.x, scrollPositionRef.current.y)
			}
		}

		// Use requestAnimationFrame for smoother scroll prevention
		let rafId: number
		const preventScrollLoop = () => {
			preventScroll()
			if (scrollPositionRef.current) {
				rafId = requestAnimationFrame(preventScrollLoop)
			}
		}
		rafId = requestAnimationFrame(preventScrollLoop)

		const timeoutId = setTimeout(() => {
			cancelAnimationFrame(rafId)
			scrollPositionRef.current = null
			preventFocusRef.current = false
		}, 2000) // Extended to 2 seconds

		return () => {
			cancelAnimationFrame(rafId)
			clearTimeout(timeoutId)
		}
	}, [])

	// Prevent body scroll lock and auto-scroll in Storybook docs
	React.useEffect(() => {
		if (isOpen) {
			// Override the Modal's body scroll lock for docs view
			const originalOverflow = document.body.style.overflow
			document.body.style.overflow = ''

			// Prevent auto-scroll and focus during initial period
			const handleFocus = (e: FocusEvent) => {
				// Prevent focus entirely during the initial period
				if (preventFocusRef.current) {
					e.preventDefault()
					e.stopPropagation()
					if (e.target instanceof HTMLElement) {
						e.target.blur()
					}
					return
				}

				// After initial period, prevent scroll but allow focus
				if (e.target instanceof HTMLElement) {
					e.target.scrollIntoView = () => {}
					if (scrollPositionRef.current) {
						window.scrollTo(scrollPositionRef.current.x, scrollPositionRef.current.y)
					}
				}
			}

			// Remove autoFocus from all inputs to prevent initial focus
			const removeAutoFocus = () => {
				const inputs = document.querySelectorAll('input[autofocus], input[autoFocus]')
				inputs?.forEach((input) => {
					if (input instanceof HTMLInputElement) {
						input.removeAttribute('autofocus')
						input.removeAttribute('autoFocus')
						input.blur()
					}
				})
			}

			// Try to remove autoFocus very frequently during initial period
			removeAutoFocus()
			const timeoutIds = [
				setTimeout(removeAutoFocus, 10),
				setTimeout(removeAutoFocus, 25),
				setTimeout(removeAutoFocus, 50),
				setTimeout(removeAutoFocus, 100),
				setTimeout(removeAutoFocus, 200),
				setTimeout(removeAutoFocus, 500),
				setTimeout(removeAutoFocus, 1000),
			]

			document.addEventListener('focusin', handleFocus, true)
			document.addEventListener('focus', handleFocus, true)

			return () => {
				timeoutIds.forEach((id) => clearTimeout(id))
				document.body.style.overflow = originalOverflow
				document.removeEventListener('focusin', handleFocus, true)
				document.removeEventListener('focus', handleFocus, true)
			}
		}
	}, [isOpen])

	if (!isOpen) {
		return (
			<div
				style={{
					position: 'relative',
					minHeight: '800px',
					height: '800px',
					width: '100%',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
				}}>
				<Button onClick={() => setIsOpen(true)}>Open Signup</Button>
			</div>
		)
	}

	const modal = (
		<SignupModal
			isOpen={isOpen}
			onClose={() => setIsOpen(false)}
			action={action}
			onSuccess={() => {
				console.log('Success')
				setIsOpen(false)
			}}
		/>
	)

	// Use portal for non-inline stories (they're in iframes, so portal to body is safe)
	return (
		<div
			ref={containerRef}
			style={{
				position: 'relative',
				minHeight: '800px',
				height: '800px',
				width: '100%',
				display: 'flex',
				flexDirection: 'column',
			}}>
			{/* Spacer to maintain container height when modal is portaled */}
			<div style={{ flex: '1 1 auto', minHeight: '800px', height: '800px', width: '100%' }} />
			{typeof document !== 'undefined' && createPortal(modal, document.body)}
			{typeof document === 'undefined' && modal}
		</div>
	)
}

export const Default: Story = {
	render: (args) => <InteractiveWrapper {...args} />,
	parameters: {
		docs: {
			canvas: {
				height: '800px',
			},
			story: {
				inline: false,
				iframeHeight: 800,
			},
		},
	},
}

export const ForRSVP: Story = {
	render: () => <ActionWrapper action="rsvp" />,
	parameters: {
		docs: {
			canvas: {
				height: '800px',
			},
			story: {
				inline: false,
				iframeHeight: 800,
			},
		},
	},
}

export const ForLike: Story = {
	render: () => <ActionWrapper action="like" />,
	parameters: {
		docs: {
			canvas: {
				height: '800px',
			},
			story: {
				inline: false,
				iframeHeight: 800,
			},
		},
	},
}

export const ForComment: Story = {
	render: () => <ActionWrapper action="comment" />,
	parameters: {
		docs: {
			canvas: {
				height: '800px',
			},
			story: {
				inline: false,
				iframeHeight: 800,
			},
		},
	},
}
