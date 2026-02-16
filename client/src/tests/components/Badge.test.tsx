import { describe, it, expect } from 'vitest'
import { render, screen } from '../testUtils'
import { Badge } from '../../components/ui/Badge'

describe('Badge Component', () => {
	it('renders children correctly', () => {
		render(<Badge>Test Badge</Badge>)
		expect(screen.getByText('Test Badge')).toBeInTheDocument()
	})

	it('applies default styles', () => {
		render(<Badge>Default</Badge>)
		const badge = screen.getByText('Default')
		expect(badge.className).toContain('bg-neutral-100')
		expect(badge.className).toContain('text-xs') // Default size is md
		expect(badge.className).toContain('rounded-full') // Default rounded is true
	})

	it('supports different variants', () => {
		const { rerender } = render(<Badge variant="primary">Primary</Badge>)
		let badge = screen.getByText('Primary')
		expect(badge.className).toContain('bg-primary-50')

		rerender(<Badge variant="secondary">Secondary</Badge>)
		badge = screen.getByText('Secondary')
		expect(badge.className).toContain('bg-secondary-50')

		rerender(<Badge variant="success">Success</Badge>)
		badge = screen.getByText('Success')
		expect(badge.className).toContain('bg-success-50')

		rerender(<Badge variant="warning">Warning</Badge>)
		badge = screen.getByText('Warning')
		expect(badge.className).toContain('bg-warning-50')

		rerender(<Badge variant="error">Error</Badge>)
		badge = screen.getByText('Error')
		expect(badge.className).toContain('bg-error-50')

		rerender(<Badge variant="info">Info</Badge>)
		badge = screen.getByText('Info')
		expect(badge.className).toContain('bg-info-50')

		rerender(<Badge variant="outline">Outline</Badge>)
		badge = screen.getByText('Outline')
		expect(badge.className).toContain('bg-transparent')
		expect(badge.className).toContain('border-neutral-300')
	})

	it('supports different sizes', () => {
		const { rerender } = render(<Badge size="sm">Small</Badge>)
		let badge = screen.getByText('Small')
		expect(badge.className).toContain('text-[10px]')

		rerender(<Badge size="lg">Large</Badge>)
		badge = screen.getByText('Large')
		expect(badge.className).toContain('text-sm')
	})

	it('supports rounded prop', () => {
		render(<Badge rounded={false}>Squared</Badge>)
		const badge = screen.getByText('Squared')
		expect(badge.className).toContain('rounded-md')
		expect(badge.className).not.toContain('rounded-full')
	})

	it('merges custom className', () => {
		render(<Badge className="custom-class">Custom</Badge>)
		const badge = screen.getByText('Custom')
		expect(badge.className).toContain('custom-class')
	})
})
