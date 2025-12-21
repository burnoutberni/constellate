import React from 'react'
import { Link, type LinkProps } from 'react-router-dom'

import { cn } from '../../lib/utils'

import { Spinner } from './Spinner'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
export type ButtonSize = 'sm' | 'md' | 'lg'

type BaseButtonProps = {
	/**
	 * Visual style variant of the button
	 * @default 'primary'
	 */
	variant?: ButtonVariant
	/**
	 * Size of the button
	 * @default 'md'
	 */
	size?: ButtonSize
	/**
	 * Whether the button is in a loading state
	 */
	loading?: boolean
	/**
	 * Whether the button should take full width of its container
	 */
	fullWidth?: boolean
	/**
	 * Icon to display before the button text
	 */
	leftIcon?: React.ReactNode
	/**
	 * Icon to display after the button text
	 */
	rightIcon?: React.ReactNode
	/**
	 * Button content
	 */
	children: React.ReactNode
	/**
	 * Additional CSS classes
	 */
	className?: string
}

type ButtonAsButton = BaseButtonProps &
	React.ButtonHTMLAttributes<HTMLButtonElement> & {
		to?: never
	}

type ButtonAsLink = BaseButtonProps &
	Omit<LinkProps, 'className' | 'style' | 'children'> & {
		to: string
		disabled?: boolean
	}

type ButtonAsChild = BaseButtonProps & {
	asChild?: boolean
	to?: never
	disabled?: boolean
} & React.HTMLAttributes<HTMLElement>

export type ButtonProps = ButtonAsButton | ButtonAsLink | ButtonAsChild

/**
 * Button component with multiple variants and sizes.
 * Fully accessible with keyboard navigation and ARIA support.
 * Supports dark mode through Tailwind classes.
 * When `to` prop is provided, renders as a Link styled as a button for navigation.
 * When `asChild` is true, renders children directly but applies button styles (useful for wrapping <a> tags).
 */
export const Button = React.forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
	(
		{
			variant = 'primary',
			size = 'md',
			loading = false,
			fullWidth = false,
			leftIcon,
			rightIcon,
			children,
			className,
			disabled,
			to,
			...props
		},
		ref
	) => {
		const { asChild } = props as { asChild?: boolean }
		const isDisabled = disabled || loading

		// Base styles - using design tokens via Tailwind
		const baseStyles = [
			'inline-flex items-center justify-center',
			'font-medium',
			'rounded-lg',
			'transition-all duration-200 ease-in-out',
			'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
			'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none',
			'active:scale-[0.98]',
		]

		// Variant styles
		const variantStyles = {
			primary: [
				'bg-primary-600 text-white',
				'hover:bg-primary-700 hover:shadow-md hover:shadow-primary-600/20',
				'active:bg-primary-800',
				'focus-visible:ring-primary-500',
				'dark:bg-primary-500 dark:hover:bg-primary-400 dark:hover:shadow-primary-500/20 dark:active:bg-primary-600',
				'border border-transparent',
			],
			secondary: [
				'bg-white text-text-primary',
				'border border-border-default',
				'hover:bg-neutral-50 hover:border-border-hover hover:shadow-sm',
				'active:bg-neutral-100',
				'focus-visible:ring-neutral-400',
				'dark:bg-background-tertiary dark:border-border-default dark:text-text-primary',
				'dark:hover:bg-background-secondary dark:hover:border-border-hover',
				'dark:active:bg-background-primary',
			],
			ghost: [
				'bg-transparent text-text-secondary',
				'hover:bg-neutral-100 hover:text-text-primary',
				'active:bg-neutral-200',
				'focus-visible:ring-neutral-400',
				'dark:text-text-secondary dark:hover:bg-background-tertiary dark:hover:text-text-primary',
				'dark:active:bg-background-secondary',
				'border border-transparent',
			],
			danger: [
				'bg-error-600 text-white',
				'hover:bg-error-700 hover:shadow-md hover:shadow-error-600/20',
				'active:bg-error-800',
				'focus-visible:ring-error-500',
				'dark:bg-error-600 dark:hover:bg-error-500 dark:active:bg-error-700',
				'border border-transparent',
			],
			outline: [
				'bg-transparent text-primary-600',
				'border border-primary-600',
				'hover:bg-primary-50',
				'active:bg-primary-100',
				'focus-visible:ring-primary-500',
				'dark:text-primary-400 dark:border-primary-400',
				'dark:hover:bg-primary-950/30',
				'dark:active:bg-primary-900/50',
			],
		}

		// Size styles
		const sizeStyles = {
			sm: ['text-sm px-3 py-1.5 gap-1.5', 'min-h-[32px]'],
			md: ['text-sm px-4 py-2 gap-2', 'min-h-[40px]'],
			lg: ['text-base px-6 py-2.5 gap-2.5', 'min-h-[48px]'],
		}

		const classes = cn(
			baseStyles,
			variantStyles[variant],
			sizeStyles[size],
			fullWidth && 'w-full',
			isDisabled && 'pointer-events-none opacity-50',
			className
		)

		const content = (
			<>
				{loading && <Spinner size="sm" className="text-current" />}
				{!loading && leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
				<span className={loading ? 'opacity-0' : ''}>{children}</span>
				{!loading && rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
			</>
		)

		// Render as child using React.cloneElement to apply styles to the child element
		if (asChild && React.isValidElement(children)) {
			const child = children as React.ReactElement<{ className?: string }>

			// Extract props that should be forwarded to the child element
			const {
				variant: _variant,
				size: _size,
				loading: _loading,
				fullWidth: _fullWidth,
				leftIcon: _leftIcon,
				rightIcon: _rightIcon,
				asChild: _asChild,
				to: _to,
				children: _children,
				...forwardedProps
			} = props as ButtonAsChild

			return React.cloneElement(child, {
				...forwardedProps,
				className: cn(classes, child.props.className),
			})
		}

		// Render as Link when `to` prop is provided
		if (to) {
			// Filter out button-specific props that aren't valid for Link
			const {
				type: _type,
				form: _form,
				formAction: _formAction,
				formEncType: _formEncType,
				formMethod: _formMethod,
				formNoValidate: _formNoValidate,
				formTarget: _formTarget,
				name: _name,
				value: _value,
				...linkProps
			} = props as React.ButtonHTMLAttributes<HTMLButtonElement> & { to?: string }

			return (
				<Link
					ref={ref as React.ForwardedRef<HTMLAnchorElement>}
					to={to}
					className={classes}
					aria-disabled={isDisabled}
					{...(linkProps as Omit<LinkProps, 'to' | 'className' | 'children'>)}>
					{content}
				</Link>
			)
		}

		// Render as button by default
		return (
			<button
				ref={ref as React.ForwardedRef<HTMLButtonElement>}
				type="button"
				className={classes}
				disabled={isDisabled}
				aria-busy={loading}
				aria-disabled={isDisabled}
				{...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
				{content}
			</button>
		)
	}
)

Button.displayName = 'Button'
