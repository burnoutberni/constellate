import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { PageLayout } from './PageLayout'

describe('PageLayout Component', () => {
  it('should render children content', () => {
    render(<PageLayout>Page content</PageLayout>)
    
    expect(screen.getByText('Page content')).toBeInTheDocument()
  })

  it('should render without header, footer, or sidebar', () => {
    render(<PageLayout data-testid="layout">Content</PageLayout>)
    
    const layout = screen.getByTestId('layout')
    expect(layout).toBeInTheDocument()
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument()
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })

  it('should render header when provided', () => {
    render(
      <PageLayout header={<header>Header content</header>}>
        Main content
      </PageLayout>
    )
    
    expect(screen.getByText('Header content')).toBeInTheDocument()
    expect(screen.getByText('Main content')).toBeInTheDocument()
  })

  it('should render footer when provided', () => {
    render(
      <PageLayout footer={<footer>Footer content</footer>}>
        Main content
      </PageLayout>
    )
    
    expect(screen.getByText('Footer content')).toBeInTheDocument()
    expect(screen.getByText('Main content')).toBeInTheDocument()
  })

  it('should render sidebar when provided', () => {
    render(
      <PageLayout sidebar={<aside>Sidebar content</aside>}>
        Main content
      </PageLayout>
    )
    
    expect(screen.getByText('Sidebar content')).toBeInTheDocument()
    expect(screen.getByText('Main content')).toBeInTheDocument()
  })

  it('should render sidebar on left by default', () => {
    render(
      <PageLayout 
        sidebar={<div data-testid="sidebar">Sidebar</div>}
        data-testid="layout"
      >
        Main content
      </PageLayout>
    )
    
    const sidebar = screen.getByTestId('sidebar')
    const main = screen.getByRole('main')
    
    // Find the flex container that holds both sidebar and main
    const flexContainer = main.parentElement
    
    // Check that sidebar comes before main in DOM order within the flex container
    const flexChildren = Array.from(flexContainer!.children)
    const sidebarAside = sidebar.closest('aside')
    const sidebarIndex = flexChildren.indexOf(sidebarAside!)
    const mainIndex = flexChildren.indexOf(main)
    
    expect(sidebarIndex).toBeGreaterThanOrEqual(0)
    expect(mainIndex).toBeGreaterThanOrEqual(0)
    expect(sidebarIndex).toBeLessThan(mainIndex)
  })

  it('should render sidebar on right when sidebarPosition is right', () => {
    render(
      <PageLayout 
        sidebar={<div data-testid="sidebar">Sidebar</div>}
        sidebarPosition="right"
        data-testid="layout"
      >
        Main content
      </PageLayout>
    )
    
    const sidebar = screen.getByTestId('sidebar')
    const main = screen.getByRole('main')
    
    // Find the flex container that holds both sidebar and main
    const flexContainer = main.parentElement
    
    // Check that main comes before sidebar in DOM order within the flex container
    const flexChildren = Array.from(flexContainer!.children)
    const mainIndex = flexChildren.indexOf(main)
    const sidebarAside = sidebar.closest('aside')
    const sidebarIndex = flexChildren.indexOf(sidebarAside!)
    
    expect(mainIndex).toBeGreaterThanOrEqual(0)
    expect(sidebarIndex).toBeGreaterThanOrEqual(0)
    expect(mainIndex).toBeLessThan(sidebarIndex)
  })

  it('should contain main content by default', () => {
    render(<PageLayout>Content</PageLayout>)
    
    // Should have Container inside main
    const container = screen.getByText('Content').closest('.max-w-screen-lg')
    expect(container).toBeInTheDocument()
  })

  it('should not contain main content when contained is false', () => {
    render(<PageLayout contained={false}>Content</PageLayout>)
    
    // Should not have Container inside
    const container = screen.getByText('Content').closest('.mx-auto')
    expect(container).not.toBeInTheDocument()
  })

  it('should use default container size (lg) when contained', () => {
    render(<PageLayout>Content</PageLayout>)
    
    const container = screen.getByText('Content').closest('.max-w-screen-lg')
    expect(container).toBeInTheDocument()
  })

  it('should use custom container size when provided', () => {
    const { rerender } = render(<PageLayout containerSize="sm">Content</PageLayout>)
    expect(screen.getByText('Content').closest('.max-w-screen-sm')).toBeInTheDocument()

    rerender(<PageLayout containerSize="md">Content</PageLayout>)
    expect(screen.getByText('Content').closest('.max-w-screen-md')).toBeInTheDocument()

    rerender(<PageLayout containerSize="xl">Content</PageLayout>)
    expect(screen.getByText('Content').closest('.max-w-screen-xl')).toBeInTheDocument()

    rerender(<PageLayout containerSize="full">Content</PageLayout>)
    expect(screen.getByText('Content').closest('.max-w-full')).toBeInTheDocument()
  })

  it('should render main element with correct structure', () => {
    render(<PageLayout data-testid="layout">Content</PageLayout>)
    
    const main = screen.getByRole('main')
    expect(main).toBeInTheDocument()
    expect(main).toHaveClass('flex-1', 'min-w-0')
  })

  it('should have min-h-screen class on root', () => {
    render(<PageLayout data-testid="layout">Content</PageLayout>)
    
    const layout = screen.getByTestId('layout')
    expect(layout).toHaveClass('min-h-screen')
  })

  it('should have flex flex-col on root', () => {
    render(<PageLayout data-testid="layout">Content</PageLayout>)
    
    const layout = screen.getByTestId('layout')
    expect(layout).toHaveClass('flex', 'flex-col')
  })

  it('should apply contentClassName to main element', () => {
    render(
      <PageLayout contentClassName="custom-main">
        Content
      </PageLayout>
    )
    
    const main = screen.getByRole('main')
    expect(main).toHaveClass('custom-main')
  })

  it('should accept custom className', () => {
    render(<PageLayout className="custom-layout" data-testid="layout">Content</PageLayout>)
    
    const layout = screen.getByTestId('layout')
    expect(layout).toHaveClass('custom-layout')
  })

  it('should accept standard HTML div attributes', () => {
    render(
      <PageLayout 
        data-testid="layout"
        id="test-layout"
        aria-label="Test layout"
      >
        Content
      </PageLayout>
    )
    
    const layout = screen.getByTestId('layout')
    expect(layout).toHaveAttribute('id', 'test-layout')
    expect(layout).toHaveAttribute('aria-label', 'Test layout')
  })

  it('should render complete layout structure', () => {
    render(
      <PageLayout
        header={<header>Header</header>}
        footer={<footer>Footer</footer>}
        sidebar={<aside>Sidebar</aside>}
      >
        Main content
      </PageLayout>
    )
    
    expect(screen.getByText('Header')).toBeInTheDocument()
    expect(screen.getByText('Main content')).toBeInTheDocument()
    expect(screen.getByText('Sidebar')).toBeInTheDocument()
    expect(screen.getByText('Footer')).toBeInTheDocument()
  })

  it('should forward ref to layout element', () => {
    const ref = React.createRef<HTMLDivElement>()
    render(<PageLayout ref={ref}>Content</PageLayout>)
    
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
    expect(ref.current).toHaveTextContent('Content')
  })

  it('should forward ref when sidebar is present', () => {
    const ref = React.createRef<HTMLDivElement>()
    render(
      <PageLayout ref={ref} sidebar={<aside>Sidebar</aside>}>
        Content
      </PageLayout>
    )
    
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
    expect(ref.current).toHaveTextContent('Content')
  })

  it('should have displayName', () => {
    expect(PageLayout.displayName).toBe('PageLayout')
  })
})
