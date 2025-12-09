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
   * Alignment of items along the cross axis
   * @default 'start'
   */
  align?: StackAlign
  /**
   * Justification of items along the main axis
   * @default 'start'
   */
  justify?: StackJustify
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

// Alignment styles
const alignStyles: Record<StackAlign, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
}

// Justification styles
const justifyStyles: Record<StackJustify, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
  evenly: 'justify-evenly',
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
type DirectionBreakpointKey = 'base' | 'sm' | 'md' | 'lg'
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
      align = 'start',
      justify = 'start',
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
    ].filter(Boolean)

    // Wrap styles
    const wrapStyles = wrap ? 'flex-wrap' : ''

    const classes = cn(
      baseStyles,
      directionStyles,
      alignStyles[align],
      justifyStyles[justify],
      gapStyles[gap],
      wrapStyles,
      className
    )

    return (
      <div
        ref={ref}
        className={classes}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Stack.displayName = 'Stack'
