import { useUIStore, ErrorToast } from '../stores'

export function ErrorToasts() {
    const toasts = useUIStore((state) => state.errorToasts)
    const dismiss = useUIStore((state) => state.dismissErrorToast)

    if (!toasts.length) {
        return null
    }

    return (
        <div className="fixed top-4 right-4 z-50 flex max-w-sm flex-col gap-3">
            {toasts.map((toast) => (
                <ErrorToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
            ))}
        </div>
    )
}

function ErrorToastItem({ toast, onDismiss }: { toast: ErrorToast; onDismiss: (id: string) => void }) {
    return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 shadow-xl">
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-red-900">{toast.message}</p>
                <button
                    type="button"
                    onClick={() => onDismiss(toast.id)}
                    className="text-xs font-medium text-red-600 hover:text-red-800"
                >
                    Dismiss
                </button>
            </div>
        </div>
    )
}
