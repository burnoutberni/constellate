import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from './Card'

describe('Card Component', () => {
  it('should render children content', () => {
    render(<Card>Card content</Card>)
    
    expect(screen.getByText('Card content')).toBeInTheDocument()
  })

  it('should render with default variant', () => {
    render(<Card>Default</Card>)
    
    const card = screen.getByText('Default').closest('div')
    expect(card).toHaveClass('bg-background-primary', 'border', 'border-border-default')
  })

  it('should render different variants with correct styles', () => {
    const { rerender } = render(<Card variant="default">Default</Card>)
    let card = screen.getByText('Default').closest('div')
    expect(card).toHaveClass('bg-background-primary', 'border', 'border-border-default')

    rerender(<Card variant="outlined">Outlined</Card>)
    card = screen.getByText('Outlined').closest('div')
    expect(card).toHaveClass('bg-transparent', 'border-2', 'border-border-hover')

    rerender(<Card variant="elevated">Elevated</Card>)
    card = screen.getByText('Elevated').closest('div')
    expect(card).toHaveClass('bg-background-primary', 'shadow-md')

    rerender(<Card variant="flat">Flat</Card>)
    card = screen.getByText('Flat').closest('div')
    expect(card).toHaveClass('bg-background-secondary')
  })

  it('should render with different padding sizes', () => {
    const { rerender } = render(<Card padding="none">No padding</Card>)
    let card = screen.getByText('No padding').closest('div')
    expect(card).toHaveClass('p-0')

    rerender(<Card padding="sm">Small padding</Card>)
    card = screen.getByText('Small padding').closest('div')
    expect(card).toHaveClass('p-3')

    rerender(<Card padding="md">Medium padding</Card>)
    card = screen.getByText('Medium padding').closest('div')
    expect(card).toHaveClass('p-4')

    rerender(<Card padding="lg">Large padding</Card>)
    card = screen.getByText('Large padding').closest('div')
    expect(card).toHaveClass('p-6')
  })

  it('should render with default medium padding', () => {
    render(<Card>Default padding</Card>)
    
    const card = screen.getByText('Default padding').closest('div')
    expect(card).toHaveClass('p-4')
  })

  it('should be interactive when interactive prop is true', () => {
    const handleClick = vi.fn()
    render(
      <Card interactive onClick={handleClick}>
        Interactive card
      </Card>
    )
    
    const card = screen.getByText('Interactive card').closest('div')
    expect(card).toHaveClass('cursor-pointer', 'hover:shadow-lg')
    
    fireEvent.click(card!)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('should have role="button" and tabIndex="0" when interactive', () => {
    const handleClick = vi.fn()
    render(
      <Card interactive onClick={handleClick}>
        Interactive card
      </Card>
    )
    
    const card = screen.getByText('Interactive card').closest('div')
    expect(card).toHaveAttribute('role', 'button')
    expect(card).toHaveAttribute('tabIndex', '0')
  })

  it('should not have role or tabIndex when not interactive', () => {
    render(<Card>Non-interactive</Card>)
    
    const card = screen.getByText('Non-interactive').closest('div')
    expect(card).not.toHaveAttribute('role')
    expect(card).not.toHaveAttribute('tabIndex')
  })

  it('should trigger onClick when Enter key is pressed', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()
    render(
      <Card interactive onClick={handleClick}>
        Interactive card
      </Card>
    )
    
    const card = screen.getByText('Interactive card').closest('div')
    card?.focus()
    await user.keyboard('{Enter}')
    
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('should trigger onClick when Space key is pressed', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()
    render(
      <Card interactive onClick={handleClick}>
        Interactive card
      </Card>
    )
    
    const card = screen.getByText('Interactive card').closest('div')
    card?.focus()
    await user.keyboard(' ')
    
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('should call custom onKeyDown handler and still handle Enter key', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()
    const handleKeyDown = vi.fn()
    render(
      <Card interactive onClick={handleClick} onKeyDown={handleKeyDown}>
        Interactive card
      </Card>
    )
    
    const card = screen.getByText('Interactive card').closest('div')
    card?.focus()
    await user.keyboard('{Enter}')
    
    expect(handleKeyDown).toHaveBeenCalledTimes(1)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('should not trigger onClick for other keys', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()
    render(
      <Card interactive onClick={handleClick}>
        Interactive card
      </Card>
    )
    
    const card = screen.getByText('Interactive card').closest('div')
    card?.focus()
    await user.keyboard('{Tab}')
    await user.keyboard('{Escape}')
    
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('should not be interactive by default', () => {
    render(<Card>Non-interactive</Card>)
    
    const card = screen.getByText('Non-interactive').closest('div')
    expect(card).not.toHaveClass('cursor-pointer')
  })

  it('should accept custom className', () => {
    render(<Card className="custom-card">Custom</Card>)
    
    const card = screen.getByText('Custom').closest('div')
    expect(card).toHaveClass('custom-card')
  })
})

describe('CardHeader Component', () => {
  it('should render children content', () => {
    render(
      <Card>
        <CardHeader>Header content</CardHeader>
      </Card>
    )
    
    expect(screen.getByText('Header content')).toBeInTheDocument()
  })

  it('should have correct styling', () => {
    render(
      <Card>
        <CardHeader data-testid="header">Header</CardHeader>
      </Card>
    )
    
    const header = screen.getByTestId('header')
    expect(header).toHaveClass('flex', 'items-center', 'justify-between', 'mb-4')
  })

  it('should accept custom className', () => {
    render(
      <Card>
        <CardHeader className="custom-header">Header</CardHeader>
      </Card>
    )
    
    const header = screen.getByText('Header').closest('div')
    expect(header).toHaveClass('custom-header')
  })
})

describe('CardTitle Component', () => {
  it('should render children as heading', () => {
    render(
      <Card>
        <CardTitle>Card Title</CardTitle>
      </Card>
    )
    
    const title = screen.getByText('Card Title')
    expect(title).toBeInTheDocument()
    expect(title.tagName).toBe('H3')
  })

  it('should render as different heading level when as prop is provided', () => {
    const { rerender } = render(
      <Card>
        <CardTitle as="h1">H1 Title</CardTitle>
      </Card>
    )
    expect(screen.getByText('H1 Title').tagName).toBe('H1')

    rerender(
      <Card>
        <CardTitle as="h2">H2 Title</CardTitle>
      </Card>
    )
    expect(screen.getByText('H2 Title').tagName).toBe('H2')
  })

  it('should have correct styling', () => {
    render(
      <Card>
        <CardTitle>Title</CardTitle>
      </Card>
    )
    
    const title = screen.getByText('Title')
    expect(title).toHaveClass('text-lg', 'font-semibold', 'text-text-primary')
  })

  it('should accept custom className', () => {
    render(
      <Card>
        <CardTitle className="custom-title">Title</CardTitle>
      </Card>
    )
    
    const title = screen.getByText('Title')
    expect(title).toHaveClass('custom-title')
  })
})

describe('CardContent Component', () => {
  it('should render children content', () => {
    render(
      <Card>
        <CardContent>Content text</CardContent>
      </Card>
    )
    
    expect(screen.getByText('Content text')).toBeInTheDocument()
  })

  it('should have correct styling', () => {
    render(
      <Card>
        <CardContent data-testid="content">Content</CardContent>
      </Card>
    )
    
    const content = screen.getByTestId('content')
    expect(content).toHaveClass('text-text-secondary')
  })

  it('should accept custom className', () => {
    render(
      <Card>
        <CardContent className="custom-content">Content</CardContent>
      </Card>
    )
    
    const content = screen.getByText('Content').closest('div')
    expect(content).toHaveClass('custom-content')
  })
})

describe('CardFooter Component', () => {
  it('should render children content', () => {
    render(
      <Card>
        <CardFooter>Footer content</CardFooter>
      </Card>
    )
    
    expect(screen.getByText('Footer content')).toBeInTheDocument()
  })

  it('should have correct styling', () => {
    render(
      <Card>
        <CardFooter data-testid="footer">Footer</CardFooter>
      </Card>
    )
    
    const footer = screen.getByTestId('footer')
    expect(footer).toHaveClass(
      'flex',
      'items-center',
      'justify-end',
      'gap-2',
      'mt-4',
      'pt-4',
      'border-t'
    )
  })

  it('should accept custom className', () => {
    render(
      <Card>
        <CardFooter className="custom-footer">Footer</CardFooter>
      </Card>
    )
    
    const footer = screen.getByText('Footer').closest('div')
    expect(footer).toHaveClass('custom-footer')
  })
})

describe('Card Composition', () => {
  it('should render complete card structure', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Card Title</CardTitle>
        </CardHeader>
        <CardContent>Card content goes here</CardContent>
        <CardFooter>Footer actions</CardFooter>
      </Card>
    )
    
    expect(screen.getByText('Card Title')).toBeInTheDocument()
    expect(screen.getByText('Card content goes here')).toBeInTheDocument()
    expect(screen.getByText('Footer actions')).toBeInTheDocument()
  })
})
