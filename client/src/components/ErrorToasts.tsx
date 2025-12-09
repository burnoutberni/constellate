import { useEffect } from 'react'
import { useUIStore, ErrorToast } from '../stores'

export function ErrorToasts() {
    const toasts = useUIStore((state) => state.errorToasts)
    const dismiss = useUIStore((state) => state.dismissErrorToast)

    if (!toasts.length) {
        return null
    }

    return (
        <div className="fixed top-4 right-4 z-50 flex max-w-sm flex-col gap-3" role="alert" aria-atomic="true">
            {toasts.map((toast) => (
                <ErrorToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
            ))}
        </div>
    )
}

function ErrorToastItem({ toast, onDismiss }: { toast: ErrorToast; onDismiss: (id: string) => void }) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onDismiss(toast.id)
        }, 5000) // Auto-dismiss after 5 seconds

        return () => {
            clearTimeout(timer)
        }
    }, [toast.id, onDismiss])

    return (
        <div className="rounded-lg border border-error-200 bg-error-50 p-4 shadow-xl" role="alert">
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-error-900">{toast.message}</p>
                <button
                    type="button"
                    onClick={() => onDismiss(toast.id)}
                    className="text-xs font-medium text-error-600 hover:text-error-800"
                    aria-label="Dismiss error"
                >
                    Dismiss
                </button>
            </div>
        </div>
    )
}
