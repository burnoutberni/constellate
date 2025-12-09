import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Grid } from './Grid'

describe('Grid Component', () => {
  it('should render children content', () => {
    render(
      <Grid>
        <div>Item 1</div>
        <div>Item 2</div>
      </Grid>
    )
    
    expect(screen.getByText('Item 1')).toBeInTheDocument()
    expect(screen.getByText('Item 2')).toBeInTheDocument()
  })

  it('should render with default single column', () => {
    render(<Grid data-testid="grid">Content</Grid>)
    
    const grid = screen.getByTestId('grid')
    expect(grid).toHaveClass('grid', 'grid-cols-1')
  })

  it('should render with different column counts', () => {
    const { rerender } = render(<Grid cols={2} data-testid="grid">Content</Grid>)
    expect(screen.getByTestId('grid')).toHaveClass('grid-cols-2')

    rerender(<Grid cols={3} data-testid="grid">Content</Grid>)
    expect(screen.getByTestId('grid')).toHaveClass('grid-cols-3')

    rerender(<Grid cols={4} data-testid="grid">Content</Grid>)
    expect(screen.getByTestId('grid')).toHaveClass('grid-cols-4')

    rerender(<Grid cols={6} data-testid="grid">Content</Grid>)
    expect(screen.getByTestId('grid')).toHaveClass('grid-cols-6')

    rerender(<Grid cols={12} data-testid="grid">Content</Grid>)
    expect(screen.getByTestId('grid')).toHaveClass('grid-cols-12')
  })

  it('should apply responsive column classes', () => {
    render(
      <Grid 
        cols={1} 
        colsSm={2} 
        colsMd={3} 
        colsLg={4} 
        colsXl={6}
        data-testid="grid"
      >
        Content
      </Grid>
    )
    
    const grid = screen.getByTestId('grid')
    expect(grid).toHaveClass(
      'grid-cols-1',
      'sm:grid-cols-2',
      'md:grid-cols-3',
      'lg:grid-cols-4',
      'xl:grid-cols-6'
    )
  })

  it('should render with default gap (md)', () => {
    render(<Grid data-testid="grid">Content</Grid>)
    
    const grid = screen.getByTestId('grid')
    expect(grid).toHaveClass('gap-4', 'sm:gap-6')
  })

  it('should render with different gap sizes', () => {
    const { rerender } = render(<Grid gap="none" data-testid="grid">Content</Grid>)
    expect(screen.getByTestId('grid')).toHaveClass('gap-0')

    rerender(<Grid gap="sm" data-testid="grid">Content</Grid>)
    expect(screen.getByTestId('grid')).toHaveClass('gap-2', 'sm:gap-3')

    rerender(<Grid gap="md" data-testid="grid">Content</Grid>)
    expect(screen.getByTestId('grid')).toHaveClass('gap-4', 'sm:gap-6')

    rerender(<Grid gap="lg" data-testid="grid">Content</Grid>)
    expect(screen.getByTestId('grid')).toHaveClass('gap-6', 'sm:gap-8')

    rerender(<Grid gap="xl" data-testid="grid">Content</Grid>)
    expect(screen.getByTestId('grid')).toHaveClass('gap-8', 'sm:gap-12')
  })

  it('should not have equal height by default', () => {
    render(<Grid data-testid="grid">Content</Grid>)
    
    const grid = screen.getByTestId('grid')
    expect(grid).not.toHaveClass('items-stretch')
  })

  it('should have equal height when equalHeight prop is true', () => {
    render(<Grid equalHeight data-testid="grid">Content</Grid>)
    
    const grid = screen.getByTestId('grid')
    expect(grid).toHaveClass('items-stretch')
  })

  it('should have full width', () => {
    render(<Grid data-testid="grid">Content</Grid>)
    
    const grid = screen.getByTestId('grid')
    expect(grid).toHaveClass('w-full')
  })

  it('should accept custom className', () => {
    render(<Grid className="custom-grid" data-testid="grid">Content</Grid>)
    
    const grid = screen.getByTestId('grid')
    expect(grid).toHaveClass('custom-grid')
  })

  it('should accept standard HTML div attributes', () => {
    render(
      <Grid 
        data-testid="grid"
        id="test-grid"
        aria-label="Test grid"
      >
        Content
      </Grid>
    )
    
    const grid = screen.getByTestId('grid')
    expect(grid).toHaveAttribute('id', 'test-grid')
    expect(grid).toHaveAttribute('aria-label', 'Test grid')
  })
})
