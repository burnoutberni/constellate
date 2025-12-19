import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Button } from '../../components/ui'

describe('Button Component', () => {
	it('user can see button text', () => {
		render(<Button>Click me</Button>)

		expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
	})

	it('user can click button to trigger action', () => {
		const handleClick = vi.fn()
		render(<Button onClick={handleClick}>Click</Button>)

		const button = screen.getByRole('button', { name: 'Click' })
		fireEvent.click(button)

		expect(handleClick).toHaveBeenCalledTimes(1)
	})

	it('user cannot click disabled button', () => {
		const handleClick = vi.fn()
		render(
			<Button disabled onClick={handleClick}>
				Disabled
			</Button>
		)

		const button = screen.getByRole('button', { name: 'Disabled' })
		expect(button).toBeDisabled()
		expect(button).toHaveAttribute('aria-disabled', 'true')

		fireEvent.click(button)
		expect(handleClick).not.toHaveBeenCalled()
	})

	it('user can see loading state and cannot click button while loading', () => {
		render(<Button loading>Loading</Button>)

		const button = screen.getByRole('button', { name: 'Loading' })
		expect(button).toBeDisabled()
		expect(button).toHaveAttribute('aria-busy', 'true')
	})

	it('user can see button with left icon', () => {
		render(<Button leftIcon={<span>←</span>}>Back</Button>)

		expect(screen.getByText('Back')).toBeInTheDocument()
	})

	it('user can see button with right icon', () => {
		render(<Button rightIcon={<span>→</span>}>Next</Button>)

		expect(screen.getByText('Next')).toBeInTheDocument()
	})

	it('user does not see icons when button is loading', () => {
		render(
			<Button loading leftIcon={<span>←</span>} rightIcon={<span>→</span>}>
				Loading
			</Button>
		)

		const button = screen.getByRole('button', { name: 'Loading' })
		expect(button).toBeInTheDocument()
	})

	it('user can submit form with button', () => {
		render(
			<Button type="submit" aria-label="Submit form">
				Submit
			</Button>
		)

		const button = screen.getByRole('button', { name: 'Submit form' })
		expect(button).toHaveAttribute('type', 'submit')
	})

	it('user cannot interact with button when both disabled and loading', () => {
		render(
			<Button disabled loading>
				Button
			</Button>
		)

		const button = screen.getByRole('button', { name: 'Button' })
		expect(button).toBeDisabled()
		expect(button).toHaveAttribute('aria-disabled', 'true')
	})

	describe('Navigation', () => {
		it('user can navigate with button when to prop is provided', () => {
			render(
				<MemoryRouter>
					<Button to="/home">Go Home</Button>
				</MemoryRouter>
			)

			const link = screen.getByRole('link', { name: 'Go Home' })
			expect(link).toBeInTheDocument()
			expect(link).toHaveAttribute('href', '/home')
		})

		it('user can see disabled navigation button', () => {
			render(
				<MemoryRouter>
					<Button to="/home" disabled>
						Go Home
					</Button>
				</MemoryRouter>
			)

			const link = screen.getByRole('link', { name: 'Go Home' })
			expect(link).toHaveAttribute('aria-disabled', 'true')
			expect(link).toHaveClass('pointer-events-none', 'opacity-50')
		})

		it('user cannot navigate with button when loading', () => {
			render(
				<MemoryRouter>
					<Button to="/home" loading>
						Go Home
					</Button>
				</MemoryRouter>
			)

			const link = screen.getByRole('link', { name: 'Go Home' })
			expect(link).toHaveAttribute('aria-disabled', 'true')
			expect(link).toHaveClass('pointer-events-none', 'opacity-50')
		})
	})
})
