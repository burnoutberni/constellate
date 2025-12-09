import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from './Button'

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

  it('should render with default primary variant', () => {
    render(<Button>Primary</Button>)
    
    const button = screen.getByRole('button', { name: 'Primary' })
    expect(button).toHaveClass('bg-primary-600', 'text-white')
  })

  it('should render different variants with correct styles', () => {
    const { rerender } = render(<Button variant="primary">Primary</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-primary-600', 'text-white')

    rerender(<Button variant="secondary">Secondary</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-background-tertiary', 'text-text-primary')

    rerender(<Button variant="ghost">Ghost</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-transparent', 'text-text-secondary')

    rerender(<Button variant="danger">Danger</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-error-600', 'text-white')
  })

  it('should render with different sizes', () => {
    const { rerender } = render(<Button size="sm">Small</Button>)
    expect(screen.getByRole('button')).toHaveClass('text-sm', 'px-3', 'py-1.5', 'min-h-[32px]')

    rerender(<Button size="md">Medium</Button>)
    expect(screen.getByRole('button')).toHaveClass('text-base', 'px-4', 'py-2', 'min-h-[40px]')

    rerender(<Button size="lg">Large</Button>)
    expect(screen.getByRole('button')).toHaveClass('text-lg', 'px-6', 'py-3', 'min-h-[48px]')
  })

  it('should be disabled when disabled prop is true', () => {
    const handleClick = vi.fn()
    render(<Button disabled onClick={handleClick}>Disabled</Button>)
    
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
    
    // Should show spinner
    const spinner = button.querySelector('svg.animate-spin')
    expect(spinner).toBeInTheDocument()
    
    // Text should be hidden
    const textSpan = button.querySelector('span.opacity-0')
    expect(textSpan).toHaveTextContent('Loading')
  })

  it('should render left icon when provided', () => {
    render(
      <Button leftIcon={<span data-testid="left-icon">←</span>}>
        Back
      </Button>
    )
    
    expect(screen.getByTestId('left-icon')).toBeInTheDocument()
    expect(screen.getByText('Back')).toBeInTheDocument()
  })

  it('should render right icon when provided', () => {
    render(
      <Button rightIcon={<span data-testid="right-icon">→</span>}>
        Next
      </Button>
    )
    
    expect(screen.getByTestId('right-icon')).toBeInTheDocument()
    expect(screen.getByText('Next')).toBeInTheDocument()
  })

  it('should not show icons when loading', () => {
    render(
      <Button 
        loading 
        leftIcon={<span data-testid="left-icon">←</span>}
        rightIcon={<span data-testid="right-icon">→</span>}
      >
        Loading
      </Button>
    )
    
    expect(screen.queryByTestId('left-icon')).not.toBeInTheDocument()
    expect(screen.queryByTestId('right-icon')).not.toBeInTheDocument()
  })

  it('should render full width when fullWidth prop is true', () => {
    render(<Button fullWidth>Full Width</Button>)
    
    const button = screen.getByRole('button', { name: 'Full Width' })
    expect(button).toHaveClass('w-full')
  })

  it('should accept standard button HTML attributes', () => {
    render(
      <Button 
        type="submit" 
        aria-label="Submit form"
        data-testid="submit-btn"
      >
        Submit
      </Button>
    )
    
    const button = screen.getByTestId('submit-btn')
    expect(button).toHaveAttribute('type', 'submit')
    expect(button).toHaveAttribute('aria-label', 'Submit form')
  })

  it('should accept custom className', () => {
    render(<Button className="custom-button">Custom</Button>)
    
    const button = screen.getByRole('button', { name: 'Custom' })
    expect(button).toHaveClass('custom-button')
  })

  it('should be disabled when both disabled and loading are true', () => {
    render(<Button disabled loading>Button</Button>)
    
    const button = screen.getByRole('button', { name: 'Button' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-disabled', 'true')
  })
})
