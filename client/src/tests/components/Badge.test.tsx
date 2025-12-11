import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from '../../components/ui'

describe('Badge Component', () => {
  it('should render children text', () => {
    render(<Badge>Test Badge</Badge>)
    
    expect(screen.getByText('Test Badge')).toBeInTheDocument()
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
