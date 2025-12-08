import { useEffect } from 'react'
import { useUIStore, type ErrorToast } from '../stores'

export function ErrorToasts() {
    const toasts = useUIStore((state) => state.errorToasts)
    const dismiss = useUIStore((state) => state.dismissErrorToast)

    if (!toasts.length) {
        return null
    }

    return (
        <div className="fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-3">
            {toasts.map((toast) => (
                <ErrorToast key={toast.id} toast={toast} onDismiss={dismiss} />
            ))}
        </div>
    )
}

function ErrorToast({ toast, onDismiss }: { toast: ErrorToast; onDismiss: (id: string) => void }) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onDismiss(toast.id)
        }, 5000)
        return () => clearTimeout(timer)
    }, [toast.id, onDismiss])

    return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 shadow-xl" role="alert" aria-atomic="true">
            <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-red-900">Error</span>
                <button
                    type="button"
                    onClick={() => onDismiss(toast.id)}
                    className="text-xs font-medium text-red-600 hover:text-red-800"
                    aria-label="Dismiss error"
                >
                    Dismiss
                </button>
            </div>
            <p className="text-sm text-red-800">{toast.message}</p>
        </div>
    )
}
