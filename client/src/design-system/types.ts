/**
 * TypeScript types for design system tokens
 * 
 * Provides type safety for design tokens and theme values.
 */

import type { Theme } from './tokens'
import { tokens } from './tokens'

// ============================================================================
// Token Types
// ============================================================================

/**
 * Color scale type (e.g., primary[50] through primary[950])
 */
export type ColorScale = Record<number | string, string>

/**
 * Theme colors type
 */
export type ThemeColors = typeof tokens.colors.light

/**
 * Typography style type
 */
export type TypographyStyle = {
  fontSize: string
  fontWeight: number
  lineHeight: number
  letterSpacing: string
}

/**
 * Spacing value type
 */
export type SpacingValue = keyof typeof tokens.spacing | string | string

/**
 * Border radius value type
 */
export type BorderRadiusValue = keyof typeof tokens.borderRadius

/**
 * Shadow value type
 */
export type ShadowValue = keyof typeof tokens.shadows.light

/**
 * Breakpoint value type
 */
export type BreakpointValue = keyof typeof tokens.breakpoints

/**
 * Z-index value type
 */
export type ZIndexValue = keyof typeof tokens.zIndex

/**
 * Font size value type
 */
export type FontSizeValue = keyof typeof tokens.fontSizes

/**
 * Font weight value type
 */
export type FontWeightValue = keyof typeof tokens.fontWeights

/**
 * Line height value type
 */
export type LineHeightValue = keyof typeof tokens.lineHeights

/**
 * Letter spacing value type
 */
export type LetterSpacingValue = keyof typeof tokens.letterSpacing

// ============================================================================
// Component Prop Types
// ============================================================================

/**
 * Props for components that accept theme
 */
export interface Themeable {
  theme?: Theme
}

/**
 * Props for components that accept color variants
 */
export interface ColorVariant {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'
}

/**
 * Props for components that accept size variants
 */
export interface SizeVariant {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Get color value from theme and color path
 * Example: GetColorValue<'primary', 500> => '#0ea5e9'
 */
export type GetColorValue<
  TColor extends keyof ThemeColors,
  TShade extends keyof ThemeColors[TColor]
> = ThemeColors[TColor][TShade] extends string
  ? ThemeColors[TColor][TShade]
  : never

/**
 * Extract all color keys from a theme
 */
export type ThemeColorKeys = keyof ThemeColors

/**
 * Extract shade keys from a color scale
 */
export type ColorShadeKeys<TColor extends ThemeColorKeys> = keyof ThemeColors[TColor]

// ============================================================================
// Token Validation Types
// ============================================================================

/**
 * Validates that a value is a valid spacing token
 */
export function isValidSpacing(value: string): value is string & SpacingValue {
  return value in tokens.spacing
}

/**
 * Validates that a value is a valid border radius token
 */
export function isValidBorderRadius(value: string): value is BorderRadiusValue {
  return value in tokens.borderRadius
}

/**
 * Validates that a value is a valid shadow token
 */
export function isValidShadow(value: string): value is ShadowValue {
  return value in tokens.shadows.light || value in tokens.shadows.dark
}

/**
 * Validates that a value is a valid breakpoint token
 */
export function isValidBreakpoint(value: string): value is BreakpointValue {
  return value in tokens.breakpoints
}

/**
 * Validates that a value is a valid font size token
 */
export function isValidFontSize(value: string): value is FontSizeValue {
  return value in tokens.fontSizes
}

/**
 * Validates that a value is a valid font weight token
 */
export function isValidFontWeight(value: number): value is typeof tokens.fontWeights[FontWeightValue] {
  return (Object.values(tokens.fontWeights) as number[]).includes(value)
}

/**
 * Validates that a value is a valid theme
 */
export function isValidTheme(value: string): value is Theme {
  return value === 'light' || value === 'dark'
}
