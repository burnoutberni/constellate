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
			'rounded-lg border',
			'bg-white dark:bg-neutral-900',
			'text-text-primary placeholder:text-text-disabled',
			'transition-all duration-200 ease-in-out',
			'focus:outline-none focus:ring-2 focus:ring-offset-0',
			'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-neutral-50 dark:disabled:bg-neutral-800',
			'resize-y',
		]

		// Size styles
		const sizeStyles = {
			sm: ['text-sm px-3 py-1.5', 'min-h-[32px]'],
			md: ['text-sm px-3.5 py-2', 'min-h-[40px]'],
			lg: ['text-base px-4 py-3', 'min-h-[48px]'],
		}

		// State styles
		const stateStyles = error
			? [
					'border-error-300 text-error-900 placeholder:text-error-300',
					'focus:border-error-500 focus:ring-error-500/20',
					'dark:border-error-700 dark:text-error-100 dark:placeholder:text-error-700',
					'dark:focus:border-error-500',
				]
			: [
					'border-neutral-200',
					'focus:border-primary-500 focus:ring-primary-500/20',
					'hover:border-neutral-300',
					'dark:border-neutral-700',
					'dark:hover:border-neutral-600',
					'dark:focus:border-primary-500 dark:focus:ring-primary-500/30',
				]

		const textareaClasses = cn(baseStyles, sizeStyles[size], stateStyles, className)

		return (
			<div className={cn(fullWidth && 'w-full')}>
				{label && (
					<label
						htmlFor={textareaId}
						className={cn(
							'block text-sm font-medium mb-1.5',
							'text-text-secondary',
							error && 'text-error-600 dark:text-error-400',
							required && "after:content-['*'] after:ml-0.5 after:text-error-500"
						)}>
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
						className="mt-1.5 text-xs font-medium text-error-600 dark:text-error-400"
						role="alert">
						{errorMessage}
					</p>
				)}
				{!error && helperText && (
					<p id={helperId} className="mt-1.5 text-xs text-text-tertiary">
						{helperText}
					</p>
				)}
			</div>
		)
	}
)

Textarea.displayName = 'Textarea'
