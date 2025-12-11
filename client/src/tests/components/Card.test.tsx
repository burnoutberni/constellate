import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '../../components/ui'

describe('Card Component', () => {
  it('should render children content', () => {
    render(<Card>Card content</Card>)
    
    expect(screen.getByText('Card content')).toBeInTheDocument()
  })

  it('should be interactive when interactive prop is true', () => {
    const handleClick = vi.fn()
    render(
      <Card interactive onClick={handleClick}>
        Interactive card
      </Card>
    )
    
    const card = screen.getByText('Interactive card').closest('div')
    expect(card).toBeTruthy()
    if (card) {
        fireEvent.click(card)
    }
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
