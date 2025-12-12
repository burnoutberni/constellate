import React from 'react'
import { cn } from '../../lib/utils'

export type StackDirection = 'row' | 'column'
export type StackAlign = 'start' | 'center' | 'end' | 'stretch'
export type StackJustify = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'
export type StackGap = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'

export interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
	/**
	 * Direction of the stack (row or column)
	 * @default 'column'
	 */
	direction?: StackDirection
	/**
	 * Direction on small screens (640px+)
	 */
	directionSm?: StackDirection
	/**
	 * Direction on medium screens (768px+)
	 */
	directionMd?: StackDirection
	/**
	 * Direction on large screens (1024px+)
	 */
	directionLg?: StackDirection
	/**
	 * Direction on extra large screens (1280px+)
	 */
	directionXl?: StackDirection
	/**
	 * Direction on 2xl screens (1536px+)
	 */
	direction2xl?: StackDirection
	/**
	 * Alignment of items along the cross axis
	 * @default 'start'
	 */
	align?: StackAlign
	/**
	 * Alignment on small screens (640px+)
	 */
	alignSm?: StackAlign
	/**
	 * Alignment on medium screens (768px+)
	 */
	alignMd?: StackAlign
	/**
	 * Alignment on large screens (1024px+)
	 */
	alignLg?: StackAlign
	/**
	 * Alignment on extra large screens (1280px+)
	 */
	alignXl?: StackAlign
	/**
	 * Alignment on 2xl screens (1536px+)
	 */
	align2xl?: StackAlign
	/**
	 * Justification of items along the main axis
	 * @default 'start'
	 */
	justify?: StackJustify
	/**
	 * Justification on small screens (640px+)
	 */
	justifySm?: StackJustify
	/**
	 * Justification on medium screens (768px+)
	 */
	justifyMd?: StackJustify
	/**
	 * Justification on large screens (1024px+)
	 */
	justifyLg?: StackJustify
	/**
	 * Justification on extra large screens (1280px+)
	 */
	justifyXl?: StackJustify
	/**
	 * Justification on 2xl screens (1536px+)
	 */
	justify2xl?: StackJustify
	/**
	 * Gap between stack items
	 * @default 'md'
	 */
	gap?: StackGap
	/**
	 * Whether to wrap items to next line
	 * @default false
	 */
	wrap?: boolean
	/**
	 * Stack content
	 */
	children: React.ReactNode
}

// Gap styles using design tokens
const gapStyles: Record<StackGap, string> = {
	none: 'gap-0',
	xs: 'gap-1',
	sm: 'gap-2',
	md: 'gap-4',
	lg: 'gap-6',
	xl: 'gap-8',
	'2xl': 'gap-12',
}

// Direction styles mapping - explicit class names for Tailwind JIT
type DirectionBreakpointKey = 'base' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
const directionClassMap: Record<DirectionBreakpointKey, Record<StackDirection, string>> = {
	base: {
		row: 'flex-row',
		column: 'flex-col',
	},
	sm: {
		row: 'sm:flex-row',
		column: 'sm:flex-col',
	},
	md: {
		row: 'md:flex-row',
		column: 'md:flex-col',
	},
	lg: {
		row: 'lg:flex-row',
		column: 'lg:flex-col',
	},
	xl: {
		row: 'xl:flex-row',
		column: 'xl:flex-col',
	},
	'2xl': {
		row: '2xl:flex-row',
		column: '2xl:flex-col',
	},
}

// Alignment styles mapping for responsive breakpoints
const alignClassMap: Record<DirectionBreakpointKey, Record<StackAlign, string>> = {
	base: {
		start: 'items-start',
		center: 'items-center',
		end: 'items-end',
		stretch: 'items-stretch',
	},
	sm: {
		start: 'sm:items-start',
		center: 'sm:items-center',
		end: 'sm:items-end',
		stretch: 'sm:items-stretch',
	},
	md: {
		start: 'md:items-start',
		center: 'md:items-center',
		end: 'md:items-end',
		stretch: 'md:items-stretch',
	},
	lg: {
		start: 'lg:items-start',
		center: 'lg:items-center',
		end: 'lg:items-end',
		stretch: 'lg:items-stretch',
	},
	xl: {
		start: 'xl:items-start',
		center: 'xl:items-center',
		end: 'xl:items-end',
		stretch: 'xl:items-stretch',
	},
	'2xl': {
		start: '2xl:items-start',
		center: '2xl:items-center',
		end: '2xl:items-end',
		stretch: '2xl:items-stretch',
	},
}

// Justification styles mapping for responsive breakpoints
const justifyClassMap: Record<DirectionBreakpointKey, Record<StackJustify, string>> = {
	base: {
		start: 'justify-start',
		center: 'justify-center',
		end: 'justify-end',
		between: 'justify-between',
		around: 'justify-around',
		evenly: 'justify-evenly',
	},
	sm: {
		start: 'sm:justify-start',
		center: 'sm:justify-center',
		end: 'sm:justify-end',
		between: 'sm:justify-between',
		around: 'sm:justify-around',
		evenly: 'sm:justify-evenly',
	},
	md: {
		start: 'md:justify-start',
		center: 'md:justify-center',
		end: 'md:justify-end',
		between: 'md:justify-between',
		around: 'md:justify-around',
		evenly: 'md:justify-evenly',
	},
	lg: {
		start: 'lg:justify-start',
		center: 'lg:justify-center',
		end: 'lg:justify-end',
		between: 'lg:justify-between',
		around: 'lg:justify-around',
		evenly: 'lg:justify-evenly',
	},
	xl: {
		start: 'xl:justify-start',
		center: 'xl:justify-center',
		end: 'xl:justify-end',
		between: 'xl:justify-between',
		around: 'xl:justify-around',
		evenly: 'xl:justify-evenly',
	},
	'2xl': {
		start: '2xl:justify-start',
		center: '2xl:justify-center',
		end: '2xl:justify-end',
		between: '2xl:justify-between',
		around: '2xl:justify-around',
		evenly: '2xl:justify-evenly',
	},
}

/**
 * Stack component for vertical/horizontal spacing.
 * Provides consistent spacing between child elements.
 * Responsive and uses design tokens for spacing.
 */
export const Stack = React.forwardRef<HTMLDivElement, StackProps>(
	(
		{
			direction = 'column',
			directionSm,
			directionMd,
			directionLg,
			directionXl,
			direction2xl,
			align = 'start',
			alignSm,
			alignMd,
			alignLg,
			alignXl,
			align2xl,
			justify = 'start',
			justifySm,
			justifyMd,
			justifyLg,
			justifyXl,
			justify2xl,
			gap = 'md',
			wrap = false,
			children,
			className,
			...props
		},
		ref
	) => {
		// Base flex styles
		const baseStyles = ['flex', 'w-full']

		// Direction styles - responsive flex direction
		const directionStyles = [
			directionClassMap.base[direction],
			directionSm && directionClassMap.sm[directionSm],
			directionMd && directionClassMap.md[directionMd],
			directionLg && directionClassMap.lg[directionLg],
			directionXl && directionClassMap.xl[directionXl],
			direction2xl && directionClassMap['2xl'][direction2xl],
		].filter(Boolean)

		// Alignment styles - responsive alignment
		const alignmentStyles = [
			alignClassMap.base[align],
			alignSm && alignClassMap.sm[alignSm],
			alignMd && alignClassMap.md[alignMd],
			alignLg && alignClassMap.lg[alignLg],
			alignXl && alignClassMap.xl[alignXl],
			align2xl && alignClassMap['2xl'][align2xl],
		].filter(Boolean)

		// Justification styles - responsive justification
		const justificationStyles = [
			justifyClassMap.base[justify],
			justifySm && justifyClassMap.sm[justifySm],
			justifyMd && justifyClassMap.md[justifyMd],
			justifyLg && justifyClassMap.lg[justifyLg],
			justifyXl && justifyClassMap.xl[justifyXl],
			justify2xl && justifyClassMap['2xl'][justify2xl],
		].filter(Boolean)

		// Wrap styles
		const wrapStyles = wrap ? 'flex-wrap' : ''

		const classes = cn(
			baseStyles,
			directionStyles,
			alignmentStyles,
			justificationStyles,
			gapStyles[gap],
			wrapStyles,
			className
		)

		return (
			<div ref={ref} className={classes} {...props}>
				{children}
			</div>
		)
	}
)

Stack.displayName = 'Stack'
