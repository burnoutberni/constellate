import React from 'react'
import { cn } from '../../lib/utils'
import { Container, type ContainerSize } from './Container'

export interface PageLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Header content (typically Navbar)
   */
  header?: React.ReactNode
  /**
   * Footer content
   */
  footer?: React.ReactNode
  /**
   * Sidebar content (optional)
   */
  sidebar?: React.ReactNode
  /**
   * Whether sidebar should be on the left or right
   * @default 'left'
   */
  sidebarPosition?: 'left' | 'right'
  /**
   * Main page content
   */
  children: React.ReactNode
  /**
   * Whether to constrain main content width
   * @default true
   */
  contained?: boolean
  /**
   * Container size when contained is true
   * @default 'lg'
   */
  containerSize?: ContainerSize
  /**
   * Additional class name for the main content area
   */
  contentClassName?: string
}

/**
 * PageLayout component for standard page structure.
 * Provides consistent layout with header, footer, sidebar, and main content.
 * Responsive and uses design tokens.
 */
export const PageLayout = React.forwardRef<HTMLDivElement, PageLayoutProps>(
  (
    {
      header,
      footer,
      sidebar,
      sidebarPosition = 'left',
      children,
      contained = true,
      containerSize = 'lg',
      contentClassName,
      className,
      ...props
    },
    ref
  ) => {
    // Main content wrapper
    const mainContent = (
      <main
        className={cn(
          'flex-1 min-w-0', // min-w-0 prevents flex items from overflowing
          contentClassName
        )}
      >
        {contained ? (
          <Container size={containerSize}>
            {children}
          </Container>
        ) : (
          children
        )}
      </main>
    )

    // Sidebar content (if present)
    const sidebarContent = sidebar ? (
      <div className="flex flex-1 min-h-0">
        {sidebarPosition === 'left' && (
          <aside className="flex-shrink-0">
            {sidebar}
          </aside>
        )}
        
        {mainContent}
        
        {sidebarPosition === 'right' && (
          <aside className="flex-shrink-0">
            {sidebar}
          </aside>
        )}
      </div>
    ) : mainContent

    return (
      <div
        ref={ref}
        className={cn('flex flex-col min-h-screen', className)}
        {...props}
      >
        {header && (
          <header className="flex-shrink-0">
            {header}
          </header>
        )}
        
        {sidebarContent}
        
        {footer && (
          <footer className="flex-shrink-0">
            {footer}
          </footer>
        )}
      </div>
    )
  }
)

PageLayout.displayName = 'PageLayout'
