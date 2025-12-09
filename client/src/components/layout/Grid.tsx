import React from 'react'
import { cn } from '../../lib/utils'

export type GridCols = 1 | 2 | 3 | 4 | 5 | 6 | 12
export type GridGap = 'none' | 'sm' | 'md' | 'lg' | 'xl'

export interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Number of columns on mobile (default breakpoint)
   * @default 1
   */
  cols?: GridCols
  /**
   * Number of columns on small screens (640px+)
   */
  colsSm?: GridCols
  /**
   * Number of columns on medium screens (768px+)
   */
  colsMd?: GridCols
  /**
   * Number of columns on large screens (1024px+)
   */
  colsLg?: GridCols
  /**
   * Number of columns on extra large screens (1280px+)
   */
  colsXl?: GridCols
  /**
   * Number of columns on 2xl screens (1536px+)
   */
  cols2xl?: GridCols
  /**
   * Gap between grid items
   * @default 'md'
   */
  gap?: GridGap
  /**
   * Whether to use equal height columns
   * @default false
   */
  equalHeight?: boolean
  /**
   * Grid content
   */
  children: React.ReactNode
}

// Column styles mapping - explicit class names for Tailwind JIT
// Nested structure: breakpoint -> column count -> class name
type BreakpointKey = 'base' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
const colClassMap: Record<BreakpointKey, Record<GridCols, string>> = {
  base: {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6',
    12: 'grid-cols-12',
  },
  sm: {
    1: 'sm:grid-cols-1',
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-3',
    4: 'sm:grid-cols-4',
    5: 'sm:grid-cols-5',
    6: 'sm:grid-cols-6',
    12: 'sm:grid-cols-12',
  },
  md: {
    1: 'md:grid-cols-1',
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-4',
    5: 'md:grid-cols-5',
    6: 'md:grid-cols-6',
    12: 'md:grid-cols-12',
  },
  lg: {
    1: 'lg:grid-cols-1',
    2: 'lg:grid-cols-2',
    3: 'lg:grid-cols-3',
    4: 'lg:grid-cols-4',
    5: 'lg:grid-cols-5',
    6: 'lg:grid-cols-6',
    12: 'lg:grid-cols-12',
  },
  xl: {
    1: 'xl:grid-cols-1',
    2: 'xl:grid-cols-2',
    3: 'xl:grid-cols-3',
    4: 'xl:grid-cols-4',
    5: 'xl:grid-cols-5',
    6: 'xl:grid-cols-6',
    12: 'xl:grid-cols-12',
  },
  '2xl': {
    1: '2xl:grid-cols-1',
    2: '2xl:grid-cols-2',
    3: '2xl:grid-cols-3',
    4: '2xl:grid-cols-4',
    5: '2xl:grid-cols-5',
    6: '2xl:grid-cols-6',
    12: '2xl:grid-cols-12',
  },
}

// Gap styles using design tokens
const gapStyles: Record<GridGap, string> = {
  none: 'gap-0',
  sm: 'gap-2 sm:gap-3',
  md: 'gap-4 sm:gap-6',
  lg: 'gap-6 sm:gap-8',
  xl: 'gap-8 sm:gap-12',
}

/**
 * Grid component for responsive grid layouts.
 * Uses CSS Grid with responsive column configurations.
 * Fully responsive and uses design tokens for spacing.
 */
export const Grid = React.forwardRef<HTMLDivElement, GridProps>(
  (
    {
      cols = 1,
      colsSm,
      colsMd,
      colsLg,
      colsXl,
      cols2xl,
      gap = 'md',
      equalHeight = false,
      children,
      className,
      ...props
    },
    ref
  ) => {
    // Base grid styles
    const baseStyles = ['grid', 'w-full']

    // Column styles - responsive grid columns
    const colStyles = [
      colClassMap.base[cols],
      colsSm && colClassMap.sm[colsSm],
      colsMd && colClassMap.md[colsMd],
      colsLg && colClassMap.lg[colsLg],
      colsXl && colClassMap.xl[colsXl],
      cols2xl && colClassMap['2xl'][cols2xl],
    ].filter(Boolean)

    // Equal height styles
    const equalHeightStyles = equalHeight
      ? 'items-stretch'
      : ''

    const classes = cn(
      baseStyles,
      colStyles,
      gapStyles[gap],
      equalHeightStyles,
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

Grid.displayName = 'Grid'
