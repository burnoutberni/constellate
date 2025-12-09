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
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`
    const errorId = error && errorMessage ? `${inputId}-error` : undefined
    const helperId = helperText ? `${inputId}-helper` : undefined

    // Base styles
    const baseStyles = [
      'block w-full',
      'border rounded-lg',
      'transition-all duration-200',
      'focus:outline-none focus:ring-2 focus:ring-offset-0',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      'dark:bg-neutral-900 dark:border-neutral-700',
      'dark:focus:ring-offset-neutral-900',
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
          'border-red-500 text-red-900',
          'focus:border-red-500 focus:ring-red-500',
          'dark:border-red-500 dark:text-red-100',
          'dark:focus:border-red-500 dark:focus:ring-red-500',
        ]
      : [
          'border-neutral-300 text-neutral-900',
          'focus:border-primary-500 focus:ring-primary-500',
          'dark:border-neutral-700 dark:text-neutral-100',
          'dark:focus:border-primary-400 dark:focus:ring-primary-400',
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
              'text-neutral-700 dark:text-neutral-300',
              error && 'text-red-600 dark:text-red-400',
              required && "after:content-['*'] after:ml-0.5 after:text-red-500"
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
                'text-neutral-400 dark:text-neutral-500',
                'pointer-events-none',
                error && 'text-red-500 dark:text-red-400'
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
                'text-neutral-400 dark:text-neutral-500',
                'pointer-events-none',
                error && 'text-red-500 dark:text-red-400'
              )}
            >
              {rightIcon}
            </div>
          )}
        </div>
        {error && errorMessage && (
          <p
            id={errorId}
            className="mt-1.5 text-sm text-red-600 dark:text-red-400"
            role="alert"
          >
            {errorMessage}
          </p>
        )}
        {!error && helperText && (
          <p
            id={helperId}
            className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400"
          >
            {helperText}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
