import { useEffect } from 'react'
import { Stack } from './layout'
import { Button } from './ui'

export type ToastVariant = 'error' | 'success'

export interface Toast {
    id: string
    message: string
    createdAt?: string
}

interface ToastItemProps {
    toast: Toast
    variant: ToastVariant
    onDismiss: (id: string) => void
}

function ToastItem({ toast, variant, onDismiss }: ToastItemProps) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onDismiss(toast.id)
        }, 5000) // Auto-dismiss after 5 seconds

        return () => {
            clearTimeout(timer)
        }
    }, [toast.id, onDismiss])

    const variantStyles = {
        error: {
            container: 'rounded-lg border border-error-200 bg-error-50 dark:bg-error-950 dark:border-error-800 p-4 shadow-xl',
            message: 'text-sm text-error-900 dark:text-error-100',
            button: 'text-xs font-medium text-error-600 dark:text-error-400 hover:text-error-800 dark:hover:text-error-200',
            ariaLabel: 'Dismiss error',
        },
        success: {
            container: 'rounded-lg border border-success-200 bg-success-50 dark:bg-success-950 dark:border-success-800 p-4 shadow-xl',
            message: 'text-sm text-success-900 dark:text-success-100',
            button: 'text-xs font-medium text-success-600 dark:text-success-400 hover:text-success-800 dark:hover:text-success-200',
            ariaLabel: 'Dismiss success message',
        },
    }

    const styles = variantStyles[variant]

    return (
        <div className={styles.container} role="alert">
            <div className="flex items-center justify-between gap-3">
                <p className={styles.message}>{toast.message}</p>
                <Button
                    type="button"
                    onClick={() => onDismiss(toast.id)}
                    variant="ghost"
                    size="sm"
                    className={styles.button}
                    aria-label={styles.ariaLabel}
                >
                    Dismiss
                </Button>
            </div>
        </div>
    )
}

interface ToastsProps {
    toasts: Toast[]
    variant: ToastVariant
    onDismiss: (id: string) => void
}

export function Toasts({ toasts, variant, onDismiss }: ToastsProps) {
    if (!toasts.length) {
        return null
    }

    return (
        <Stack className="fixed top-4 right-4 z-50 max-w-sm" gap="sm" role="alert" aria-atomic="true">
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} variant={variant} onDismiss={onDismiss} />
            ))}
        </Stack>
    )
}
