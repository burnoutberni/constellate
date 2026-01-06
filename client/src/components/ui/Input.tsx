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
	/**
	 * Callback for when the right icon is clicked.
	 * If provided, the right icon becomes interactive (pointer-events-auto).
	 */
	onRightIconClick?: () => void
	/**
	 * Accessibility label for the right icon button when it is interactive.
	 */
	rightIconAriaLabel?: string
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
			onRightIconClick,
			rightIconAriaLabel,
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
			'rounded-lg border',
			'bg-white dark:bg-neutral-900',
			'text-text-primary placeholder:text-text-disabled',
			'transition-all duration-200 ease-in-out',
			'focus:outline-none focus:ring-2 focus:ring-offset-0',
			'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-neutral-50 dark:disabled:bg-neutral-800',
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

		const inputClasses = cn(
			baseStyles,
			sizeStyles[size],
			stateStyles,
			leftIcon ? 'pl-10' : '',
			rightIcon ? 'pr-10' : '',
			className
		)

		const containerClasses = cn('relative', fullWidth && 'w-full')

		return (
			<div className={cn(fullWidth && 'w-full')}>
				{label && (
					<label
						htmlFor={inputId}
						className={cn(
							'block text-sm font-medium mb-1.5',
							'text-text-secondary',
							error && 'text-error-600 dark:text-error-400',
							required && "after:content-['*'] after:ml-0.5 after:text-error-500"
						)}>
						{label}
					</label>
				)}
				<div className={containerClasses}>
					{leftIcon && (
						<div
							className={cn(
								'absolute left-3 top-1/2 -translate-y-1/2',
								'text-text-disabled',
								'pointer-events-none',
								error && 'text-error-500 dark:text-error-400'
							)}>
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
							onClick={onRightIconClick}
							role={onRightIconClick ? 'button' : undefined}
							aria-label={onRightIconClick ? rightIconAriaLabel : undefined}
							tabIndex={onRightIconClick ? 0 : undefined}
							className={cn(
								'absolute right-3 top-1/2 -translate-y-1/2',
								'text-text-disabled',
								// If interactive, allow pointer events and show pointer cursor
								// Otherwise, disable pointer events
								onRightIconClick
									? 'cursor-pointer hover:text-text-primary'
									: 'pointer-events-none',
								error && 'text-error-500 dark:text-error-400'
							)}
							onKeyDown={
								onRightIconClick
									? (e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault()
												onRightIconClick()
											}
										}
									: undefined
							}>
							{rightIcon}
						</div>
					)}
				</div>
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

Input.displayName = 'Input'
