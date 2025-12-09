import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Avatar, AvatarGroup } from './Avatar'

describe('Avatar Component', () => {
  it('should render with fallback text when no image is provided', () => {
    render(<Avatar fallback="JD" alt="John Doe" />)
    
    const avatar = screen.getByLabelText('John Doe')
    expect(avatar).toBeInTheDocument()
    expect(avatar).toHaveTextContent('JD')
  })

  it('should render with image when src is provided', () => {
    render(<Avatar src="https://example.com/avatar.jpg" alt="User avatar" />)
    
    const image = screen.getByAltText('User avatar')
    expect(image).toBeInTheDocument()
    expect(image).toHaveAttribute('src', 'https://example.com/avatar.jpg')
  })

  it('should show fallback when image fails to load', () => {
    render(
      <Avatar 
        src="https://example.com/invalid.jpg" 
        fallback="FB" 
        alt="User"
      />
    )
    
    const image = screen.getByAltText('User')
    expect(image).toBeInTheDocument()
    
    // Simulate image error by triggering onError handler
    fireEvent.error(image)
    
    // After error, fallback should be shown
    expect(screen.getByLabelText('User')).toHaveTextContent('FB')
  })

  it('should render with different sizes', () => {
    const { rerender } = render(<Avatar size="xs" fallback="XS" />)
    let avatar = screen.getByText('XS').closest('div')
    expect(avatar).toHaveClass('w-6', 'h-6', 'text-xs')

    rerender(<Avatar size="sm" fallback="SM" />)
    avatar = screen.getByText('SM').closest('div')
    expect(avatar).toHaveClass('w-8', 'h-8', 'text-sm')

    rerender(<Avatar size="md" fallback="MD" />)
    avatar = screen.getByText('MD').closest('div')
    expect(avatar).toHaveClass('w-10', 'h-10', 'text-base')

    rerender(<Avatar size="lg" fallback="LG" />)
    avatar = screen.getByText('LG').closest('div')
    expect(avatar).toHaveClass('w-12', 'h-12', 'text-lg')

    rerender(<Avatar size="xl" fallback="XL" />)
    avatar = screen.getByText('XL').closest('div')
    expect(avatar).toHaveClass('w-16', 'h-16', 'text-xl')
  })

  it('should render rounded by default', () => {
    render(<Avatar fallback="R" />)
    
    const avatar = screen.getByText('R').closest('div')
    expect(avatar).toHaveClass('rounded-full')
  })

  it('should render square when rounded is false', () => {
    render(<Avatar fallback="SQ" rounded={false} />)
    
    const avatar = screen.getByText('SQ').closest('div')
    expect(avatar).toHaveClass('rounded-lg')
    expect(avatar).not.toHaveClass('rounded-full')
  })

  it('should render with border when bordered prop is true', () => {
    render(<Avatar fallback="BD" bordered />)
    
    const avatar = screen.getByText('BD').closest('div')
    expect(avatar).toHaveClass('ring-2', 'ring-border-default')
  })

  it('should render status indicator when status prop is provided', () => {
    render(<Avatar fallback="ST" status="online" />)
    
    const statusIndicator = screen.getByLabelText('Status: online')
    expect(statusIndicator).toBeInTheDocument()
    expect(statusIndicator).toHaveClass('bg-green-500')
  })

  it('should render different status colors', () => {
    const { rerender } = render(<Avatar fallback="ST" status="online" />)
    expect(screen.getByLabelText('Status: online')).toHaveClass('bg-green-500')

    rerender(<Avatar fallback="ST" status="offline" />)
    expect(screen.getByLabelText('Status: offline')).toHaveClass('bg-neutral-400')

    rerender(<Avatar fallback="ST" status="away" />)
    expect(screen.getByLabelText('Status: away')).toHaveClass('bg-yellow-500')

    rerender(<Avatar fallback="ST" status="busy" />)
    expect(screen.getByLabelText('Status: busy')).toHaveClass('bg-red-500')
  })

  it('should use default fallback "?" when no fallback is provided', () => {
    render(<Avatar alt="User" />)
    
    expect(screen.getByLabelText('User')).toHaveTextContent('?')
  })

  it('should accept custom className', () => {
    render(<Avatar fallback="CN" className="custom-class" />)
    
    const avatar = screen.getByText('CN').closest('div')
    expect(avatar).toHaveClass('custom-class')
  })
})

describe('AvatarGroup Component', () => {
  it('should render all avatars when count is less than max', () => {
    const avatars = [
      { src: 'avatar1.jpg', alt: 'User 1', fallback: 'U1' },
      { src: 'avatar2.jpg', alt: 'User 2', fallback: 'U2' },
    ]
    
    render(<AvatarGroup avatars={avatars} max={3} />)
    
    expect(screen.getByAltText('User 1')).toBeInTheDocument()
    expect(screen.getByAltText('User 2')).toBeInTheDocument()
  })

  it('should limit avatars to max and show remaining count', () => {
    const avatars = [
      { src: 'avatar1.jpg', alt: 'User 1', fallback: 'U1' },
      { src: 'avatar2.jpg', alt: 'User 2', fallback: 'U2' },
      { src: 'avatar3.jpg', alt: 'User 3', fallback: 'U3' },
      { src: 'avatar4.jpg', alt: 'User 4', fallback: 'U4' },
      { src: 'avatar5.jpg', alt: 'User 5', fallback: 'U5' },
    ]
    
    render(<AvatarGroup avatars={avatars} max={3} />)
    
    // Should show first 3 avatars
    expect(screen.getByAltText('User 1')).toBeInTheDocument()
    expect(screen.getByAltText('User 2')).toBeInTheDocument()
    expect(screen.getByAltText('User 3')).toBeInTheDocument()
    
    // Should show remaining count
    const remainingBadge = screen.getByLabelText('2 more avatars')
    expect(remainingBadge).toBeInTheDocument()
    expect(remainingBadge).toHaveTextContent('+2')
  })

  it('should use default max of 3', () => {
    const avatars = [
      { fallback: 'U1' },
      { fallback: 'U2' },
      { fallback: 'U3' },
      { fallback: 'U4' },
    ]
    
    render(<AvatarGroup avatars={avatars} />)
    
    expect(screen.getByText('U1')).toBeInTheDocument()
    expect(screen.getByText('U2')).toBeInTheDocument()
    expect(screen.getByText('U3')).toBeInTheDocument()
    expect(screen.getByLabelText('1 more avatars')).toBeInTheDocument()
  })

  it('should apply size to all avatars in group', () => {
    const avatars = [
      { fallback: 'U1' },
      { fallback: 'U2' },
    ]
    
    render(<AvatarGroup avatars={avatars} size="lg" />)
    
    const avatar1 = screen.getByText('U1').closest('div')
    expect(avatar1).toHaveClass('w-12', 'h-12', 'text-lg')
  })

  it('should accept custom className', () => {
    const avatars = [{ fallback: 'U1' }]
    
    render(<AvatarGroup avatars={avatars} className="custom-group" />)
    
    const group = screen.getByText('U1').closest('div')?.parentElement
    expect(group).toHaveClass('custom-group')
  })
})
