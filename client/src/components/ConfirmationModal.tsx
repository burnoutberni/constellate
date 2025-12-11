import { Button } from './ui'

interface ConfirmationModalProps {
    isOpen: boolean
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    variant?: 'danger' | 'default'
    onConfirm: () => void
    onCancel: () => void
    isPending?: boolean
}

export function ConfirmationModal({
    isOpen,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'default',
    onConfirm,
    onCancel,
    isPending = false,
}: ConfirmationModalProps) {
    if (!isOpen) {
        return null
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-background-primary rounded-lg shadow-xl max-w-md w-full p-6 animate-scale-in">
                <h3 className="text-lg font-semibold text-text-primary mb-2">{title}</h3>
                <p className="text-sm text-text-secondary mb-6">{message}</p>
                <div className="flex gap-3 justify-end">
                    <Button
                        variant="ghost"
                        onClick={onCancel}
                        disabled={isPending}
                    >
                        {cancelLabel}
                    </Button>
                    <Button
                        variant={variant === 'danger' ? 'danger' : 'primary'}
                        onClick={onConfirm}
                        disabled={isPending}
                        loading={isPending}
                    >
                        {confirmLabel}
                    </Button>
                </div>
            </div>
        </div>
    )
}
