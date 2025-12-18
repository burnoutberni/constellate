import React from 'react'

import { cn } from '../../lib/utils'

export type BadgeVariant =
	| 'default'
	| 'primary'
	| 'secondary'
	| 'success'
	| 'warning'
	| 'error'
	| 'info'
	| 'outline'
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
	 * @default true
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
	({ variant = 'default', size = 'md', rounded = true, children, className, ...props }, ref) => {
		// Base styles
		const baseStyles = [
			'inline-flex items-center justify-center',
			'font-medium',
			'transition-colors duration-200',
			'whitespace-nowrap',
		]

		// Variant styles
		const variantStyles = {
			default: [
				'bg-neutral-100 text-neutral-800',
				'dark:bg-neutral-800 dark:text-neutral-300',
				'border border-transparent',
			],
			primary: [
				'bg-primary-50 text-primary-700',
				'dark:bg-primary-900/30 dark:text-primary-300',
				'border border-primary-200 dark:border-primary-800',
			],
			secondary: [
				'bg-secondary-50 text-secondary-700',
				'dark:bg-secondary-900/30 dark:text-secondary-300',
				'border border-secondary-200 dark:border-secondary-800',
			],
			success: [
				'bg-success-50 text-success-700',
				'dark:bg-success-900/30 dark:text-success-300',
				'border border-success-200 dark:border-success-800',
			],
			warning: [
				'bg-warning-50 text-warning-700',
				'dark:bg-warning-900/30 dark:text-warning-300',
				'border border-warning-200 dark:border-warning-800',
			],
			error: [
				'bg-error-50 text-error-700',
				'dark:bg-error-900/30 dark:text-error-300',
				'border border-error-200 dark:border-error-800',
			],
			info: [
				'bg-info-50 text-info-700',
				'dark:bg-info-900/30 dark:text-info-300',
				'border border-info-200 dark:border-info-800',
			],
			outline: [
				'bg-transparent',
				'text-text-secondary',
				'border border-neutral-300 dark:border-neutral-700',
			],
		}

		// Size styles
		const sizeStyles = {
			sm: ['text-[10px] px-1.5 py-0.5', 'leading-none'],
			md: ['text-xs px-2.5 py-0.5', 'leading-4'],
			lg: ['text-sm px-3 py-1', 'leading-5'],
		}

		// Border radius
		const radiusStyles = rounded ? 'rounded-full' : 'rounded-md'

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
