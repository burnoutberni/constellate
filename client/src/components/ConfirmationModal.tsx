import { Button, Modal } from './ui'

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
	return (
		<Modal isOpen={isOpen} onClose={onCancel} maxWidth="md">
			<div className="p-6">
				<h3 className="text-lg font-semibold text-text-primary mb-2">{title}</h3>
				<p className="text-sm text-text-secondary mb-6">{message}</p>
				<div className="flex gap-3 justify-end">
					<Button variant="ghost" onClick={onCancel} disabled={isPending}>
						{cancelLabel}
					</Button>
					<Button
						variant={variant === 'danger' ? 'danger' : 'primary'}
						onClick={onConfirm}
						disabled={isPending}
						loading={isPending}>
						{confirmLabel}
					</Button>
				</div>
			</div>
		</Modal>
	)
}
