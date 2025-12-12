import React, { createContext, useContext } from 'react'

import { cn } from '../../lib/utils'

import { Button } from './Button'

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
						'flex gap-1',
						'border border-border-default rounded-md p-1',
						'bg-background-primary',
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
			<Button
				ref={ref}
				type="button"
				onClick={handleClick}
				variant={isSelected ? 'primary' : 'ghost'}
				size="sm"
				className={cn(
					'p-1.5 rounded',
					'transition-colors duration-200',
					isSelected
						? ['bg-primary-600 text-white', 'dark:bg-primary-500 dark:text-white']
						: [
								'text-text-secondary',
								'hover:bg-background-secondary',
								'dark:hover:bg-background-tertiary',
							],
					className
				)}
				aria-pressed={isSelected}
				{...props}>
				{icon && <span className="flex items-center justify-center">{icon}</span>}
				{children}
			</Button>
		)
	}
)

ToggleButton.displayName = 'ToggleButton'
