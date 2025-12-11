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
      onClick,
      onKeyDown,
      ...props
    },
    ref,
  ) => {
    // Base styles
    const baseStyles = [
      'rounded-lg',
      'transition-all duration-200',
    ]

    // Variant styles
    const variantStyles = {
      default: [
        'bg-background-primary border border-border-default',
      ],
      outlined: [
        'bg-transparent border-2 border-border-hover',
      ],
      elevated: [
        'bg-background-primary border border-border-default',
        'shadow-md',
      ],
      flat: [
        'bg-background-secondary',
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
          'focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-2',
          'focus:ring-offset-background-primary',
        ]
      : []

    const classes = cn(
      baseStyles,
      variantStyles[variant],
      paddingStyles[padding],
      interactiveStyles,
      className,
    )

    // Handle keyboard events for accessibility
    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      // Call user's onKeyDown handler if provided
      onKeyDown?.(event)

      // If interactive and has onClick, handle Enter and Space keys
      if (interactive && onClick) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick(event as unknown as React.MouseEvent<HTMLDivElement>)
        }
      }
    }

    return (
      <div
        ref={ref}
        className={classes}
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        {...props}
      >
        {children}
      </div>
    )
  },
)

Card.displayName = 'Card'

/**
 * Card Header component for card titles and actions
 */
export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ children, className, ...props }, ref) => (
      <div
        ref={ref}
        className={cn('flex items-center justify-between mb-4', className)}
        {...props}
      >
        {children}
      </div>
    ),
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
  ({ as: Component = 'h3', children, className, ...props }, ref) => (
      <Component
        ref={ref}
        className={cn(
          'text-lg font-semibold text-text-primary',
          className,
        )}
        {...props}
      >
        {children}
      </Component>
    ),
)

CardTitle.displayName = 'CardTitle'

/**
 * Card Content component for main card content
 */
export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ children, className, ...props }, ref) => (
      <div
        ref={ref}
        className={cn('text-text-secondary', className)}
        {...props}
      >
        {children}
      </div>
    ),
)

CardContent.displayName = 'CardContent'

/**
 * Card Footer component for card actions
 */
export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ children, className, ...props }, ref) => (
      <div
        ref={ref}
        className={cn('flex items-center justify-end gap-2 mt-4 pt-4 border-t border-border-default', className)}
        {...props}
      >
        {children}
      </div>
    ),
)

CardFooter.displayName = 'CardFooter'
