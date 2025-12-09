import React from 'react'
import { cn } from '../../lib/utils'

export type BadgeVariant = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'
export type BadgeSize = 'sm' | 'md' | 'lg'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * Visual style variant of the badge
   * @default 'default'
   */
  variant?: BadgeVariant
  /**
   * Size of the badge
   * @default 'md'
   */
  size?: BadgeSize
  /**
   * Whether the badge should be rounded (pill shape)
   */
  rounded?: boolean
  /**
   * Badge content
   */
  children: React.ReactNode
}

/**
 * Badge component for displaying tags, labels, and status indicators.
 * Fully accessible and supports dark mode.
 */
export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      variant = 'default',
      size = 'md',
      rounded = true,
      children,
      className,
      ...props
    },
    ref
  ) => {
    // Base styles
    const baseStyles = [
      'inline-flex items-center justify-center',
      'font-medium',
      'transition-colors duration-200',
    ]

    // Variant styles
    const variantStyles = {
      default: [
        'bg-background-secondary text-text-primary',
      ],
      primary: [
        'bg-primary-100 text-primary-800',
        'dark:bg-primary-900 dark:text-primary-200',
      ],
      secondary: [
        'bg-purple-100 text-purple-800',
        'dark:bg-purple-900 dark:text-purple-200',
      ],
      success: [
        'bg-green-100 text-green-800',
        'dark:bg-green-900 dark:text-green-200',
      ],
      warning: [
        'bg-yellow-100 text-yellow-800',
        'dark:bg-yellow-900 dark:text-yellow-200',
      ],
      error: [
        'bg-red-100 text-red-800',
        'dark:bg-red-900 dark:text-red-200',
      ],
      info: [
        'bg-blue-100 text-blue-800',
        'dark:bg-blue-900 dark:text-blue-200',
      ],
    }

    // Size styles
    const sizeStyles = {
      sm: ['text-xs px-2 py-0.5'],
      md: ['text-sm px-2.5 py-1'],
      lg: ['text-base px-3 py-1.5'],
    }

    // Border radius
    const radiusStyles = rounded ? 'rounded-full' : 'rounded'

    const classes = cn(
      baseStyles,
      variantStyles[variant],
      sizeStyles[size],
      radiusStyles,
      className
    )

    return (
      <span ref={ref} className={classes} {...props}>
        {children}
      </span>
    )
  }
)

Badge.displayName = 'Badge'

