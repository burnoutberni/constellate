import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TermsOfServiceAgreement } from '../../components/TermsOfServiceAgreement'

describe('TermsOfServiceAgreement Component', () => {
	const mockOnChange = vi.fn()

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('should render checkbox and label', () => {
		render(<TermsOfServiceAgreement checked={false} onChange={mockOnChange} />)

		const checkbox = screen.getByRole('checkbox')
		expect(checkbox).toBeInTheDocument()
		expect(checkbox).not.toBeChecked()

		expect(screen.getByText(/I agree to the/i)).toBeInTheDocument()
		expect(screen.getByText('Terms of Service')).toBeInTheDocument()
		expect(screen.getByText('Privacy Policy')).toBeInTheDocument()
	})

	it('should show checkbox as checked when checked prop is true', () => {
		render(<TermsOfServiceAgreement checked={true} onChange={mockOnChange} />)

		const checkbox = screen.getByRole('checkbox')
		expect(checkbox).toBeChecked()
	})

	it('should call onChange when checkbox is clicked', async () => {
		const user = userEvent.setup()
		render(<TermsOfServiceAgreement checked={false} onChange={mockOnChange} />)

		const checkbox = screen.getByRole('checkbox')
		await user.click(checkbox)

		expect(mockOnChange).toHaveBeenCalledTimes(1)
		expect(mockOnChange).toHaveBeenCalledWith(true)
	})

	it('should call onChange with false when unchecking', async () => {
		const user = userEvent.setup()
		render(<TermsOfServiceAgreement checked={true} onChange={mockOnChange} />)

		const checkbox = screen.getByRole('checkbox')
		await user.click(checkbox)

		expect(mockOnChange).toHaveBeenCalledTimes(1)
		expect(mockOnChange).toHaveBeenCalledWith(false)
	})

	it('should use custom id when provided', () => {
		render(
			<TermsOfServiceAgreement id="custom-tos-id" checked={false} onChange={mockOnChange} />
		)

		const checkbox = screen.getByRole('checkbox')
		expect(checkbox).toHaveAttribute('id', 'custom-tos-id')

		const label = screen.getByText(/I agree to the/i).closest('label')
		expect(label).toHaveAttribute('for', 'custom-tos-id')
	})

	it('should use default id when not provided', () => {
		render(<TermsOfServiceAgreement checked={false} onChange={mockOnChange} />)

		const checkbox = screen.getByRole('checkbox')
		expect(checkbox).toHaveAttribute('id', 'tos-agreement')

		const label = screen.getByText(/I agree to the/i).closest('label')
		expect(label).toHaveAttribute('for', 'tos-agreement')
	})

	it('should have links to terms and privacy pages', () => {
		render(<TermsOfServiceAgreement checked={false} onChange={mockOnChange} />)

		const termsLink = screen.getByText('Terms of Service').closest('a')
		expect(termsLink).toHaveAttribute('href', '/terms')
		expect(termsLink).toHaveAttribute('target', '_blank')
		expect(termsLink).toHaveAttribute('rel', 'noopener noreferrer')

		const privacyLink = screen.getByText('Privacy Policy').closest('a')
		expect(privacyLink).toHaveAttribute('href', '/privacy')
		expect(privacyLink).toHaveAttribute('target', '_blank')
		expect(privacyLink).toHaveAttribute('rel', 'noopener noreferrer')
	})

	it('should be accessible with proper label association', () => {
		render(<TermsOfServiceAgreement checked={false} onChange={mockOnChange} />)

		const checkbox = screen.getByRole('checkbox')
		const label = screen.getByText(/I agree to the/i).closest('label')

		expect(label).toHaveAttribute('for', checkbox.id)
		expect(checkbox).toHaveAttribute('id', label?.getAttribute('for'))
	})
})
