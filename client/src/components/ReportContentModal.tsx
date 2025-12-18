import React, { useState, useEffect } from 'react'

import { useErrorHandler } from '@/hooks/useErrorHandler'
import { api } from '@/lib/api-client'
import { generateId } from '@/lib/utils'
import { useUIStore } from '@/stores'

import { Modal, Button, Textarea, Select } from './ui'

interface ReportContentModalProps {
	isOpen: boolean
	onClose: () => void
	targetType: 'user' | 'event' | 'comment'
	targetId: string
	contentTitle?: string
}

const REPORT_REASONS = [
	{ value: 'spam', label: 'Spam' },
	{ value: 'harassment', label: 'Harassment or Bullying' },
	{ value: 'inappropriate', label: 'Inappropriate Content' },
	{ value: 'other', label: 'Other' },
] as const

type ReportCategory = (typeof REPORT_REASONS)[number]['value']

export function ReportContentModal({
	isOpen,
	onClose,
	targetType,
	targetId,
	contentTitle,
}: ReportContentModalProps) {
	const [reason, setReason] = useState('')
	const [category, setCategory] = useState<ReportCategory>('spam')
	const [isSubmitting, setIsSubmitting] = useState(false)
	const addToast = useUIStore((state) => state.addToast)
	const handleError = useErrorHandler()

	// Reset state when modal is closed
	useEffect(() => {
		if (!isOpen) {
			setReason('')
			setCategory('spam')
			setIsSubmitting(false)
		}
	}, [isOpen])

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setIsSubmitting(true)

		try {
			await api.post(
				'/report',
				{
					targetType,
					targetId,
					reason,
					category,
				},
				undefined,
				'Failed to submit report'
			)

			addToast({
				id: generateId(),
				message:
					'Report submitted successfully. Thank you for helping keep our community safe.',
				variant: 'success',
			})
			onClose()
		} catch (error) {
			handleError(error, 'Failed to submit report. Please try again.', {
				context: 'ReportContentModal.handleSubmit',
			})
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<Modal isOpen={isOpen} onClose={onClose} maxWidth="md">
			<div className="bg-background-primary p-6 rounded-lg">
				<h2 className="text-xl font-bold text-text-primary mb-2">Report Content</h2>
				<p className="text-sm text-text-secondary mb-4">
					Help us understand what&apos;s wrong with{' '}
					{contentTitle ? `"${contentTitle}"` : 'this content'}.
				</p>

				<form onSubmit={handleSubmit} className="space-y-4">
					<Select
						label="Reason"
						value={category}
						onChange={(e) => setCategory(e.target.value as ReportCategory)}
						required>
						{REPORT_REASONS.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</Select>

					<Textarea
						label="Additional Details"
						value={reason}
						onChange={(e) => setReason(e.target.value)}
						placeholder="Please provide more context..."
						required
						minLength={10}
						maxLength={1000}
						rows={4}
					/>

					<div className="flex justify-end gap-3 pt-4">
						<Button
							type="button"
							variant="ghost"
							onClick={onClose}
							disabled={isSubmitting}>
							Cancel
						</Button>
						<Button
							type="submit"
							variant="danger"
							loading={isSubmitting}
							disabled={isSubmitting || !reason.trim()}>
							Submit Report
						</Button>
					</div>
				</form>
			</div>
		</Modal>
	)
}
