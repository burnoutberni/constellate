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
    const generatedId = React.useId()
    const textareaId = id || `textarea-${generatedId}`
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
      'bg-background-primary',
      'focus:ring-offset-background-primary',
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
          'border-border-error text-error-700',
          'focus:border-border-error focus:ring-border-error',
          'dark:text-error-100',
        ]
      : [
          'border-border-default text-text-primary',
          'focus:border-border-focus focus:ring-border-focus',
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
              'text-text-secondary',
              error && 'text-error-600 dark:text-error-400',
              required && "after:content-['*'] after:ml-0.5 after:text-error-500"
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

Textarea.displayName = 'Textarea'

