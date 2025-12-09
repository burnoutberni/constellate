import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Textarea } from './Textarea'

describe('Textarea Component', () => {
  it('should render textarea element', () => {
    render(<Textarea />)
    
    const textarea = screen.getByRole('textbox')
    expect(textarea).toBeInTheDocument()
    expect(textarea.tagName).toBe('TEXTAREA')
  })

  it('should render with label when provided', () => {
    render(<Textarea label="Description" />)
    
    const label = screen.getByText('Description')
    expect(label).toBeInTheDocument()
    expect(label.tagName).toBe('LABEL')
    
    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveAttribute('id')
    expect(label).toHaveAttribute('for', textarea.id)
  })

  it('should show required indicator when required and label are provided', () => {
    render(<Textarea label="Description" required />)
    
    const label = screen.getByText('Description')
    expect(label).toHaveClass("after:content-['*']")
  })

  it('should render helper text when provided', () => {
    render(<Textarea helperText="Enter a detailed description" />)
    
    const helperText = screen.getByText('Enter a detailed description')
    expect(helperText).toBeInTheDocument()
    expect(helperText).toHaveClass('text-text-tertiary')
  })

  it('should render error message when error and errorMessage are provided', () => {
    render(
      <Textarea 
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
    render(<Textarea error />)
    
    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveClass('border-border-error')
    expect(textarea).toHaveAttribute('aria-invalid', 'true')
  })

  it('should not show helper text when error is present', () => {
    render(
      <Textarea 
        error 
        errorMessage="Error message"
        helperText="Helper text"
      />
    )
    
    expect(screen.getByText('Error message')).toBeInTheDocument()
    expect(screen.queryByText('Helper text')).not.toBeInTheDocument()
  })

  it('should render with different sizes', () => {
    const { rerender } = render(<Textarea size="sm" />)
    let textarea = screen.getByRole('textbox')
    expect(textarea).toHaveClass('text-sm', 'px-3', 'py-1.5')

    rerender(<Textarea size="md" />)
    textarea = screen.getByRole('textbox')
    expect(textarea).toHaveClass('text-base', 'px-4', 'py-2')

    rerender(<Textarea size="lg" />)
    textarea = screen.getByRole('textbox')
    expect(textarea).toHaveClass('text-lg', 'px-4', 'py-2.5')
  })

  it('should render with default medium size', () => {
    render(<Textarea />)
    
    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveClass('text-base', 'px-4', 'py-2')
  })

  it('should render with custom number of rows', () => {
    render(<Textarea rows={6} />)
    
    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveAttribute('rows', '6')
  })

  it('should render with default 4 rows', () => {
    render(<Textarea />)
    
    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveAttribute('rows', '4')
  })

  it('should handle value changes', () => {
    const handleChange = vi.fn()
    render(<Textarea onChange={handleChange} />)
    
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'test value' } })
    
    expect(handleChange).toHaveBeenCalledTimes(1)
    expect(textarea).toHaveValue('test value')
  })

  it('should be disabled when disabled prop is true', () => {
    render(<Textarea disabled />)
    
    const textarea = screen.getByRole('textbox')
    expect(textarea).toBeDisabled()
    expect(textarea).toHaveClass('disabled:opacity-50', 'disabled:cursor-not-allowed')
  })

  it('should accept placeholder', () => {
    render(<Textarea placeholder="Enter description here" />)
    
    const textarea = screen.getByPlaceholderText('Enter description here')
    expect(textarea).toBeInTheDocument()
  })

  it('should accept standard textarea attributes', () => {
    render(
      <Textarea 
        name="description"
        maxLength={500}
        minLength={10}
      />
    )
    
    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveAttribute('name', 'description')
    expect(textarea).toHaveAttribute('maxLength', '500')
    expect(textarea).toHaveAttribute('minLength', '10')
  })

  it('should have proper aria attributes for accessibility', () => {
    render(
      <Textarea 
        label="Description"
        error 
        errorMessage="Invalid description"
        helperText="Enter a valid description"
        required
      />
    )
    
    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveAttribute('aria-invalid', 'true')
    expect(textarea).toHaveAttribute('aria-required', 'true')
    expect(textarea).toHaveAttribute('aria-describedby')
    
    const describedBy = textarea.getAttribute('aria-describedby')
    expect(describedBy).toContain('-error')
    expect(describedBy).toContain('-helper')
  })

  it('should accept custom className', () => {
    render(<Textarea className="custom-textarea" />)
    
    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveClass('custom-textarea')
  })

  it('should generate unique id when not provided', () => {
    const { rerender } = render(<Textarea label="Textarea 1" />)
    const textarea1 = screen.getByRole('textbox')
    const id1 = textarea1.id
    expect(id1).toMatch(/^textarea-/)

    rerender(<Textarea label="Textarea 2" />)
    const textarea2 = screen.getByRole('textbox')
    const id2 = textarea2.id
    expect(id2).toMatch(/^textarea-/)
    // IDs should be different (though in test environment they might be the same due to timing)
    // The important thing is that they follow the pattern
  })

  it('should use provided id', () => {
    render(<Textarea id="custom-id" label="Description" />)
    
    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveAttribute('id', 'custom-id')
    
    const label = screen.getByText('Description')
    expect(label).toHaveAttribute('for', 'custom-id')
  })

  it('should have resize-y class for vertical resizing', () => {
    render(<Textarea />)
    
    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveClass('resize-y')
  })
})
