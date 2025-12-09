import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from './Badge'

describe('Badge Component', () => {
  it('should render children text', () => {
    render(<Badge>Test Badge</Badge>)
    
    expect(screen.getByText('Test Badge')).toBeInTheDocument()
  })

  it('should render with default variant', () => {
    render(<Badge>Default</Badge>)
    
    const badge = screen.getByText('Default')
    expect(badge).toHaveClass('bg-background-secondary', 'text-text-primary')
  })

  it('should render different variants with correct styles', () => {
    const { rerender } = render(<Badge variant="primary">Primary</Badge>)
    expect(screen.getByText('Primary')).toHaveClass('bg-primary-100', 'text-primary-800')

    rerender(<Badge variant="secondary">Secondary</Badge>)
    expect(screen.getByText('Secondary')).toHaveClass('bg-purple-100', 'text-purple-800')

    rerender(<Badge variant="success">Success</Badge>)
    expect(screen.getByText('Success')).toHaveClass('bg-success-100', 'text-success-800')

    rerender(<Badge variant="warning">Warning</Badge>)
    expect(screen.getByText('Warning')).toHaveClass('bg-warning-100', 'text-warning-800')

    rerender(<Badge variant="error">Error</Badge>)
    expect(screen.getByText('Error')).toHaveClass('bg-error-100', 'text-error-800')

    rerender(<Badge variant="info">Info</Badge>)
    expect(screen.getByText('Info')).toHaveClass('bg-blue-100', 'text-blue-800')
  })

  it('should render with different sizes', () => {
    const { rerender } = render(<Badge size="sm">Small</Badge>)
    expect(screen.getByText('Small')).toHaveClass('text-xs', 'px-2', 'py-0.5')

    rerender(<Badge size="md">Medium</Badge>)
    expect(screen.getByText('Medium')).toHaveClass('text-sm', 'px-2.5', 'py-1')

    rerender(<Badge size="lg">Large</Badge>)
    expect(screen.getByText('Large')).toHaveClass('text-base', 'px-3', 'py-1.5')
  })

  it('should render rounded by default', () => {
    render(<Badge>Rounded</Badge>)
    
    const badge = screen.getByText('Rounded')
    expect(badge).toHaveClass('rounded-full')
  })

  it('should render square when rounded is false', () => {
    render(<Badge rounded={false}>Square</Badge>)
    
    const badge = screen.getByText('Square')
    expect(badge).toHaveClass('rounded')
    expect(badge).not.toHaveClass('rounded-full')
  })

  it('should accept custom className', () => {
    render(<Badge className="custom-badge">Custom</Badge>)
    
    const badge = screen.getByText('Custom')
    expect(badge).toHaveClass('custom-badge')
  })

  it('should accept standard HTML attributes', () => {
    render(
      <Badge aria-label="Status badge" data-testid="badge">
        Status
      </Badge>
    )
    
    const badge = screen.getByTestId('badge')
    expect(badge).toHaveAttribute('aria-label', 'Status badge')
  })

  it('should render with React nodes as children', () => {
    render(
      <Badge>
        <span>Icon</span> Label
      </Badge>
    )
    
    expect(screen.getByText('Icon')).toBeInTheDocument()
    expect(screen.getByText('Label')).toBeInTheDocument()
  })
})
