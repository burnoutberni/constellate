import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Spinner } from '../../components/ui/Spinner'

describe('Spinner Component', () => {
	it('user can see loading spinner', () => {
		render(<Spinner data-testid="spinner" />)

		const spinner = screen.getByTestId('spinner')
		expect(spinner).toBeInTheDocument()
		expect(spinner.tagName).toBe('svg')
	})

	it('spinner announces loading state to screen readers', () => {
		render(<Spinner data-testid="spinner" />)

		const spinner = screen.getByTestId('spinner')
		expect(spinner).toHaveAttribute('role', 'status')
		expect(spinner).toHaveAttribute('aria-label', 'Loading')
	})

	it('spinner can be rendered in different sizes', () => {
		const { rerender } = render(<Spinner size="sm" data-testid="spinner" />)
		expect(screen.getByTestId('spinner')).toBeInTheDocument()

		rerender(<Spinner size="lg" data-testid="spinner" />)
		expect(screen.getByTestId('spinner')).toBeInTheDocument()

		rerender(<Spinner size="xl" data-testid="spinner" />)
		expect(screen.getByTestId('spinner')).toBeInTheDocument()
	})

	it('spinner can be rendered in different color variants', () => {
		const { rerender } = render(<Spinner variant="primary" data-testid="spinner" />)
		expect(screen.getByTestId('spinner')).toBeInTheDocument()

		rerender(<Spinner variant="secondary" data-testid="spinner" />)
		expect(screen.getByTestId('spinner')).toBeInTheDocument()

		rerender(<Spinner variant="white" data-testid="spinner" />)
		expect(screen.getByTestId('spinner')).toBeInTheDocument()
	})
})
