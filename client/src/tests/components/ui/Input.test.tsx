import { describe, it, expect } from 'vitest'
import { render, screen } from '../../testUtils'
import { Input } from '../../../components/ui/Input'

describe('Input Component', () => {
	it('renders correctly', () => {
		render(<Input placeholder="Test input" />)
		const input = screen.getByPlaceholderText('Test input')
		expect(input).toBeInTheDocument()
	})

	it('renders with label', () => {
		render(<Input label="Test Label" />)
		expect(screen.getByText('Test Label')).toBeInTheDocument()
	})

	it('renders with error message', () => {
		render(<Input error errorMessage="Error occurred" />)
		expect(screen.getByText('Error occurred')).toBeInTheDocument()
		expect(screen.getByRole('alert')).toBeInTheDocument()
	})

	it('renders with helper text', () => {
		render(<Input helperText="Helper text" />)
		expect(screen.getByText('Helper text')).toBeInTheDocument()
	})

	it('renders with left icon', () => {
		render(<Input leftIcon={<span data-testid="left-icon">Icon</span>} />)
		expect(screen.getByTestId('left-icon')).toBeInTheDocument()
	})

	it('renders with right icon', () => {
		render(<Input rightIcon={<span data-testid="right-icon">Icon</span>} />)
		expect(screen.getByTestId('right-icon')).toBeInTheDocument()
	})

	it('applies error styles when error prop is true', () => {
		render(<Input error placeholder="Error input" />)
		const input = screen.getByPlaceholderText('Error input')
		expect(input).toHaveAttribute('aria-invalid', 'true')
	})

	it('supports disabled state', () => {
		render(<Input disabled placeholder="Disabled" />)
		const input = screen.getByPlaceholderText('Disabled')
		expect(input).toBeDisabled()
	})

    it('supports required state', () => {
        render(<Input required label="Required Label" />)
        const input = screen.getByLabelText(/Required Label/i)
        expect(input).toBeRequired()
    })

    it('supports different sizes', () => {
        const { rerender } = render(<Input size="sm" placeholder="Small" />)
        let input = screen.getByPlaceholderText('Small')
        // Check for small size classes
        expect(input.className).toContain('text-sm')
        expect(input.className).toContain('px-3')

        rerender(<Input size="lg" placeholder="Large" />)
        input = screen.getByPlaceholderText('Large')
        // Check for large size classes
        expect(input.className).toContain('text-base')
        expect(input.className).toContain('px-4')
    })
})
