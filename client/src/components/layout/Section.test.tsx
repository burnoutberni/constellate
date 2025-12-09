import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { Section } from './Section'

describe('Section Component', () => {
  it('should render children content', () => {
    render(<Section>Section content</Section>)
    
    expect(screen.getByText('Section content')).toBeInTheDocument()
  })

  it('should render as section element by default', () => {
    render(<Section data-testid="section">Content</Section>)
    
    const section = screen.getByTestId('section')
    expect(section.tagName).toBe('SECTION')
  })

  it('should render as different HTML elements via as prop', () => {
    const { rerender } = render(<Section as="div" data-testid="section">Content</Section>)
    expect(screen.getByTestId('section').tagName).toBe('DIV')

    rerender(<Section as="article" data-testid="section">Content</Section>)
    expect(screen.getByTestId('section').tagName).toBe('ARTICLE')

    rerender(<Section as="aside" data-testid="section">Content</Section>)
    expect(screen.getByTestId('section').tagName).toBe('ASIDE')

    rerender(<Section as="header" data-testid="section">Content</Section>)
    expect(screen.getByTestId('section').tagName).toBe('HEADER')

    rerender(<Section as="footer" data-testid="section">Content</Section>)
    expect(screen.getByTestId('section').tagName).toBe('FOOTER')

    rerender(<Section as="main" data-testid="section">Content</Section>)
    expect(screen.getByTestId('section').tagName).toBe('MAIN')
  })

  it('should render with default variant', () => {
    render(<Section data-testid="section">Content</Section>)
    
    const section = screen.getByTestId('section')
    expect(section).toHaveClass('bg-background-primary')
  })

  it('should render with different variants', () => {
    const { rerender } = render(<Section variant="default" data-testid="section">Content</Section>)
    expect(screen.getByTestId('section')).toHaveClass('bg-background-primary')

    rerender(<Section variant="muted" data-testid="section">Content</Section>)
    expect(screen.getByTestId('section')).toHaveClass('bg-background-secondary')

    rerender(<Section variant="accent" data-testid="section">Content</Section>)
    expect(screen.getByTestId('section')).toHaveClass('bg-primary-50', 'dark:bg-primary-950/20')
  })

  it('should render with default padding (lg)', () => {
    render(<Section data-testid="section">Content</Section>)
    
    const section = screen.getByTestId('section')
    expect(section).toHaveClass('py-8', 'sm:py-12')
  })

  it('should render with different padding sizes', () => {
    const { rerender } = render(<Section padding="none" data-testid="section">Content</Section>)
    expect(screen.getByTestId('section')).toHaveClass('py-0')

    rerender(<Section padding="sm" data-testid="section">Content</Section>)
    expect(screen.getByTestId('section')).toHaveClass('py-4', 'sm:py-6')

    rerender(<Section padding="md" data-testid="section">Content</Section>)
    expect(screen.getByTestId('section')).toHaveClass('py-6', 'sm:py-8')

    rerender(<Section padding="lg" data-testid="section">Content</Section>)
    expect(screen.getByTestId('section')).toHaveClass('py-8', 'sm:py-12')

    rerender(<Section padding="xl" data-testid="section">Content</Section>)
    expect(screen.getByTestId('section')).toHaveClass('py-12', 'sm:py-16')

    rerender(<Section padding="2xl" data-testid="section">Content</Section>)
    expect(screen.getByTestId('section')).toHaveClass('py-16', 'sm:py-24')
  })

  it('should contain content by default', () => {
    render(<Section data-testid="section">Content</Section>)
    
    // Should have Container inside
    const container = screen.getByText('Content').closest('.mx-auto')
    expect(container).toBeInTheDocument()
  })

  it('should not contain content when contained is false', () => {
    render(<Section contained={false} data-testid="section">Content</Section>)
    
    // Should not have Container inside
    const container = screen.getByText('Content').closest('.mx-auto')
    expect(container).not.toBeInTheDocument()
    
    // Content should be directly inside section
    const section = screen.getByTestId('section')
    const content = screen.getByText('Content')
    expect(section.contains(content)).toBe(true)
    expect(content.closest('section')).toBe(section)
  })

  it('should use default container size (lg) when contained', () => {
    render(<Section>Content</Section>)
    
    const container = screen.getByText('Content').closest('.max-w-screen-lg')
    expect(container).toBeInTheDocument()
  })

  it('should use custom container size when provided', () => {
    const { rerender } = render(<Section containerSize="sm">Content</Section>)
    expect(screen.getByText('Content').closest('.max-w-screen-sm')).toBeInTheDocument()

    rerender(<Section containerSize="md">Content</Section>)
    expect(screen.getByText('Content').closest('.max-w-screen-md')).toBeInTheDocument()

    rerender(<Section containerSize="xl">Content</Section>)
    expect(screen.getByText('Content').closest('.max-w-screen-xl')).toBeInTheDocument()

    rerender(<Section containerSize="full">Content</Section>)
    expect(screen.getByText('Content').closest('.max-w-full')).toBeInTheDocument()
  })

  it('should have full width', () => {
    render(<Section data-testid="section">Content</Section>)
    
    const section = screen.getByTestId('section')
    expect(section).toHaveClass('w-full')
  })

  it('should accept custom className', () => {
    render(<Section className="custom-section" data-testid="section">Content</Section>)
    
    const section = screen.getByTestId('section')
    expect(section).toHaveClass('custom-section')
  })

  it('should accept standard HTML attributes', () => {
    render(
      <Section 
        data-testid="section"
        id="test-section"
        aria-label="Test section"
      >
        Content
      </Section>
    )
    
    const section = screen.getByTestId('section')
    expect(section).toHaveAttribute('id', 'test-section')
    expect(section).toHaveAttribute('aria-label', 'Test section')
  })

  it('should forward ref to section element', () => {
    const ref = React.createRef<HTMLElement>()
    render(<Section ref={ref}>Content</Section>)
    
    expect(ref.current).toBeInstanceOf(HTMLElement)
    expect(ref.current).toHaveTextContent('Content')
  })

  it('should forward ref when contained is false', () => {
    const ref = React.createRef<HTMLElement>()
    render(<Section ref={ref} contained={false}>Content</Section>)
    
    expect(ref.current).toBeInstanceOf(HTMLElement)
    expect(ref.current).toHaveTextContent('Content')
  })

  it('should forward ref when using different as prop', () => {
    const ref = React.createRef<HTMLElement>()
    render(<Section ref={ref} as="article">Content</Section>)
    
    expect(ref.current).toBeInstanceOf(HTMLElement)
    expect(ref.current?.tagName).toBe('ARTICLE')
  })

  it('should have displayName', () => {
    expect(Section.displayName).toBe('Section')
  })
})
