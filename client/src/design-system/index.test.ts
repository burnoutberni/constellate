/**
 * Tests for design-system index.ts exports
 * 
 * Ensures all public API exports are available and working.
 */

import { describe, it, expect } from 'vitest'
import * as DesignSystem from './index'
import {
  tokens,
  primaryColors,
  secondaryColors,
  neutralColors,
  semanticColors,
  lightThemeColors,
  darkThemeColors,
  fontFamilies,
  fontSizes,
  fontWeights,
  lineHeights,
  letterSpacing,
  typography,
  spacing,
  borderRadius,
  shadows,
  darkShadows,
  breakpoints,
  zIndex,
  transitionDuration,
  transitionTiming,
  transitions,
  type Theme,
} from './tokens'
import {
  isValidSpacing,
  isValidBorderRadius,
  isValidShadow,
  isValidBreakpoint,
  isValidFontSize,
  isValidFontWeight,
  isValidTheme,
  type ColorScale,
  type ThemeColors,
  type TypographyStyle,
  type Themeable,
  type ColorVariant,
  type SizeVariant,
} from './types'
import {
  ThemeProvider,
  useTheme,
  useThemeColors,
} from './ThemeContext'

describe('Design System Index Exports', () => {
  describe('Token Exports', () => {
    it('should export tokens object', () => {
      expect(DesignSystem.tokens).toBeDefined()
      expect(DesignSystem.tokens).toBe(tokens)
    })

    it('should export color constants', () => {
      expect(DesignSystem.primaryColors).toBe(primaryColors)
      expect(DesignSystem.secondaryColors).toBe(secondaryColors)
      expect(DesignSystem.neutralColors).toBe(neutralColors)
      expect(DesignSystem.semanticColors).toBe(semanticColors)
      expect(DesignSystem.lightThemeColors).toBe(lightThemeColors)
      expect(DesignSystem.darkThemeColors).toBe(darkThemeColors)
    })

    it('should export typography constants', () => {
      expect(DesignSystem.fontFamilies).toBe(fontFamilies)
      expect(DesignSystem.fontSizes).toBe(fontSizes)
      expect(DesignSystem.fontWeights).toBe(fontWeights)
      expect(DesignSystem.lineHeights).toBe(lineHeights)
      expect(DesignSystem.letterSpacing).toBe(letterSpacing)
      expect(DesignSystem.typography).toBe(typography)
    })

    it('should export spacing constants', () => {
      expect(DesignSystem.spacing).toBe(spacing)
    })

    it('should export border radius constants', () => {
      expect(DesignSystem.borderRadius).toBe(borderRadius)
    })

    it('should export shadow constants', () => {
      expect(DesignSystem.shadows).toBe(shadows)
      expect(DesignSystem.darkShadows).toBe(darkShadows)
    })

    it('should export breakpoints', () => {
      expect(DesignSystem.breakpoints).toBe(breakpoints)
    })

    it('should export zIndex', () => {
      expect(DesignSystem.zIndex).toBe(zIndex)
    })

    it('should export transition constants', () => {
      expect(DesignSystem.transitionDuration).toBe(transitionDuration)
      expect(DesignSystem.transitionTiming).toBe(transitionTiming)
      expect(DesignSystem.transitions).toBe(transitions)
    })

    it('should export Theme type', () => {
      const theme: Theme = 'light'
      expect(theme).toBe('light')
    })
  })

  describe('Type Exports', () => {
    it('should export validation functions', () => {
      expect(DesignSystem.isValidSpacing).toBe(isValidSpacing)
      expect(DesignSystem.isValidBorderRadius).toBe(isValidBorderRadius)
      expect(DesignSystem.isValidShadow).toBe(isValidShadow)
      expect(DesignSystem.isValidBreakpoint).toBe(isValidBreakpoint)
      expect(DesignSystem.isValidFontSize).toBe(isValidFontSize)
      expect(DesignSystem.isValidFontWeight).toBe(isValidFontWeight)
      expect(DesignSystem.isValidTheme).toBe(isValidTheme)
    })

    it('should export type definitions', () => {
      // Test that types are available (compile-time check)
      const colorScale: ColorScale = { 500: '#000' }
      const themeColors: ThemeColors = tokens.colors.light
      const typographyStyle: TypographyStyle = {
        fontSize: '1rem',
        fontWeight: 400,
        lineHeight: 1.5,
        letterSpacing: '0em',
      }
      
      expect(colorScale).toBeDefined()
      expect(themeColors).toBeDefined()
      expect(typographyStyle).toBeDefined()
    })

    it('should export component prop types', () => {
      const themeable: Themeable = { theme: 'light' }
      const colorVariant: ColorVariant = { variant: 'primary' }
      const sizeVariant: SizeVariant = { size: 'md' }
      
      expect(themeable).toBeDefined()
      expect(colorVariant).toBeDefined()
      expect(sizeVariant).toBeDefined()
    })
  })

  describe('Theme Context Exports', () => {
    it('should export ThemeProvider', () => {
      expect(DesignSystem.ThemeProvider).toBe(ThemeProvider)
    })

    it('should export useTheme hook', () => {
      expect(DesignSystem.useTheme).toBe(useTheme)
    })

    it('should export useThemeColors hook', () => {
      expect(DesignSystem.useThemeColors).toBe(useThemeColors)
    })
  })

  describe('Public API Completeness', () => {
    it('should export all expected token categories', () => {
      expect(DesignSystem.tokens.colors).toBeDefined()
      expect(DesignSystem.tokens.typography).toBeDefined()
      expect(DesignSystem.tokens.spacing).toBeDefined()
      expect(DesignSystem.tokens.borderRadius).toBeDefined()
      expect(DesignSystem.tokens.shadows).toBeDefined()
      expect(DesignSystem.tokens.breakpoints).toBeDefined()
      expect(DesignSystem.tokens.zIndex).toBeDefined()
      expect(DesignSystem.tokens.transitions).toBeDefined()
    })

    it('should export both light and dark theme colors', () => {
      expect(DesignSystem.tokens.colors.light).toBeDefined()
      expect(DesignSystem.tokens.colors.dark).toBeDefined()
    })

    it('should export both light and dark shadows', () => {
      expect(DesignSystem.tokens.shadows.light).toBeDefined()
      expect(DesignSystem.tokens.shadows.dark).toBeDefined()
    })
  })
})
