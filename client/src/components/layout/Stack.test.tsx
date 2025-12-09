import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Stack } from './Stack'

describe('Stack Component', () => {
  it('should render children content', () => {
    render(
      <Stack>
        <div>Item 1</div>
        <div>Item 2</div>
      </Stack>
    )
    
    expect(screen.getByText('Item 1')).toBeInTheDocument()
    expect(screen.getByText('Item 2')).toBeInTheDocument()
  })

  it('should render with default column direction', () => {
    render(<Stack data-testid="stack">Content</Stack>)
    
    const stack = screen.getByTestId('stack')
    expect(stack).toHaveClass('flex', 'flex-col')
  })

  it('should render with row direction', () => {
    render(<Stack direction="row" data-testid="stack">Content</Stack>)
    
    const stack = screen.getByTestId('stack')
    expect(stack).toHaveClass('flex-row')
  })

  it('should apply responsive direction classes', () => {
    render(
      <Stack 
        direction="column" 
        directionSm="row" 
        directionMd="column" 
        directionLg="row"
        data-testid="stack"
      >
        Content
      </Stack>
    )
    
    const stack = screen.getByTestId('stack')
    expect(stack).toHaveClass(
      'flex-col',
      'sm:flex-row',
      'md:flex-col',
      'lg:flex-row'
    )
  })

  it('should render with default alignment (start)', () => {
    render(<Stack data-testid="stack">Content</Stack>)
    
    const stack = screen.getByTestId('stack')
    expect(stack).toHaveClass('items-start')
  })

  it('should render with different alignments', () => {
    const { rerender } = render(<Stack align="start" data-testid="stack">Content</Stack>)
    expect(screen.getByTestId('stack')).toHaveClass('items-start')

    rerender(<Stack align="center" data-testid="stack">Content</Stack>)
    expect(screen.getByTestId('stack')).toHaveClass('items-center')

    rerender(<Stack align="end" data-testid="stack">Content</Stack>)
    expect(screen.getByTestId('stack')).toHaveClass('items-end')

    rerender(<Stack align="stretch" data-testid="stack">Content</Stack>)
    expect(screen.getByTestId('stack')).toHaveClass('items-stretch')
  })

  it('should render with default justification (start)', () => {
    render(<Stack data-testid="stack">Content</Stack>)
    
    const stack = screen.getByTestId('stack')
    expect(stack).toHaveClass('justify-start')
  })

  it('should render with different justifications', () => {
    const { rerender } = render(<Stack justify="start" data-testid="stack">Content</Stack>)
    expect(screen.getByTestId('stack')).toHaveClass('justify-start')

    rerender(<Stack justify="center" data-testid="stack">Content</Stack>)
    expect(screen.getByTestId('stack')).toHaveClass('justify-center')

    rerender(<Stack justify="end" data-testid="stack">Content</Stack>)
    expect(screen.getByTestId('stack')).toHaveClass('justify-end')

    rerender(<Stack justify="between" data-testid="stack">Content</Stack>)
    expect(screen.getByTestId('stack')).toHaveClass('justify-between')

    rerender(<Stack justify="around" data-testid="stack">Content</Stack>)
    expect(screen.getByTestId('stack')).toHaveClass('justify-around')

    rerender(<Stack justify="evenly" data-testid="stack">Content</Stack>)
    expect(screen.getByTestId('stack')).toHaveClass('justify-evenly')
  })

  it('should render with default gap (md)', () => {
    render(<Stack data-testid="stack">Content</Stack>)
    
    const stack = screen.getByTestId('stack')
    expect(stack).toHaveClass('gap-4')
  })

  it('should render with different gap sizes', () => {
    const { rerender } = render(<Stack gap="none" data-testid="stack">Content</Stack>)
    expect(screen.getByTestId('stack')).toHaveClass('gap-0')

    rerender(<Stack gap="xs" data-testid="stack">Content</Stack>)
    expect(screen.getByTestId('stack')).toHaveClass('gap-1')

    rerender(<Stack gap="sm" data-testid="stack">Content</Stack>)
    expect(screen.getByTestId('stack')).toHaveClass('gap-2')

    rerender(<Stack gap="md" data-testid="stack">Content</Stack>)
    expect(screen.getByTestId('stack')).toHaveClass('gap-4')

    rerender(<Stack gap="lg" data-testid="stack">Content</Stack>)
    expect(screen.getByTestId('stack')).toHaveClass('gap-6')

    rerender(<Stack gap="xl" data-testid="stack">Content</Stack>)
    expect(screen.getByTestId('stack')).toHaveClass('gap-8')

    rerender(<Stack gap="2xl" data-testid="stack">Content</Stack>)
    expect(screen.getByTestId('stack')).toHaveClass('gap-12')
  })

  it('should not wrap by default', () => {
    render(<Stack data-testid="stack">Content</Stack>)
    
    const stack = screen.getByTestId('stack')
    expect(stack).not.toHaveClass('flex-wrap')
  })

  it('should wrap when wrap prop is true', () => {
    render(<Stack wrap data-testid="stack">Content</Stack>)
    
    const stack = screen.getByTestId('stack')
    expect(stack).toHaveClass('flex-wrap')
  })

  it('should have full width', () => {
    render(<Stack data-testid="stack">Content</Stack>)
    
    const stack = screen.getByTestId('stack')
    expect(stack).toHaveClass('w-full')
  })

  it('should accept custom className', () => {
    render(<Stack className="custom-stack" data-testid="stack">Content</Stack>)
    
    const stack = screen.getByTestId('stack')
    expect(stack).toHaveClass('custom-stack')
  })

  it('should accept standard HTML div attributes', () => {
    render(
      <Stack 
        data-testid="stack"
        id="test-stack"
        aria-label="Test stack"
      >
        Content
      </Stack>
    )
    
    const stack = screen.getByTestId('stack')
    expect(stack).toHaveAttribute('id', 'test-stack')
    expect(stack).toHaveAttribute('aria-label', 'Test stack')
  })
})
