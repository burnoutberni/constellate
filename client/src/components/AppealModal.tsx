import { useState, type FormEvent } from 'react'

import { useErrorHandler } from '@/hooks/useErrorHandler'
import { api } from '@/lib/api-client'
import { generateId } from '@/lib/utils'
import { useUIStore } from '@/stores'

import { Modal, Button, Textarea, Select } from './ui'

interface AppealModalProps {
	isOpen: boolean
	onClose: () => void
	onSuccess?: () => void
	referenceId?: string
	referenceType?: string
}

export function AppealModal({
	isOpen,
	onClose,
	onSuccess,
	referenceId,
	referenceType,
}: AppealModalProps) {
	const [type, setType] = useState('CONTENT_REMOVAL')
	const [reason, setReason] = useState('')
	const [isSubmitting, setIsSubmitting] = useState(false)
	const handleError = useErrorHandler()
	const addToast = useUIStore((state) => state.addToast)

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault()
		if (!reason.trim()) {
			return
		}

		setIsSubmitting(true)
		try {
			await api.post(
				'/appeals',
				{
					type,
					reason,
					referenceId,
					referenceType,
				},
				undefined,
				'Failed to submit appeal'
			)

			addToast({
				id: generateId(),
				message: 'Appeal submitted successfully',
				variant: 'success',
			})

			onSuccess?.()
			onClose()
			setReason('')
			setType('CONTENT_REMOVAL')
		} catch (error) {
			handleError(error, 'Failed to submit appeal', { context: 'AppealModal.handleSubmit' })
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<Modal isOpen={isOpen} onClose={onClose} title="Submit Appeal">
			<form onSubmit={handleSubmit} className="space-y-4">
				<div className="space-y-2">
					<label className="text-sm font-medium text-text-primary">Appeal Type</label>
					<Select value={type} onChange={(e) => setType(e.target.value)}>
						<option value="CONTENT_REMOVAL">Content Removal</option>
						<option value="ACCOUNT_SUSPENSION">Account Suspension</option>
					</Select>
				</div>

				<div className="space-y-2">
					<label className="text-sm font-medium text-text-primary">Reason</label>
					<Textarea
						value={reason}
						onChange={(e) => setReason(e.target.value)}
						placeholder="Please explain why this decision should be reversed..."
						required
						rows={5}
					/>
				</div>

				<div className="flex justify-end gap-2 pt-2">
					<Button type="button" variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" loading={isSubmitting} disabled={!reason.trim()}>
						Submit Appeal
					</Button>
				</div>
			</form>
		</Modal>
	)
}
