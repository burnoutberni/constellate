import React, { createContext, useContext } from 'react'

import { cn } from '../../lib/utils'

interface ToggleGroupContextValue {
	value: string | null
	onValueChange: (value: string) => void
}

const ToggleGroupContext = createContext<ToggleGroupContextValue | null>(null)

export interface ToggleGroupProps extends React.HTMLAttributes<HTMLDivElement> {
	/**
	 * The currently selected value
	 */
	value: string | null
	/**
	 * Callback when the value changes
	 */
	onValueChange: (value: string) => void
	/**
	 * Toggle button children
	 */
	children: React.ReactNode
}

/**
 * ToggleGroup component for managing a group of toggle buttons.
 * Provides context to ToggleButton children for coordinated selection.
 * Uses design system color tokens and supports dark mode.
 */
export const ToggleGroup = React.forwardRef<HTMLDivElement, ToggleGroupProps>(
	({ value, onValueChange, children, className, ...props }, ref) => {
		const contextValue: ToggleGroupContextValue = {
			value,
			onValueChange,
		}

		return (
			<ToggleGroupContext.Provider value={contextValue}>
				<div
					ref={ref}
					className={cn(
						'inline-flex p-1 rounded-lg',
						'bg-neutral-100 dark:bg-neutral-800',
						'border border-neutral-200 dark:border-neutral-700',
						className
					)}
					role="group"
					{...props}>
					{children}
				</div>
			</ToggleGroupContext.Provider>
		)
	}
)

ToggleGroup.displayName = 'ToggleGroup'

/**
 * Hook to access ToggleGroup context
 */
function useToggleGroup(): ToggleGroupContextValue {
	const context = useContext(ToggleGroupContext)
	if (!context) {
		throw new Error('ToggleButton must be used within a ToggleGroup')
	}
	return context
}

export interface ToggleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	/**
	 * The value this button represents
	 */
	value: string
	/**
	 * Optional icon to display in the button
	 */
	icon?: React.ReactNode
	/**
	 * Button content (alternative to icon)
	 */
	children?: React.ReactNode
}

/**
 * ToggleButton component for use within a ToggleGroup.
 * Automatically handles active/inactive states based on group value.
 * Uses design system color tokens and supports dark mode.
 */
export const ToggleButton = React.forwardRef<HTMLButtonElement, ToggleButtonProps>(
	({ value, icon, children, className, onClick, ...props }, ref) => {
		const { value: selectedValue, onValueChange } = useToggleGroup()
		const isSelected = selectedValue === value

		const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
			onValueChange(value)
			onClick?.(e)
		}

		return (
			<button
				ref={ref}
				type="button"
				onClick={handleClick}
				className={cn(
					'inline-flex items-center justify-center',
					'px-3 py-1.5 rounded-md text-sm font-medium',
					'transition-all duration-200 ease-in-out',
					'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1',
					isSelected
						? [
								'bg-white dark:bg-neutral-700',
								'text-primary-700 dark:text-primary-300',
								'shadow-sm',
							]
						: [
								'text-text-secondary',
								'hover:text-text-primary',
								'hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50',
							],
					className
				)}
				aria-pressed={isSelected}
				{...props}>
				{icon && (
					<span className={cn('flex items-center justify-center', children && 'mr-2')}>
						{icon}
					</span>
				)}
				{children}
			</button>
		)
	}
)

ToggleButton.displayName = 'ToggleButton'
