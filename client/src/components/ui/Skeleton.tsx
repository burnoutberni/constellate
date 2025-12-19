import React from 'react'

import { cn } from '../../lib/utils'

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
	/**
	 * Additional CSS classes to apply
	 */
	className?: string
}

/**
 * Skeleton component for displaying loading placeholders.
 * Provides a pulsing animation to indicate content is loading.
 * Supports dark mode and custom styling.
 */
export function Skeleton({ className, ...props }: SkeletonProps) {
	return (
		<div
			className={cn('animate-pulse rounded-md bg-background-tertiary', className)}
			aria-hidden="true"
			{...props}
		/>
	)
}
