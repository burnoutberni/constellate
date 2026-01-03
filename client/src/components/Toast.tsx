import { useCallback, useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'
import { useUIStore, type StoredToast, type ToastVariant } from '@/stores'

import { Stack } from './layout'
import { Button, CloseIcon } from './ui'

const AUTO_DISMISS_DURATION = 5000 // milliseconds
const ANIMATION_DURATION = 200 // milliseconds

interface ToastItemProps {
	toast: StoredToast
	onDismiss: (id: string) => void
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
	const [isVisible, setIsVisible] = useState(false)
	const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const hasDismissedRef = useRef(false) // Track if dismissal already happened to prevent double calls

	// Helper function to handle dismissal: hide toast, wait for animation, then remove from store
	const handleDismiss = useCallback(() => {
		if (hasDismissedRef.current) {
			return
		}
		hasDismissedRef.current = true

		// Clear any pending dismissal timer
		if (dismissTimerRef.current) {
			clearTimeout(dismissTimerRef.current)
			dismissTimerRef.current = null
		}

		// Hide toast (triggers exit animation)
		setIsVisible(false)

		// Wait for animation to complete before removing from store
		dismissTimerRef.current = setTimeout(() => {
			dismissTimerRef.current = null
			onDismiss(toast.id)
		}, ANIMATION_DURATION)
	}, [toast.id, onDismiss])

	// Trigger animation on mount and set up auto-dismiss
	useEffect(() => {
		// Trigger animation on mount (use requestAnimationFrame to ensure DOM is ready for smooth animation)
		requestAnimationFrame(() => {
			setIsVisible(true)
		})

		// Auto-dismiss after 5 seconds
		const autoDismissTimer = setTimeout(() => {
			handleDismiss()
		}, AUTO_DISMISS_DURATION)

		return () => {
			clearTimeout(autoDismissTimer)
			// If component unmounts while dismissal is pending, call onDismiss immediately
			if (dismissTimerRef.current && !hasDismissedRef.current) {
				clearTimeout(dismissTimerRef.current)
				dismissTimerRef.current = null
				hasDismissedRef.current = true
				onDismiss(toast.id)
			}
		}
	}, [handleDismiss, onDismiss, toast.id])

	const variantStyles: Record<
		ToastVariant,
		{
			container: string
			message: string
			icon: string
			ariaLive: 'polite' | 'assertive'
			ariaLabel: string
			buttonClasses: string
		}
	> = {
		error: {
			container:
				'rounded-r-lg border-l-4 border-error-600 bg-background-primary dark:bg-background-secondary shadow-lg ring-1 ring-black/5 dark:ring-white/10',
			message: 'text-sm font-medium text-text-primary',
			icon: 'text-error-600',
			ariaLive: 'assertive',
			ariaLabel: 'Error notification',
			buttonClasses: 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-text-secondary',
		},
		success: {
			container:
				'rounded-r-lg border-l-4 border-success-600 bg-background-primary dark:bg-background-secondary shadow-lg ring-1 ring-black/5 dark:ring-white/10',
			message: 'text-sm font-medium text-text-primary',
			icon: 'text-success-600',
			ariaLive: 'polite',
			ariaLabel: 'Success notification',
			buttonClasses: 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-text-secondary',
		},
	}

	const styles = variantStyles[toast.variant]

	return (
		<div
			className={cn(
				styles.container,
				'flex items-start gap-3 transition-all duration-200 ease-in-out',
				isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'
			)}
			role={toast.variant === 'success' ? 'status' : 'alert'}
			aria-live={styles.ariaLive}
			aria-atomic="true"
			aria-label={styles.ariaLabel}>
			<div className="flex-1 min-w-0">
				<p className={styles.message}>{toast.message}</p>
			</div>
			<Button
				type="button"
				onClick={handleDismiss}
				variant="ghost"
				size="sm"
				className={cn(
					'flex-shrink-0 h-6 w-6 p-0 rounded-md',
					'focus:outline-none focus:ring-2 focus:ring-offset-2',
					'transition-colors duration-150',
					styles.buttonClasses
				)}
				aria-label={`Dismiss ${toast.variant} notification`}>
				<CloseIcon className={cn('w-4 h-4', styles.icon)} />
			</Button>
		</div>
	)
}

export function Toasts() {
	const toasts = useUIStore((state) => state.toasts)
	const dismissToast = useUIStore((state) => state.dismissToast)

	if (!toasts.length) {
		return null
	}

	return (
		<div
			className="fixed top-4 right-4 z-50 w-full max-w-sm px-4 sm:px-0"
			role="region"
			aria-label="Notifications">
			<Stack gap="sm" className="w-full">
				{toasts.map((toast) => (
					<ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
				))}
			</Stack>
		</div>
	)
}
