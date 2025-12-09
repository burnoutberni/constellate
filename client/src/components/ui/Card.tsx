import React from 'react'
import { cn } from '../../lib/utils'

export type CardVariant = 'default' | 'outlined' | 'elevated' | 'flat'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Visual style variant of the card
   * @default 'default'
   */
  variant?: CardVariant
  /**
   * Whether the card is interactive (hoverable/clickable)
   */
  interactive?: boolean
  /**
   * Padding size of the card content
   */
  padding?: 'none' | 'sm' | 'md' | 'lg'
  /**
   * Card content
   */
  children: React.ReactNode
}

/**
 * Card component for displaying content in a contained area.
 * Supports multiple variants and interactive states.
 * Fully accessible and supports dark mode.
 */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      interactive = false,
      padding = 'md',
      children,
      className,
      ...props
    },
    ref
  ) => {
    // Base styles
    const baseStyles = [
      'rounded-lg',
      'transition-all duration-200',
      'dark:bg-neutral-900',
    ]

    // Variant styles
    const variantStyles = {
      default: [
        'bg-white border border-neutral-200',
        'dark:border-neutral-800',
      ],
      outlined: [
        'bg-transparent border-2 border-neutral-300',
        'dark:border-neutral-700',
      ],
      elevated: [
        'bg-white border border-neutral-200',
        'shadow-md',
        'dark:border-neutral-800 dark:shadow-lg',
      ],
      flat: [
        'bg-neutral-50',
        'dark:bg-neutral-800',
      ],
    }

    // Padding styles
    const paddingStyles = {
      none: 'p-0',
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-6',
    }

    // Interactive styles
    const interactiveStyles = interactive
      ? [
          'cursor-pointer',
          'hover:shadow-lg hover:-translate-y-0.5',
          'active:translate-y-0',
          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
          'dark:focus:ring-offset-neutral-900',
        ]
      : []

    const classes = cn(
      baseStyles,
      variantStyles[variant],
      paddingStyles[padding],
      interactiveStyles,
      className
    )

    return (
      <div ref={ref} className={classes} {...props}>
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'

/**
 * Card Header component for card titles and actions
 */
export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex items-center justify-between mb-4', className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)

CardHeader.displayName = 'CardHeader'

/**
 * Card Title component
 */
export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  children: React.ReactNode
}

export const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ as: Component = 'h3', children, className, ...props }, ref) => {
    return (
      <Component
        ref={ref}
        className={cn(
          'text-lg font-semibold text-neutral-900 dark:text-neutral-100',
          className
        )}
        {...props}
      >
        {children}
      </Component>
    )
  }
)

CardTitle.displayName = 'CardTitle'

/**
 * Card Content component for main card content
 */
export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('text-neutral-700 dark:text-neutral-300', className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)

CardContent.displayName = 'CardContent'

/**
 * Card Footer component for card actions
 */
export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex items-center justify-end gap-2 mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800', className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)

CardFooter.displayName = 'CardFooter'
