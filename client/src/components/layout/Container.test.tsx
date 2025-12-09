import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Container } from './Container'

describe('Container Component', () => {
  it('should render children content', () => {
    render(<Container>Container content</Container>)
    
    expect(screen.getByText('Container content')).toBeInTheDocument()
  })

  it('should render with default size (lg)', () => {
    render(<Container data-testid="container">Content</Container>)
    
    const container = screen.getByTestId('container')
    expect(container).toHaveClass('max-w-screen-lg')
  })

  it('should render with different sizes', () => {
    const { rerender } = render(<Container size="sm" data-testid="container">Small</Container>)
    expect(screen.getByTestId('container')).toHaveClass('max-w-screen-sm')

    rerender(<Container size="md" data-testid="container">Medium</Container>)
    expect(screen.getByTestId('container')).toHaveClass('max-w-screen-md')

    rerender(<Container size="lg" data-testid="container">Large</Container>)
    expect(screen.getByTestId('container')).toHaveClass('max-w-screen-lg')

    rerender(<Container size="xl" data-testid="container">Extra Large</Container>)
    expect(screen.getByTestId('container')).toHaveClass('max-w-screen-xl')

    rerender(<Container size="full" data-testid="container">Full</Container>)
    expect(screen.getByTestId('container')).toHaveClass('max-w-full')
  })

  it('should have horizontal padding by default', () => {
    render(<Container data-testid="container">Content</Container>)
    
    const container = screen.getByTestId('container')
    expect(container).toHaveClass('px-4', 'sm:px-6', 'lg:px-8')
  })

  it('should not have padding when padding prop is false', () => {
    render(<Container padding={false} data-testid="container">Content</Container>)
    
    const container = screen.getByTestId('container')
    expect(container).toHaveClass('px-0')
    expect(container).not.toHaveClass('px-4')
  })

  it('should be centered with mx-auto', () => {
    render(<Container data-testid="container">Content</Container>)
    
    const container = screen.getByTestId('container')
    expect(container).toHaveClass('mx-auto')
  })

  it('should have full width', () => {
    render(<Container data-testid="container">Content</Container>)
    
    const container = screen.getByTestId('container')
    expect(container).toHaveClass('w-full')
  })

  it('should accept custom className', () => {
    render(<Container className="custom-container" data-testid="container">Content</Container>)
    
    const container = screen.getByTestId('container')
    expect(container).toHaveClass('custom-container')
  })

  it('should accept standard HTML div attributes', () => {
    render(
      <Container 
        data-testid="container"
        id="test-container"
        aria-label="Test container"
      >
        Content
      </Container>
    )
    
    const container = screen.getByTestId('container')
    expect(container).toHaveAttribute('id', 'test-container')
    expect(container).toHaveAttribute('aria-label', 'Test container')
  })
})
