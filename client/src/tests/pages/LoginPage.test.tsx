import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LoginPage } from '../../pages/LoginPage'
import { createTestWrapper } from '../testUtils'
import { useAuth } from '../../hooks/useAuth'

// Mock useAuth
vi.mock('../../hooks/useAuth', () => ({
	useAuth: vi.fn(),
}))

// Mock TermsOfServiceAgreement to simplify testing
vi.mock('../../components/TermsOfServiceAgreement', () => ({
	TermsOfServiceAgreement: ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
		<label>
			<input
				type="checkbox"
				checked={checked}
				onChange={(e) => onChange(e.target.checked)}
			/>
			Agree to Terms
		</label>
	)
}))

describe('LoginPage', () => {
	const sendMagicLinkMock = vi.fn()

	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(useAuth).mockReturnValue({
			user: null,
			sendMagicLink: sendMagicLinkMock,
			loading: false,
			tosStatus: null,
			checkTosStatus: vi.fn(),
			login: vi.fn(),
			signup: vi.fn(),
			logout: vi.fn(),
		})
	})

	it('renders login form by default', () => {
		const { wrapper } = createTestWrapper()
		render(<LoginPage />, { wrapper })

		expect(screen.getByText('Sign in to your account')).toBeInTheDocument()
		expect(screen.getByLabelText('Email')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Send Magic Link' })).toBeInTheDocument()
		expect(screen.queryByLabelText('Username')).not.toBeInTheDocument()
	})

	it('toggles to signup form', () => {
		const { wrapper } = createTestWrapper()
		render(<LoginPage />, { wrapper })

		const toggleButton = screen.getByRole('button', { name: 'Sign up' })
		fireEvent.click(toggleButton)

		expect(screen.getByText('Create a new account')).toBeInTheDocument()
		expect(screen.getByLabelText('Username')).toBeInTheDocument()
		expect(screen.getByLabelText('Name')).toBeInTheDocument()
		expect(screen.getByLabelText('Email')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument()
	})

	it('submits login form with valid email', async () => {
		const { wrapper } = createTestWrapper()
		render(<LoginPage />, { wrapper })

		const emailInput = screen.getByLabelText('Email')
		fireEvent.change(emailInput, { target: { value: 'test@example.com' } })

		const submitButton = screen.getByRole('button', { name: 'Send Magic Link' })
		fireEvent.click(submitButton)

		await waitFor(() => {
			expect(sendMagicLinkMock).toHaveBeenCalledWith('test@example.com')
		})
	})

	it('submits signup form with valid data', async () => {
		const { wrapper } = createTestWrapper()
		render(<LoginPage />, { wrapper })

		// Switch to signup
		fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))

		// Fill fields
		fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'newuser' } })
		fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New User' } })
		fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } })
		
		// Accept ToS (using mocked component)
		const tosCheckbox = screen.getByRole('checkbox')
		fireEvent.click(tosCheckbox)

		const submitButton = screen.getByRole('button', { name: 'Create Account' })
		fireEvent.click(submitButton)

		await waitFor(() => {
			expect(sendMagicLinkMock).toHaveBeenCalledWith('new@example.com', {
				name: 'New User',
				username: 'newuser',
				tosAccepted: true,
			})
		})
	})

	it('shows success message after sending magic link', async () => {
		const { wrapper } = createTestWrapper()
		render(<LoginPage />, { wrapper })

		fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
		fireEvent.click(screen.getByRole('button', { name: 'Send Magic Link' }))

		await waitFor(() => {
			expect(screen.getByText('Check your email')).toBeInTheDocument()
			expect(screen.getByText(/We sent a magic link to/)).toBeInTheDocument()
		})
	})

	it('displays error message on failure', async () => {
		sendMagicLinkMock.mockRejectedValue(new Error('Invalid email'))
		const { wrapper } = createTestWrapper()
		render(<LoginPage />, { wrapper })

		fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'bad@email' } })
		fireEvent.click(screen.getByRole('button', { name: 'Send Magic Link' }))

		await waitFor(() => {
			expect(screen.getByText('Invalid email')).toBeInTheDocument()
		})
	})
})
