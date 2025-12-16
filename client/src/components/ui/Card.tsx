import React from 'react'

import { cn } from '../../lib/utils'

export type CardVariant = 'default' | 'outlined' | 'elevated' | 'flat' | 'interactive'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
	/**
	 * Visual style variant of the card
	 * @default 'default'
	 */
	variant?: CardVariant
	/**
	 * Whether the card is interactive (hoverable/clickable)
	 * Note: 'interactive' variant implies this is true
	 */
	interactive?: boolean
	/**
	 * Padding size of the card content
	 * @default 'md'
	 */
	padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
	/**
	 * Card content
	 */
	children: React.ReactNode
}

/**
 * Card component for displaying content in a contained area.
 * Supports multiple variants and interactive states.
 * Fully accessible and supports dark mode.
 */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
	(
		{
			variant = 'default',
			interactive = false,
			padding = 'md',
			children,
			className,
			onClick,
			onKeyDown,
			...props
		},
		ref
	) => {
		// Base styles
		const baseStyles = [
			'rounded-xl', // More modern rounded corners
			'transition-all duration-200 ease-in-out',
			'overflow-hidden', // Ensure content respects border radius
		]

		// Variant styles
		const variantStyles = {
			default: [
				'bg-white dark:bg-neutral-900',
				'border border-neutral-200 dark:border-neutral-800',
				'shadow-sm',
			],
			outlined: ['bg-transparent', 'border-2 border-neutral-200 dark:border-neutral-800'],
			elevated: [
				'bg-white dark:bg-neutral-900',
				'border border-neutral-100 dark:border-neutral-800',
				'shadow-md hover:shadow-lg',
			],
			flat: ['bg-neutral-50 dark:bg-neutral-800/50', 'border-transparent'],
			interactive: [
				'bg-white dark:bg-neutral-900',
				'border border-neutral-200 dark:border-neutral-800',
				'shadow-sm',
				// Interactive states specifically for this variant
				'hover:border-primary-200 dark:hover:border-primary-900',
				'hover:shadow-md hover:shadow-primary-900/5',
				'active:scale-[0.99]',
			],
		}

		// Padding styles
		const paddingStyles = {
			none: 'p-0',
			sm: 'p-3',
			md: 'p-5', // Increased slightly for better breathing room
			lg: 'p-6',
			xl: 'p-8',
		}

		// Interactive logic
		const isInteractive = interactive || variant === 'interactive' || Boolean(onClick)
		const interactiveStyles = isInteractive
			? [
					'cursor-pointer',
					// Generic interactive styles (if not already covered by variant)
					variant !== 'interactive' && 'hover:shadow-md hover:-translate-y-[1px]',
					'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
					'active:translate-y-0',
				]
			: []

		const classes = cn(
			baseStyles,
			variantStyles[variant],
			paddingStyles[padding],
			interactiveStyles,
			className
		)

		// Handle keyboard events for accessibility
		const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
			// Call user's onKeyDown handler if provided
			onKeyDown?.(event)

			// If interactive and has onClick, handle Enter and Space keys
			if (isInteractive && onClick) {
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault()
					onClick(event as unknown as React.MouseEvent<HTMLDivElement>)
				}
			}
		}

		return (
			<div
				ref={ref}
				className={classes}
				role={isInteractive ? 'button' : undefined}
				tabIndex={isInteractive ? 0 : undefined}
				onClick={onClick}
				onKeyDown={handleKeyDown}
				{...props}>
				{children}
			</div>
		)
	}
)

Card.displayName = 'Card'

/**
 * Card Header component for card titles and actions
 */
export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
	children: React.ReactNode
}

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
	({ children, className, ...props }, ref) => (
		<div
			ref={ref}
			className={cn('flex items-center justify-between mb-4', className)}
			{...props}>
			{children}
		</div>
	)
)

CardHeader.displayName = 'CardHeader'

/**
 * Card Title component
 */
export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
	as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
	children: React.ReactNode
}

export const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
	({ as: Component = 'h3', children, className, ...props }, ref) => (
		<Component
			ref={ref}
			className={cn('text-lg font-semibold text-text-primary tracking-tight', className)}
			{...props}>
			{children}
		</Component>
	)
)

CardTitle.displayName = 'CardTitle'

/**
 * Card Content component for main card content
 */
export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
	children: React.ReactNode
}

export const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
	({ children, className, ...props }, ref) => (
		<div ref={ref} className={cn('text-text-secondary text-sm', className)} {...props}>
			{children}
		</div>
	)
)

CardContent.displayName = 'CardContent'

/**
 * Card Footer component for card actions
 */
export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
	children: React.ReactNode
}

export const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
	({ children, className, ...props }, ref) => (
		<div
			ref={ref}
			className={cn(
				'flex items-center justify-end gap-3 mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-800',
				className
			)}
			{...props}>
			{children}
		</div>
	)
)

CardFooter.displayName = 'CardFooter'
