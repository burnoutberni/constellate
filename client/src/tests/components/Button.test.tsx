import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '../testUtils'
import { Button } from '../../components/ui/Button'

describe('Button Component', () => {
	it('renders children correctly', () => {
		render(<Button>Click me</Button>)
		expect(screen.getByText('Click me')).toBeInTheDocument()
	})

	it('handles click events', () => {
		const handleClick = vi.fn()
		render(<Button onClick={handleClick}>Click me</Button>)
		fireEvent.click(screen.getByText('Click me'))
		expect(handleClick).toHaveBeenCalledTimes(1)
	})

	it('renders as a link when "to" prop is provided', () => {
		render(<Button to="/home">Go Home</Button>)
		const link = screen.getByRole('link', { name: 'Go Home' })
		expect(link).toBeInTheDocument()
		expect(link).toHaveAttribute('href', '/home')
	})

	it('supports loading state', () => {
		render(<Button loading>Loading</Button>)
		expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true')
		// The text should be hidden (opacity-0) but still present for a11y?
        // Actually the implementation uses span with opacity-0
		// And renders a Spinner
        // Let's just check it is disabled
        expect(screen.getByRole('button')).toBeDisabled()
	})

	it('supports disabled state', () => {
		render(<Button disabled>Disabled</Button>)
		expect(screen.getByRole('button')).toBeDisabled()
	})

	it('renders icons', () => {
		render(
			<Button
				leftIcon={<span data-testid="left">L</span>}
				rightIcon={<span data-testid="right">R</span>}
			>
				Icon Button
			</Button>
		)
		expect(screen.getByTestId('left')).toBeInTheDocument()
		expect(screen.getByTestId('right')).toBeInTheDocument()
	})

    it('renders different variants', () => {
        const { rerender } = render(<Button variant="danger">Danger</Button>)
        let btn = screen.getByRole('button')
        expect(btn.className).toContain('bg-error-600')

        rerender(<Button variant="outline">Outline</Button>)
        btn = screen.getByRole('button')
        expect(btn.className).toContain('border-primary-600')

        rerender(<Button variant="ghost">Ghost</Button>)
        btn = screen.getByRole('button')
        expect(btn.className).toContain('bg-transparent')

        rerender(<Button variant="secondary">Secondary</Button>)
        btn = screen.getByRole('button')
        expect(btn.className).toContain('bg-white')
    })

    it('renders different sizes', () => {
        const { rerender } = render(<Button size="sm">Small</Button>)
        let btn = screen.getByRole('button')
        expect(btn.className).toContain('text-sm')
        expect(btn.className).toContain('px-3')

        rerender(<Button size="lg">Large</Button>)
        btn = screen.getByRole('button')
        expect(btn.className).toContain('text-base')
        expect(btn.className).toContain('px-6')
    })

    it('renders full width', () => {
        render(<Button fullWidth>Full Width</Button>)
        const btn = screen.getByRole('button')
        expect(btn.className).toContain('w-full')
    })
})
