import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PasswordInput } from '../../components/ui'

describe('PasswordInput Component', () => {
	it('should render password input with hidden text by default', () => {
		render(<PasswordInput label="Password" />)

		const input = screen.getByLabelText('Password')
		expect(input).toHaveAttribute('type', 'password')
	})

	it('should toggle password visibility when icon is clicked', () => {
		render(<PasswordInput label="Password" />)

		const input = screen.getByLabelText('Password')
		expect(input).toHaveAttribute('type', 'password')

		// Find the toggle button by its accessibility name
		const showButton = screen.getByRole('button', { name: /show password/i })
		expect(showButton).toBeInTheDocument()

		// Click to show password
		fireEvent.click(showButton)
		expect(input).toHaveAttribute('type', 'text')

		// Find the toggle button by its new accessibility name
		const hideButton = screen.getByRole('button', { name: /hide password/i })
		expect(hideButton).toBeInTheDocument()

		// Click to hide password
		fireEvent.click(hideButton)
		expect(input).toHaveAttribute('type', 'password')
	})

	it('should accept other input props', () => {
		render(<PasswordInput label="Password" placeholder="Enter password" error />)

		const input = screen.getByLabelText('Password')
		expect(input).toHaveAttribute('placeholder', 'Enter password')
		expect(input).toHaveAttribute('aria-invalid', 'true')
	})
})
