import type { Meta, StoryObj } from '@storybook/react'
import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

import { AuthProvider } from '@/contexts/AuthContext'

import { TosAcceptanceModal } from './TosAcceptanceModal'
import { Button } from './ui'

// Mock API client to prevent actual API calls
vi.mock('@/lib/api-client', () => ({
	api: {
		post: vi.fn().mockResolvedValue({}),
	},
}))

// Mock window.location.reload
const mockReload = vi.fn()
// Use a guard to prevent redefinition errors when the file is imported multiple times
const locationMockKey = '__locationReloadMocked'
if (!(window as unknown as { [key: string]: boolean })[locationMockKey]) {
	try {
		// Check if we can redefine the property
		const descriptor = Object.getOwnPropertyDescriptor(window, 'location')
		if (descriptor && !descriptor.configurable) {
			// Property is non-configurable, try to replace just the reload method
			if (window.location && typeof window.location === 'object') {
				try {
					Object.defineProperty(window.location, 'reload', {
						value: mockReload,
						writable: true,
						configurable: true,
					})
					;(window as unknown as { [key: string]: boolean })[locationMockKey] = true
				} catch {
					// If that also fails, try direct assignment
					try {
						;(window.location as unknown as { reload?: typeof mockReload }).reload =
							mockReload
						;(window as unknown as { [key: string]: boolean })[locationMockKey] = true
					} catch {
						// Silently continue if all attempts fail
					}
				}
			}
		} else {
			// Property is configurable or doesn't exist, try to redefine it
			try {
				delete (window as { location?: unknown }).location
			} catch {
				// If deletion fails, continue anyway
			}
			Object.defineProperty(window, 'location', {
				value: {
					reload: mockReload,
				},
				writable: true,
				configurable: true,
			})
			;(window as unknown as { [key: string]: boolean })[locationMockKey] = true
		}
	} catch {
		// If all attempts fail, silently continue - the mock won't work but the story can still render
	}
}

// Interactive wrapper for Docs page
const InteractiveWrapper = (args: React.ComponentProps<typeof TosAcceptanceModal>) => {
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
		}, 2000)

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
				<Button onClick={() => setIsOpen(true)}>Open ToS Acceptance Modal</Button>
			</div>
		)
	}

	// Use portal for non-inline stories (they're in iframes, so portal to body is safe)
	const modal = <TosAcceptanceModal {...args} isOpen={isOpen} />

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
	title: 'Components/TosAcceptanceModal',
	component: TosAcceptanceModal,
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
} satisfies Meta<typeof TosAcceptanceModal>

export default meta
type Story = StoryObj<typeof TosAcceptanceModal>

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

