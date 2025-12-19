import { type ChangeEvent } from 'react'

interface TermsOfServiceAgreementProps {
	id?: string
	checked: boolean
	onChange: (accepted: boolean) => void
}

export function TermsOfServiceAgreement({
	id = 'tos-agreement',
	checked,
	onChange,
}: TermsOfServiceAgreementProps) {
	const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
		onChange(e.target.checked)
	}

	return (
		<div className="flex items-start gap-2 pt-2">
			<input
				type="checkbox"
				id={id}
				className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
				checked={checked}
				onChange={handleChange}
			/>
			<label htmlFor={id} className="text-sm text-text-secondary">
				I agree to the{' '}
				<a
					href="/terms"
					target="_blank"
					rel="noopener noreferrer"
					className="text-primary-600 hover:underline">
					Terms of Service
				</a>{' '}
				and{' '}
				<a
					href="/privacy"
					target="_blank"
					rel="noopener noreferrer"
					className="text-primary-600 hover:underline">
					Privacy Policy
				</a>
				.
			</label>
		</div>
	)
}
