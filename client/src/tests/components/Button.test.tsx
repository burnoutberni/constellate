import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '../../components/ui'

describe('Button Component', () => {
	it('should render children text', () => {
		render(<Button>Click me</Button>)

		expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
	})

	it('should call onClick when clicked', () => {
		const handleClick = vi.fn()
		render(<Button onClick={handleClick}>Click</Button>)

		const button = screen.getByRole('button', { name: 'Click' })
		fireEvent.click(button)

		expect(handleClick).toHaveBeenCalledTimes(1)
	})

	it('should be disabled when disabled prop is true', () => {
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

	it('should show loading state and be disabled when loading', () => {
		render(<Button loading>Loading</Button>)

		const button = screen.getByRole('button', { name: 'Loading' })
		expect(button).toBeDisabled()
		expect(button).toHaveAttribute('aria-busy', 'true')
	})

	it('should render left icon when provided', () => {
		render(<Button leftIcon={<span>←</span>}>Back</Button>)

		expect(screen.getByText('Back')).toBeInTheDocument()
	})

	it('should render right icon when provided', () => {
		render(<Button rightIcon={<span>→</span>}>Next</Button>)

		expect(screen.getByText('Next')).toBeInTheDocument()
	})

	it('should not show icons when loading', () => {
		render(
			<Button loading leftIcon={<span>←</span>} rightIcon={<span>→</span>}>
				Loading
			</Button>
		)

		const button = screen.getByRole('button', { name: 'Loading' })
		expect(button).toBeInTheDocument()
	})

	it('should accept standard button HTML attributes', () => {
		render(
			<Button type="submit" aria-label="Submit form">
				Submit
			</Button>
		)

		const button = screen.getByRole('button', { name: 'Submit form' })
		expect(button).toHaveAttribute('type', 'submit')
	})

	it('should be disabled when both disabled and loading are true', () => {
		render(
			<Button disabled loading>
				Button
			</Button>
		)

		const button = screen.getByRole('button', { name: 'Button' })
		expect(button).toBeDisabled()
		expect(button).toHaveAttribute('aria-disabled', 'true')
	})
})
