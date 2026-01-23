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
 * Handles backdrop, escape key, and click-outside-to-close functionality.
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

		// Handle escape key
		useEffect(() => {
			if (!isOpen || !closeOnEscape) {
				return
			}

			function handleEscape(e: KeyboardEvent) {
				if (e.key === 'Escape') {
					onClose()
				}
			}

			document.addEventListener('keydown', handleEscape)
			return () => document.removeEventListener('keydown', handleEscape)
		}, [isOpen, closeOnEscape, onClose])

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

		// Focus trap
		useEffect(() => {
			if (!isOpen) {
				return
			}

			const previousActiveElement = document.activeElement as HTMLElement
			const contentElement = contentRef.current

			if (!contentElement) {
				return
			}

			// Find all focusable elements
			// We query dynamically on keydown to handle content changes,
			// but we also need to set initial focus.
			const getFocusableElements = () => {
				if (!contentElement) {
					return []
				}
				return contentElement.querySelectorAll<HTMLElement>(
					'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
				)
			}

			// Small timeout to ensure content is rendered if it's being animated in
			// although the Modal component renders children immediately when isOpen is true.
			const focusableElements = getFocusableElements()
			const firstElement = focusableElements[0]

			// Focus the first element
			if (firstElement) {
				firstElement.focus()
			} else {
				// If no focusable element, focus the container so escape key still works
				contentElement.setAttribute('tabindex', '-1')
				contentElement.focus()
			}

			function handleTabKey(e: KeyboardEvent) {
				if (e.key !== 'Tab') {
					return
				}

				const currentFocusableElements = getFocusableElements()
				if (currentFocusableElements.length === 0) {
					return
				}

				const firstEl = currentFocusableElements[0]
				const lastEl = currentFocusableElements[currentFocusableElements.length - 1]

				if (e.shiftKey) {
					if (document.activeElement === firstEl) {
						e.preventDefault()
						lastEl.focus()
					}
				} else {
					if (document.activeElement === lastEl) {
						e.preventDefault()
						firstEl.focus()
					}
				}
			}

			document.addEventListener('keydown', handleTabKey)

			return () => {
				document.removeEventListener('keydown', handleTabKey)
				// Small timeout to allow the modal to close and unmount before focusing back
				// This prevents issues where the focus is stolen back by the modal if it's animating out
				setTimeout(() => {
					previousActiveElement?.focus()
				}, 0)
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
						'w-full relative',
						'bg-white dark:bg-neutral-900',
						'rounded-xl shadow-2xl',
						'border border-neutral-200 dark:border-neutral-800',
						maxWidthClasses[maxWidth],
						animated && 'animate-slide-up',
						contentClassName,
						className
					)}
					onClick={(e) => e.stopPropagation()}>
					{children}
				</div>
			</div>
		)
	}
)

Modal.displayName = 'Modal'

