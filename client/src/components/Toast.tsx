import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'
import { useUIStore, type Toast, type ToastVariant } from '@/stores'

import { Stack } from './layout'
import { Button, CloseIcon } from './ui'

interface ToastItemProps {
	toast: Toast & { createdAt: string }
	onDismiss: (id: string) => void
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
	const [isVisible, setIsVisible] = useState(false)

	useEffect(() => {
		// Trigger animation on mount (use requestAnimationFrame to ensure DOM is ready for smooth animation)
		const rafId = requestAnimationFrame(() => {
			setIsVisible(true)
		})

		const timer = setTimeout(() => {
			setIsVisible(false)
			// Wait for animation to complete before removing
			setTimeout(() => {
				onDismiss(toast.id)
			}, 200)
		}, 5000) // Auto-dismiss after 5 seconds

		return () => {
			clearTimeout(timer)
			cancelAnimationFrame(rafId)
		}
	}, [toast.id, onDismiss])

	const variantStyles: Record<
		ToastVariant,
		{
			container: string
			message: string
			icon: string
			ariaLive: 'polite' | 'assertive'
			ariaLabel: string
		}
	> = {
		error: {
			container:
				'rounded-lg border border-error-200 bg-error-50 dark:bg-error-950 dark:border-error-800 p-4 shadow-lg',
			message: 'text-sm font-normal text-error-900 dark:text-error-100',
			icon: 'text-error-600 dark:text-error-400',
			ariaLive: 'assertive',
			ariaLabel: 'Error notification',
		},
		success: {
			container:
				'rounded-lg border border-success-200 bg-success-50 dark:bg-success-950 dark:border-success-800 p-4 shadow-lg',
			message: 'text-sm font-normal text-success-900 dark:text-success-100',
			icon: 'text-success-600 dark:text-success-400',
			ariaLive: 'polite',
			ariaLabel: 'Success notification',
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
			role="alert"
			aria-live={styles.ariaLive}
			aria-atomic="true"
			aria-label={styles.ariaLabel}>
			<div className="flex-1 min-w-0">
				<p className={styles.message}>{toast.message}</p>
			</div>
			<Button
				type="button"
				onClick={() => {
					setIsVisible(false)
					setTimeout(() => onDismiss(toast.id), 200)
				}}
				variant="ghost"
				size="sm"
				className={cn(
					'flex-shrink-0 h-6 w-6 p-0 rounded-md',
					'hover:bg-error-100 dark:hover:bg-error-900',
					toast.variant === 'success' && 'hover:bg-success-100 dark:hover:bg-success-900',
					'focus:outline-none focus:ring-2 focus:ring-offset-2',
					toast.variant === 'error' ? 'focus:ring-error-500' : 'focus:ring-success-500',
					'transition-colors duration-150'
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
