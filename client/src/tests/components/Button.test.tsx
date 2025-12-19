import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Button } from '../../components/ui'

describe('Button Component', () => {
	it('user can click button to trigger action', async () => {
		const user = userEvent.setup()
		const handleClick = vi.fn()
		render(<Button onClick={handleClick}>Click</Button>)

		const button = screen.getByRole('button', { name: 'Click' })
		await user.click(button)

		expect(handleClick).toHaveBeenCalledTimes(1)
	})

	it('user cannot click disabled button', async () => {
		const user = userEvent.setup()
		const handleClick = vi.fn()
		render(
			<Button disabled onClick={handleClick}>
				Disabled
			</Button>
		)

		const button = screen.getByRole('button', { name: 'Disabled' })
		await user.click(button)

		expect(handleClick).not.toHaveBeenCalled()
	})

	it('loading state appears and button cannot be clicked while loading', async () => {
		const user = userEvent.setup()
		const handleClick = vi.fn()
		const { rerender } = render(<Button onClick={handleClick}>Save</Button>)

		const button = screen.getByRole('button', { name: 'Save' })
		expect(button).not.toHaveAttribute('aria-busy', 'true')

		// Set loading state
		rerender(
			<Button loading onClick={handleClick}>
				Save
			</Button>
		)

		const loadingButton = screen.getByRole('button', { name: 'Save' })
		expect(loadingButton).toHaveAttribute('aria-busy', 'true')
		expect(loadingButton).toBeDisabled()

		await user.click(loadingButton)
		expect(handleClick).not.toHaveBeenCalled()

		// Loading state disappears
		rerender(<Button onClick={handleClick}>Save</Button>)

		const normalButton = screen.getByRole('button', { name: 'Save' })
		expect(normalButton).not.toHaveAttribute('aria-busy', 'true')
		expect(normalButton).not.toBeDisabled()
	})

	it('keyboard navigation works with Enter key', async () => {
		const user = userEvent.setup()
		const handleClick = vi.fn()
		render(<Button onClick={handleClick}>Submit</Button>)

		const button = screen.getByRole('button', { name: 'Submit' })
		button.focus()
		await user.keyboard('{Enter}')

		expect(handleClick).toHaveBeenCalledTimes(1)
	})

	it('keyboard navigation works with Space key', async () => {
		const user = userEvent.setup()
		const handleClick = vi.fn()
		render(<Button onClick={handleClick}>Submit</Button>)

		const button = screen.getByRole('button', { name: 'Submit' })
		button.focus()
		await user.keyboard(' ')

		expect(handleClick).toHaveBeenCalledTimes(1)
	})

	it('user can submit a form and see success', async () => {
		const user = userEvent.setup()
		const handleSubmit = vi.fn((e) => {
			e.preventDefault()
		})

		render(
			<form onSubmit={handleSubmit}>
				<input type="text" name="name" defaultValue="Test" />
				<Button type="submit">Submit Form</Button>
			</form>
		)

		const button = screen.getByRole('button', { name: 'Submit Form' })
		await user.click(button)

		expect(handleSubmit).toHaveBeenCalledTimes(1)
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

		it('user cannot navigate with disabled link button', () => {
			render(
				<MemoryRouter>
					<Button to="/home" disabled>
						Go Home
					</Button>
				</MemoryRouter>
			)

			const link = screen.getByRole('link', { name: 'Go Home' })
			// Link should be marked as disabled for accessibility
			expect(link).toHaveAttribute('aria-disabled', 'true')
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
			// Link should be marked as disabled for accessibility
			expect(link).toHaveAttribute('aria-disabled', 'true')
		})
	})
})
