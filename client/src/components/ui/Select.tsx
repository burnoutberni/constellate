import React from 'react'
import { cn } from '../../lib/utils'

export type SelectSize = 'sm' | 'md' | 'lg'

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  /**
   * Size of the select
   * @default 'md'
   */
  size?: SelectSize
  /**
   * Whether the select has an error state
   */
  error?: boolean
  /**
   * Error message to display below the select
   */
  errorMessage?: string
  /**
   * Label text for the select
   */
  label?: string
  /**
   * Helper text to display below the select
   */
  helperText?: string
  /**
   * Whether the select should take full width of its container
   */
  fullWidth?: boolean
}

/**
 * Select component with multiple states and sizes.
 * Fully accessible with proper labels and error handling.
 * Supports dark mode through Tailwind classes.
 */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      size = 'md',
      error = false,
      errorMessage,
      label,
      helperText,
      fullWidth = false,
      className,
      id,
      disabled,
      required,
      children,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId()
    const selectId = id || `select-${generatedId}`
    const errorId = error && errorMessage ? `${selectId}-error` : undefined
    const helperId = helperText ? `${selectId}-helper` : undefined

    // Base styles
    const baseStyles = [
      'block w-full',
      'border rounded-lg',
      'transition-all duration-200',
      'focus:outline-none focus:ring-2 focus:ring-offset-0',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      'bg-background-primary',
      'focus:ring-offset-background-primary',
      'appearance-none',
      'cursor-pointer',
    ]

    // Size styles
    const sizeStyles = {
      sm: ['text-sm px-3 py-1.5', 'min-h-[32px]'],
      md: ['text-base px-4 py-2', 'min-h-[40px]'],
      lg: ['text-lg px-4 py-2.5', 'min-h-[48px]'],
    }

    // State styles
    const stateStyles = error
      ? [
          'border-border-error text-error-700',
          'focus:border-border-error focus:ring-border-error',
          'dark:text-error-100',
        ]
      : [
          'border-border-default text-text-primary',
          'focus:border-border-focus focus:ring-border-focus',
        ]

    const selectClasses = cn(baseStyles, sizeStyles[size], stateStyles, className)

    const containerClasses = cn('w-full', fullWidth && 'w-full')

    return (
      <div className={containerClasses}>
        {label && (
          <label
            htmlFor={selectId}
            className={cn(
              'block text-sm font-medium mb-1.5',
              'text-text-secondary',
              error && 'text-error-600 dark:text-error-400',
              required && "after:content-['*'] after:ml-0.5 after:text-error-500"
            )}
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={selectClasses}
            disabled={disabled}
            required={required}
            aria-invalid={error}
            aria-describedby={cn(errorId, helperId)}
            aria-required={required}
            {...props}
          >
            {children}
          </select>
          {/* Dropdown arrow icon */}
          <div
            className={cn(
              'absolute right-3 top-1/2 -translate-y-1/2',
              'pointer-events-none',
              'text-text-disabled',
              error && 'text-error-500 dark:text-error-400',
              size === 'sm' && 'right-2.5',
              size === 'lg' && 'right-3.5'
            )}
          >
            <svg
              className={cn(
                size === 'sm' && 'w-3.5 h-3.5',
                size === 'md' && 'w-4 h-4',
                size === 'lg' && 'w-5 h-5'
              )}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
        {error && errorMessage && (
          <p
            id={errorId}
            className="mt-1.5 text-sm text-error-600 dark:text-error-400"
            role="alert"
          >
            {errorMessage}
          </p>
        )}
        {!error && helperText && (
          <p
            id={helperId}
            className="mt-1.5 text-sm text-text-tertiary"
          >
            {helperText}
          </p>
        )}
      </div>
    )
  }
)

Select.displayName = 'Select'
