import React from 'react'
import { cn } from '../../lib/utils'

export type InputSize = 'sm' | 'md' | 'lg'

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /**
   * Size of the input
   * @default 'md'
   */
  size?: InputSize
  /**
   * Whether the input has an error state
   */
  error?: boolean
  /**
   * Error message to display below the input
   */
  errorMessage?: string
  /**
   * Label text for the input
   */
  label?: string
  /**
   * Helper text to display below the input
   */
  helperText?: string
  /**
   * Icon to display on the left side of the input
   */
  leftIcon?: React.ReactNode
  /**
   * Icon to display on the right side of the input
   */
  rightIcon?: React.ReactNode
  /**
   * Whether the input should take full width of its container
   */
  fullWidth?: boolean
}

/**
 * Input component with multiple states and types.
 * Fully accessible with proper labels and error handling.
 * Supports dark mode through Tailwind classes.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      size = 'md',
      error = false,
      errorMessage,
      label,
      helperText,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className,
      id,
      disabled,
      required,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId()
    const inputId = id || `input-${generatedId}`
    const errorId = error && errorMessage ? `${inputId}-error` : undefined
    const helperId = helperText ? `${inputId}-helper` : undefined

    // Base styles
    const baseStyles = [
      'block w-full',
      'border rounded-lg',
      'transition-all duration-200',
      'focus:outline-none focus:ring-2 focus:ring-offset-0',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      'bg-background-primary',
      'focus:ring-offset-background-primary',
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

    const inputClasses = cn(
      baseStyles,
      sizeStyles[size],
      stateStyles,
      leftIcon ? 'pl-10' : '',
      rightIcon ? 'pr-10' : '',
      className
    )

    const containerClasses = cn('w-full', fullWidth && 'w-full')

    return (
      <div className={containerClasses}>
        {label && (
          <label
            htmlFor={inputId}
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
          {leftIcon && (
            <div
              className={cn(
                'absolute left-3 top-1/2 -translate-y-1/2',
                'text-text-disabled',
                'pointer-events-none',
                error && 'text-error-500 dark:text-error-400'
              )}
            >
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={inputClasses}
            disabled={disabled}
            required={required}
            aria-invalid={error}
            aria-describedby={cn(errorId, helperId)}
            aria-required={required}
            {...props}
          />
          {rightIcon && (
            <div
              className={cn(
                'absolute right-3 top-1/2 -translate-y-1/2',
                'text-text-disabled',
                'pointer-events-none',
                error && 'text-error-500 dark:text-error-400'
              )}
            >
              {rightIcon}
            </div>
          )}
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

Input.displayName = 'Input'

