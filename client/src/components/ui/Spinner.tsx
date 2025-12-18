import React from 'react'

import { cn } from '../../lib/utils'

export interface SpinnerProps extends React.SVGProps<SVGSVGElement> {
	/**
	 * Size of the spinner
	 * @default 'md'
	 */
	size?: 'sm' | 'md' | 'lg' | 'xl'
	/**
	 * Color variant of the spinner
	 * @default 'primary'
	 */
	variant?: 'primary' | 'secondary' | 'white' | 'neutral'
	/**
	 * Additional CSS classes to apply
	 */
	className?: string
}

const sizeClasses = {
	sm: 'h-4 w-4',
	md: 'h-8 w-8',
	lg: 'h-12 w-12',
	xl: 'h-16 w-16',
}

const variantClasses = {
	primary: 'text-primary-600 dark:text-primary-500',
	secondary: 'text-secondary-600 dark:text-secondary-500',
	neutral: 'text-neutral-600 dark:text-neutral-400',
	white: 'text-white',
}

/**
 * Spinner component for displaying loading indicators.
 * Provides a rotating animation to indicate content is loading.
 * Supports multiple sizes and color variants.
 */
export function Spinner({ size = 'md', variant = 'primary', className, ...props }: SpinnerProps) {
	return (
		<svg
			className={cn('animate-spin', sizeClasses[size], variantClasses[variant], className)}
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			aria-hidden="true"
			role="status"
			aria-label="Loading"
			{...props}>
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
	)
}
