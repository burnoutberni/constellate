import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Skeleton } from '../../components/ui/Skeleton'

describe('Skeleton Component', () => {
	it('user can see skeleton loading placeholder', () => {
		render(<Skeleton data-testid="skeleton" />)

		const skeleton = screen.getByTestId('skeleton')
		expect(skeleton).toBeInTheDocument()
	})

	it('skeleton is hidden from screen readers', () => {
		render(<Skeleton data-testid="skeleton" />)

		const skeleton = screen.getByTestId('skeleton')
		expect(skeleton).toHaveAttribute('aria-hidden', 'true')
	})

	it('skeleton accepts custom styling', () => {
		render(<Skeleton className="w-20 h-10" data-testid="skeleton" />)

		const skeleton = screen.getByTestId('skeleton')
		expect(skeleton).toBeInTheDocument()
	})
})
