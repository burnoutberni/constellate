/* eslint-disable no-unused-vars */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LoginPage } from '../../pages/LoginPage'
import { createTestWrapper } from '../testUtils'
import { useAuth } from '../../hooks/useAuth'

type CheckboxChange = (checked: boolean) => void

// Mock useAuth
vi.mock('../../hooks/useAuth', () => ({
	useAuth: vi.fn(),
}))

// Mock TermsOfServiceAgreement to simplify testing
vi.mock('../../components/TermsOfServiceAgreement', () => ({
	TermsOfServiceAgreement: (props: { checked: boolean; onChange: CheckboxChange }) => (
		<label>
			<input
				type="checkbox"
				checked={props.checked}
				onChange={(e) => props.onChange(e.target.checked)}
			/>
			Agree to Terms
		</label>
	)
}))

describe('LoginPage', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(useAuth).mockReturnValue({
			user: null,
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
		expect(screen.getByLabelText('Password')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument()
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
		expect(screen.getByLabelText('Password')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument()
	})

	it('submits login form with valid email and password', async () => {
		const { wrapper } = createTestWrapper()
		const loginMock = vi.fn()
		vi.mocked(useAuth).mockReturnValue({
			user: null,
			loading: false,
			tosStatus: null,
			checkTosStatus: vi.fn(),
			login: loginMock,
			signup: vi.fn(),
			logout: vi.fn(),
		})

		render(<LoginPage />, { wrapper })

		const emailInput = screen.getByLabelText('Email')
		const passwordInput = screen.getByLabelText('Password')
		fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
		fireEvent.change(passwordInput, { target: { value: 'password123' } })

		const submitButton = screen.getByRole('button', { name: 'Sign In' })
		fireEvent.click(submitButton)

		await waitFor(() => {
			expect(loginMock).toHaveBeenCalledWith('test@example.com', 'password123')
		})
	})

	it('submits signup form with valid data', async () => {
		const { wrapper } = createTestWrapper()
		const signupMock = vi.fn()
		vi.mocked(useAuth).mockReturnValue({
			user: null,
			loading: false,
			tosStatus: null,
			checkTosStatus: vi.fn(),
			login: vi.fn(),
			signup: signupMock,
			logout: vi.fn(),
		})

		render(<LoginPage />, { wrapper })

		// Switch to signup
		fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))

		// Fill fields
		fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'newuser' } })
		fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New User' } })
		fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } })
		fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
		
		// Accept ToS (using mocked component)
		const tosCheckbox = screen.getByRole('checkbox')
		fireEvent.click(tosCheckbox)

		const submitButton = screen.getByRole('button', { name: 'Create Account' })
		fireEvent.click(submitButton)

		await waitFor(() => {
			expect(signupMock).toHaveBeenCalledWith('new@example.com', 'password123', 'New User', 'newuser', true)
		})
	})

	it('submits signup form with password', async () => {
		const { wrapper } = createTestWrapper()
		const signupMock = vi.fn()
		vi.mocked(useAuth).mockReturnValue({
			user: null,
			loading: false,
			tosStatus: null,
			checkTosStatus: vi.fn(),
			login: vi.fn(),
			signup: signupMock,
			logout: vi.fn(),
		})

		render(<LoginPage />, { wrapper })

		// Switch to signup
		fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))

		// Fill fields
		fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'newuser' } })
		fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New User' } })
		fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } })
		fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
		
		// Accept ToS
		const tosCheckbox = screen.getByRole('checkbox')
		fireEvent.click(tosCheckbox)

		// Submit
		fireEvent.click(screen.getByRole('button', { name: 'Create Account' }))

		await waitFor(() => {
			expect(signupMock).toHaveBeenCalledWith('new@example.com', 'password123', 'New User', 'newuser', true)
		})
	})

	it('displays error message on failure', async () => {
		const loginMock = vi.fn().mockRejectedValue(new Error('Invalid email'))
		vi.mocked(useAuth).mockReturnValue({
			user: null,
			loading: false,
			tosStatus: null,
			checkTosStatus: vi.fn(),
			login: loginMock,
			signup: vi.fn(),
			logout: vi.fn(),
		})

		const { wrapper } = createTestWrapper()
		render(<LoginPage />, { wrapper })

		fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'bad@email' } })
		fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
		fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))

		await waitFor(() => {
			expect(screen.getByText('Invalid email')).toBeInTheDocument()
		})
	})
})
