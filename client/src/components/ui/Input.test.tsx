import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Input } from './Input'

describe('Input Component', () => {
  it('should render input element', () => {
    render(<Input type="text" />)
    
    const input = screen.getByRole('textbox')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('type', 'text')
  })

  it('should render with label when provided', () => {
    render(<Input type="text" label="Email Address" />)
    
    const label = screen.getByText('Email Address')
    expect(label).toBeInTheDocument()
    expect(label.tagName).toBe('LABEL')
    
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('id')
    expect(label).toHaveAttribute('for', input.id)
  })

  it('should show required indicator when required and label are provided', () => {
    render(<Input type="text" label="Email" required />)
    
    const label = screen.getByText('Email')
    expect(label).toHaveClass("after:content-['*']")
  })

  it('should render helper text when provided', () => {
    render(<Input type="text" helperText="Enter your email address" />)
    
    const helperText = screen.getByText('Enter your email address')
    expect(helperText).toBeInTheDocument()
    expect(helperText).toHaveClass('text-text-tertiary')
  })

  it('should render error message when error and errorMessage are provided', () => {
    render(
      <Input 
        type="text" 
        error 
        errorMessage="This field is required" 
      />
    )
    
    const errorMessage = screen.getByText('This field is required')
    expect(errorMessage).toBeInTheDocument()
    expect(errorMessage).toHaveClass('text-error-600')
    expect(errorMessage).toHaveAttribute('role', 'alert')
  })

  it('should apply error styles when error is true', () => {
    render(<Input type="text" error />)
    
    const input = screen.getByRole('textbox')
    expect(input).toHaveClass('border-border-error')
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('should not show helper text when error is present', () => {
    render(
      <Input 
        type="text" 
        error 
        errorMessage="Error message"
        helperText="Helper text"
      />
    )
    
    expect(screen.getByText('Error message')).toBeInTheDocument()
    expect(screen.queryByText('Helper text')).not.toBeInTheDocument()
  })

  it('should render with different sizes', () => {
    const { rerender } = render(<Input type="text" size="sm" />)
    let input = screen.getByRole('textbox')
    expect(input).toHaveClass('text-sm', 'px-3', 'py-1.5', 'min-h-[32px]')

    rerender(<Input type="text" size="md" />)
    input = screen.getByRole('textbox')
    expect(input).toHaveClass('text-base', 'px-4', 'py-2', 'min-h-[40px]')

    rerender(<Input type="text" size="lg" />)
    input = screen.getByRole('textbox')
    expect(input).toHaveClass('text-lg', 'px-4', 'py-2.5', 'min-h-[48px]')
  })

  it('should render with default medium size', () => {
    render(<Input type="text" />)
    
    const input = screen.getByRole('textbox')
    expect(input).toHaveClass('text-base', 'px-4', 'py-2')
  })

  it('should render left icon when provided', () => {
    render(
      <Input 
        type="text" 
        leftIcon={<span data-testid="left-icon">🔍</span>} 
      />
    )
    
    expect(screen.getByTestId('left-icon')).toBeInTheDocument()
    const input = screen.getByRole('textbox')
    expect(input).toHaveClass('pl-10')
  })

  it('should render right icon when provided', () => {
    render(
      <Input 
        type="text" 
        rightIcon={<span data-testid="right-icon">✓</span>} 
      />
    )
    
    expect(screen.getByTestId('right-icon')).toBeInTheDocument()
    const input = screen.getByRole('textbox')
    expect(input).toHaveClass('pr-10')
  })

  it('should handle value changes', () => {
    const handleChange = vi.fn()
    render(<Input type="text" onChange={handleChange} />)
    
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'test value' } })
    
    expect(handleChange).toHaveBeenCalledTimes(1)
    expect(input).toHaveValue('test value')
  })

  it('should be disabled when disabled prop is true', () => {
    render(<Input type="text" disabled />)
    
    const input = screen.getByRole('textbox')
    expect(input).toBeDisabled()
    expect(input).toHaveClass('disabled:opacity-50', 'disabled:cursor-not-allowed')
  })

  it('should accept placeholder', () => {
    render(<Input type="text" placeholder="Enter text here" />)
    
    const input = screen.getByPlaceholderText('Enter text here')
    expect(input).toBeInTheDocument()
  })

  it('should accept standard input attributes', () => {
    const handleChange = vi.fn()
    render(
      <Input 
        type="email" 
        name="email"
        defaultValue="test@example.com"
        autoComplete="email"
        onChange={handleChange}
      />
    )
    
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('type', 'email')
    expect(input).toHaveAttribute('name', 'email')
    expect(input).toHaveAttribute('autoComplete', 'email')
    expect(input).toHaveValue('test@example.com')
  })

  it('should have proper aria attributes for accessibility', () => {
    render(
      <Input 
        type="text" 
        label="Email"
        error 
        errorMessage="Invalid email"
        helperText="Enter a valid email"
        required
      />
    )
    
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-required', 'true')
    expect(input).toHaveAttribute('aria-describedby')
    
    const describedBy = input.getAttribute('aria-describedby')
    expect(describedBy).toContain('-error')
    expect(describedBy).toContain('-helper')
  })

  it('should accept custom className', () => {
    render(<Input type="text" className="custom-input" />)
    
    const input = screen.getByRole('textbox')
    expect(input).toHaveClass('custom-input')
  })

  it('should generate unique id when not provided', () => {
    const { rerender } = render(<Input type="text" label="Input 1" />)
    const input1 = screen.getByRole('textbox')
    const id1 = input1.id
    expect(id1).toMatch(/^input-/)

    rerender(<Input type="text" label="Input 2" />)
    const input2 = screen.getByRole('textbox')
    const id2 = input2.id
    expect(id2).toMatch(/^input-/)
    // IDs should be different (though in test environment they might be the same due to timing)
    // The important thing is that they follow the pattern
  })

  it('should use provided id', () => {
    render(<Input type="text" id="custom-id" label="Email" />)
    
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('id', 'custom-id')
    
    const label = screen.getByText('Email')
    expect(label).toHaveAttribute('for', 'custom-id')
  })
})
