import React from 'react'
import { cn } from '../../lib/utils'
import { Container } from './Container'

export type SectionPadding = 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
export type SectionVariant = 'default' | 'muted' | 'accent'

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * HTML element to render
   * @default 'section'
   */
  as?: 'section' | 'div' | 'article' | 'aside' | 'header' | 'footer' | 'main'
  /**
   * Visual variant of the section
   * @default 'default'
   */
  variant?: SectionVariant
  /**
   * Vertical padding size
   * @default 'lg'
   */
  padding?: SectionPadding
  /**
   * Whether to constrain content width with Container
   * @default true
   */
  contained?: boolean
  /**
   * Container size when contained is true
   * @default 'lg'
   */
  containerSize?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  /**
   * Section content
   */
  children: React.ReactNode
}

/**
 * Section component for page sections.
 * Provides consistent spacing and background variants.
 * Responsive and uses design tokens for spacing.
 */
export const Section = React.forwardRef<HTMLElement, SectionProps>(
  (
    {
      as: Component = 'section',
      variant = 'default',
      padding = 'lg',
      contained = true,
      containerSize = 'lg',
      children,
      className,
      ...props
    },
    ref
  ) => {
    // Base styles
    const baseStyles = ['w-full']

    // Variant styles
    const variantStyles = {
      default: 'bg-background-primary',
      muted: 'bg-background-secondary',
      accent: 'bg-primary-50 dark:bg-primary-950/20',
    }

    // Padding styles using design tokens
    const paddingStyles = {
      none: 'py-0',
      sm: 'py-4 sm:py-6',
      md: 'py-6 sm:py-8',
      lg: 'py-8 sm:py-12',
      xl: 'py-12 sm:py-16',
      '2xl': 'py-16 sm:py-24',
    }

    const sectionClasses = cn(
      baseStyles,
      variantStyles[variant],
      paddingStyles[padding],
      className
    )

    // Determine content - wrap in Container if contained
    const content = contained ? (
      <Container size={containerSize}>
        {children}
      </Container>
    ) : (
      children
    )

    return (
      <Component
        ref={ref as React.LegacyRef<HTMLElement>}
        className={sectionClasses}
        {...props}
      >
        {content}
      </Component>
    )
  }
)

Section.displayName = 'Section'
