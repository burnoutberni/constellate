import { useEffect } from 'react'
import { useUIStore, SuccessToast } from '@/stores'
import { Stack } from './layout'

export function SuccessToasts() {
    const toasts = useUIStore((state) => state.successToasts)
    const dismiss = useUIStore((state) => state.dismissSuccessToast)

    if (!toasts.length) {
        return null
    }

    return (
        <Stack className="fixed top-4 right-4 z-50 max-w-sm" gap="sm" role="alert" aria-atomic="true">
            {toasts.map((toast) => (
                <SuccessToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
            ))}
        </Stack>
    )
}

function SuccessToastItem({ toast, onDismiss }: { toast: SuccessToast; onDismiss: (id: string) => void }) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onDismiss(toast.id)
        }, 5000) // Auto-dismiss after 5 seconds

        return () => {
            clearTimeout(timer)
        }
    }, [toast.id, onDismiss])

    return (
        <div className="rounded-lg border border-success-200 bg-success-50 dark:bg-success-950 dark:border-success-800 p-4 shadow-xl" role="alert">
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-success-900 dark:text-success-100">{toast.message}</p>
                <button
                    type="button"
                    onClick={() => onDismiss(toast.id)}
                    className="text-xs font-medium text-success-600 dark:text-success-400 hover:text-success-800 dark:hover:text-success-200"
                    aria-label="Dismiss success message"
                >
                    Dismiss
                </button>
            </div>
        </div>
    )
}
