import { useState, type FormEvent } from 'react'

import { extractErrorMessage } from '@/lib/errorHandling'
import { createLogger } from '@/lib/logger'

import { useAuth } from '../hooks/useAuth'
import { api } from '../lib/api-client'

import { TermsOfServiceAgreement } from './TermsOfServiceAgreement'
import { Modal, Button } from './ui'

const log = createLogger('[TosAcceptanceModal]')

interface TosAcceptanceModalProps {
	isOpen: boolean
}

export function TosAcceptanceModal({ isOpen }: TosAcceptanceModalProps) {
	const [tosAccepted, setTosAccepted] = useState(false)
	const [error, setError] = useState('')
	const [loading, setLoading] = useState(false)
	const { checkTosStatus } = useAuth()

	if (!isOpen) {
		return null
	}

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault()
		setError('')

		if (!tosAccepted) {
			setError('You must agree to the Terms of Service and Privacy Policy to continue.')
			return
		}

		setLoading(true)

		try {
			await api.post('/tos/accept', {}, undefined, 'Failed to accept Terms of Service')
			// Refresh ToS status in context instead of reloading the page
			await checkTosStatus()
		} catch (err: unknown) {
			setError(
				extractErrorMessage(err, 'Failed to accept Terms of Service. Please try again.')
			)
			log.error('ToS acceptance error:', err)
		} finally {
			setLoading(false)
		}
	}

	return (
		<Modal isOpen={isOpen} onClose={() => {}} maxWidth="md" closeOnBackdropClick={false}>
			<div className="card w-full p-8 bg-background-primary shadow-2xl rounded-xl max-h-[90vh] overflow-y-auto border border-border-default">
				{/* Header */}
				<div className="text-center mb-6">
					<div className="text-5xl mb-3">📋</div>
					<h2 className="text-2xl font-bold text-text-primary mb-2">
						Terms of Service Update
					</h2>
					<p className="text-text-secondary">
						Please review and accept the updated Terms of Service to continue using your
						account.
					</p>
				</div>

				{error && (
					<div className="bg-error-50 dark:bg-error-900/20 text-error-600 dark:text-error-400 p-3 rounded-lg mb-4 text-sm border border-error-200 dark:border-error-800">
						{error}
					</div>
				)}

				<form onSubmit={handleSubmit} className="space-y-4">
					<TermsOfServiceAgreement
						id="tos-agreement-modal"
						checked={tosAccepted}
						onChange={setTosAccepted}
					/>

					<Button
						type="submit"
						disabled={loading}
						loading={loading}
						fullWidth
						size="lg"
						className="text-lg font-semibold">
						Accept and Continue
					</Button>
				</form>
			</div>
		</Modal>
	)
}

