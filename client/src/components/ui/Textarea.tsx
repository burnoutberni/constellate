import React from 'react'
import { cn } from '../../lib/utils'

export type TextareaSize = 'sm' | 'md' | 'lg'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /**
   * Size of the textarea
   * @default 'md'
   */
  size?: TextareaSize
  /**
   * Whether the textarea has an error state
   */
  error?: boolean
  /**
   * Error message to display below the textarea
   */
  errorMessage?: string
  /**
   * Label text for the textarea
   */
  label?: string
  /**
   * Helper text to display below the textarea
   */
  helperText?: string
  /**
   * Whether the textarea should take full width of its container
   */
  fullWidth?: boolean
  /**
   * Number of rows (height) of the textarea
   */
  rows?: number
}

/**
 * Textarea component with multiple states and sizes.
 * Fully accessible with proper labels and error handling.
 * Supports dark mode through Tailwind classes.
 */
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      size = 'md',
      error = false,
      errorMessage,
      label,
      helperText,
      fullWidth = false,
      rows = 4,
      className,
      id,
      disabled,
      required,
      ...props
    },
    ref
  ) => {
    const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`
    const errorId = error && errorMessage ? `${textareaId}-error` : undefined
    const helperId = helperText ? `${textareaId}-helper` : undefined

    // Base styles
    const baseStyles = [
      'block w-full',
      'border rounded-lg',
      'resize-y',
      'transition-all duration-200',
      'focus:outline-none focus:ring-2 focus:ring-offset-0',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      'dark:bg-neutral-900 dark:border-neutral-700',
      'dark:focus:ring-offset-neutral-900',
    ]

    // Size styles
    const sizeStyles = {
      sm: ['text-sm px-3 py-1.5'],
      md: ['text-base px-4 py-2'],
      lg: ['text-lg px-4 py-2.5'],
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

    const textareaClasses = cn(baseStyles, sizeStyles[size], stateStyles, className)

    const containerClasses = cn('w-full', fullWidth && 'w-full')

    return (
      <div className={containerClasses}>
        {label && (
          <label
            htmlFor={textareaId}
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
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          className={textareaClasses}
          disabled={disabled}
          required={required}
          aria-invalid={error}
          aria-describedby={cn(errorId, helperId)}
          aria-required={required}
          {...props}
        />
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

Textarea.displayName = 'Textarea'
