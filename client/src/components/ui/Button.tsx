import React from 'react'
import { cn } from '../../lib/utils'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Visual style variant of the button
   * @default 'primary'
   */
  variant?: ButtonVariant
  /**
   * Size of the button
   * @default 'md'
   */
  size?: ButtonSize
  /**
   * Whether the button is in a loading state
   */
  loading?: boolean
  /**
   * Whether the button should take full width of its container
   */
  fullWidth?: boolean
  /**
   * Icon to display before the button text
   */
  leftIcon?: React.ReactNode
  /**
   * Icon to display after the button text
   */
  rightIcon?: React.ReactNode
  /**
   * Button content
   */
  children: React.ReactNode
}

/**
 * Button component with multiple variants and sizes.
 * Fully accessible with keyboard navigation and ARIA support.
 * Supports dark mode through Tailwind classes.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      children,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading

    // Base styles - using design tokens via Tailwind
    const baseStyles = [
      'inline-flex items-center justify-center',
      'font-medium',
      'border border-transparent',
      'rounded-lg',
      'transition-all duration-200',
      'focus:outline-none focus:ring-2 focus:ring-offset-2',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      'focus:ring-offset-background-primary',
    ]

    // Variant styles
    const variantStyles = {
      primary: [
        'bg-primary-600 text-white',
        'hover:bg-primary-700',
        'active:bg-primary-800',
        'focus:ring-primary-500',
        'dark:bg-primary-500 dark:hover:bg-primary-600 dark:active:bg-primary-700',
      ],
      secondary: [
        'bg-background-tertiary text-text-primary',
        'hover:bg-background-secondary',
        'active:bg-background-secondary',
        'focus:ring-border-default',
      ],
      ghost: [
        'bg-transparent text-text-secondary',
        'hover:bg-background-secondary',
        'active:bg-background-tertiary',
        'focus:ring-border-default',
      ],
      danger: [
        'bg-error-600 text-white',
        'hover:bg-error-700',
        'active:bg-error-800',
        'focus:ring-error-500',
        'dark:bg-error-500 dark:hover:bg-error-600 dark:active:bg-error-700',
      ],
    }

    // Size styles
    const sizeStyles = {
      sm: ['text-sm px-3 py-1.5 gap-1.5', 'min-h-[32px]'],
      md: ['text-base px-4 py-2 gap-2', 'min-h-[40px]'],
      lg: ['text-lg px-6 py-3 gap-2.5', 'min-h-[48px]'],
    }

    const classes = cn(
      baseStyles,
      variantStyles[variant],
      sizeStyles[size],
      fullWidth && 'w-full',
      className
    )

    return (
      <button
        ref={ref}
        type="button"
        className={classes}
        disabled={isDisabled}
        aria-busy={loading}
        aria-disabled={isDisabled}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {!loading && leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
        <span className={loading ? 'opacity-0' : ''}>{children}</span>
        {!loading && rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
      </button>
    )
  }
)

Button.displayName = 'Button'

