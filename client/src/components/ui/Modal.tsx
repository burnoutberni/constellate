import React, { useEffect, useRef } from 'react'

import { cn } from '../../lib/utils'

export interface ModalProps extends React.HTMLAttributes<HTMLDivElement> {
	/**
	 * Whether the modal is open
	 */
	isOpen: boolean
	/**
	 * Callback when the modal should be closed
	 */
	onClose: () => void
	/**
	 * Whether to close the modal when clicking the backdrop
	 * @default true
	 */
	closeOnBackdropClick?: boolean
	/**
	 * Whether to close the modal when pressing Escape
	 * @default true
	 */
	closeOnEscape?: boolean
	/**
	 * Custom backdrop className
	 */
	backdropClassName?: string
	/**
	 * Custom content container className
	 */
	contentClassName?: string
	/**
	 * Maximum width of the modal content
	 * @default 'max-w-md'
	 */
	maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | 'full'
	/**
	 * Whether to show animations
	 * @default true
	 */
	animated?: boolean
	/**
	 * Modal content
	 */
	children: React.ReactNode
}

const maxWidthClasses = {
	sm: 'max-w-sm',
	md: 'max-w-md',
	lg: 'max-w-lg',
	xl: 'max-w-xl',
	'2xl': 'max-w-2xl',
	'3xl': 'max-w-3xl',
	'4xl': 'max-w-4xl',
	full: 'max-w-full m-4',
}

/**
 * Modal component for displaying content in an overlay.
 * Handles backdrop, escape key, focus trapping, and click-outside-to-close functionality.
 * Fully accessible with proper ARIA attributes.
 */
export const Modal = React.forwardRef<HTMLDivElement, ModalProps>(
	(
		{
			isOpen,
			onClose,
			closeOnBackdropClick = true,
			closeOnEscape = true,
			backdropClassName,
			contentClassName,
			maxWidth = 'md',
			animated = true,
			children,
			className,
			...props
		},
		ref
	) => {
		const contentRef = useRef<HTMLDivElement>(null)
		const previousFocusRef = useRef<HTMLElement | null>(null)

		// Focus management: Store previous focus when opening
		useEffect(() => {
			if (isOpen) {
				previousFocusRef.current = document.activeElement as HTMLElement

				// Focus the first element or container
				const contentElement = contentRef.current
				if (contentElement) {
					const focusableElements = contentElement.querySelectorAll(
						'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
					)
					if (focusableElements.length > 0) {
						(focusableElements[0] as HTMLElement).focus()
					} else {
						contentElement.focus()
					}
				}
			} else if (previousFocusRef.current) {
				// Restore focus when closing
				previousFocusRef.current.focus()
				previousFocusRef.current = null
			}
		}, [isOpen])

		// Focus trap: Handle Tab key dynamically
		useEffect(() => {
			if (!isOpen) {return}

			const handleKeyDown = (e: KeyboardEvent) => {
				if (closeOnEscape && e.key === 'Escape') {
					e.preventDefault() // Prevent default behavior (if any)
					onClose()
					return
				}

				if (e.key === 'Tab') {
					const contentElement = contentRef.current
					if (!contentElement) {return}

					// Query focusable elements dynamically on each keypress to handle content changes
					const focusableElements = contentElement.querySelectorAll(
						'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
					)

					if (focusableElements.length === 0) {
						e.preventDefault()
						return
					}

					const firstElement = focusableElements[0] as HTMLElement
					const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

					if (e.shiftKey) {
						if (document.activeElement === firstElement) {
							e.preventDefault()
							lastElement.focus()
						}
					} else {
						if (document.activeElement === lastElement) {
							e.preventDefault()
							firstElement.focus()
						}
					}
				}
			}

			document.addEventListener('keydown', handleKeyDown)

			return () => {
				document.removeEventListener('keydown', handleKeyDown)
			}
		}, [isOpen, closeOnEscape, onClose]) // Dependencies kept, but logic inside handles dynamic content

		// Handle backdrop click
		const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
			if (!closeOnBackdropClick) {
				return
			}

			// Only close if clicking the backdrop itself, not the content
			if (e.target === e.currentTarget) {
				onClose()
			}
		}

		// Prevent body scroll when modal is open
		useEffect(() => {
			if (isOpen) {
				const originalOverflow = document.body.style.overflow
				document.body.style.overflow = 'hidden'
				return () => {
					document.body.style.overflow = originalOverflow
				}
			}
		}, [isOpen])

		if (!isOpen) {
			return null
		}

		return (
			<div
				ref={ref}
				className={cn(
					'fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6',
					'bg-background-overlay backdrop-blur-sm',
					animated && 'animate-fade-in',
					backdropClassName
				)}
				onClick={handleBackdropClick}
				role="dialog"
				aria-modal="true"
				{...props}>
				<div
					ref={contentRef}
					className={cn(
						'w-full relative outline-none',
						'bg-white dark:bg-neutral-900',
						'rounded-xl shadow-2xl',
						'border border-neutral-200 dark:border-neutral-800',
						maxWidthClasses[maxWidth],
						animated && 'animate-slide-up',
						contentClassName,
						className
					)}
					onClick={(e) => e.stopPropagation()}
					tabIndex={-1}>
					{children}
				</div>
			</div>
		)
	}
)

Modal.displayName = 'Modal'
