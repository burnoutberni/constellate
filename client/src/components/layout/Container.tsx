import React from 'react'

import { cn } from '../../lib/utils'

export type ContainerSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
	/**
	 * Maximum width of the container
	 * @default 'lg'
	 */
	size?: ContainerSize
	/**
	 * Whether the container should have horizontal padding
	 * @default true
	 */
	padding?: boolean
	/**
	 * Container content
	 */
	children: React.ReactNode
}

// Max width styles based on size
const sizeStyles: Record<ContainerSize, string> = {
	sm: 'max-w-screen-sm',
	md: 'max-w-screen-md',
	lg: 'max-w-screen-lg',
	xl: 'max-w-screen-xl',
	full: 'max-w-full',
}

/**
 * Container component for max-width constrained content.
 * Provides consistent content width across different screen sizes.
 * Responsive and uses design tokens for spacing.
 */
export const Container = React.forwardRef<HTMLDivElement, ContainerProps>(
	({ size = 'lg', padding = true, children, className, ...props }, ref) => {
		// Padding styles
		const paddingStyles = padding ? 'px-4 sm:px-6 lg:px-8' : 'px-0'

		const classes = cn('w-full mx-auto', sizeStyles[size], paddingStyles, className)

		return (
			<div ref={ref} className={classes} {...props}>
				{children}
			</div>
		)
	}
)

Container.displayName = 'Container'
