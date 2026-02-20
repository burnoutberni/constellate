import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Select } from '../../components/ui/Select'

describe('Select Component', () => {
	it('renders correctly with default props', () => {
		render(
			<Select>
				<option value="1">Option 1</option>
				<option value="2">Option 2</option>
			</Select>
		)
		const select = screen.getByRole('combobox')
		expect(select).toBeInTheDocument()
		expect(select).not.toBeDisabled()
		expect(select).toHaveClass('text-sm') // Default md size
	})

	it('renders with label and helper text', () => {
		render(
			<Select label="Test Label" helperText="Test Helper">
				<option value="1">Option 1</option>
			</Select>
		)
		expect(screen.getByText('Test Label')).toBeInTheDocument()
		expect(screen.getByText('Test Helper')).toBeInTheDocument()
		expect(screen.getByRole('combobox')).toHaveAccessibleName('Test Label')
	})

	it('renders error state correctly', () => {
		render(
			<Select error errorMessage="Test Error">
				<option value="1">Option 1</option>
			</Select>
		)
		const select = screen.getByRole('combobox')
		expect(select).toHaveAttribute('aria-invalid', 'true')
		expect(screen.getByText('Test Error')).toBeInTheDocument()
		expect(select).toHaveClass('border-error-300')
	})

	it('handles disabled state', () => {
		render(
			<Select disabled>
				<option value="1">Option 1</option>
			</Select>
		)
		expect(screen.getByRole('combobox')).toBeDisabled()
	})

	it('handles size variants', () => {
		const { rerender } = render(
			<Select size="sm">
				<option>Small</option>
			</Select>
		)
		let select = screen.getByRole('combobox')
		expect(select).toHaveClass('py-1.5')

		rerender(
			<Select size="lg">
				<option>Large</option>
			</Select>
		)
		select = screen.getByRole('combobox')
		expect(select).toHaveClass('py-3')
	})

	it('handles user interaction', async () => {
		const handleChange = vi.fn()
		render(
			<Select onChange={handleChange}>
				<option value="1">Option 1</option>
				<option value="2">Option 2</option>
			</Select>
		)

		const select = screen.getByRole('combobox')
		await userEvent.selectOptions(select, '2')

		expect(handleChange).toHaveBeenCalled()
		expect(select).toHaveValue('2')
	})

	it('applies fullWidth class when prop is true', () => {
		const { container } = render(
			<Select fullWidth>
				<option>Full Width</option>
			</Select>
		)
		// Check the container div for w-full
		expect(container.firstChild).toHaveClass('w-full')
	})

    it('forwards ref correctly', () => {
        const ref = { current: null }
        render(<Select ref={ref}><option>Ref Test</option></Select>)
        expect(ref.current).toBeInstanceOf(HTMLSelectElement)
    })
})
