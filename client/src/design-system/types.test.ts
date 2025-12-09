/**
 * Unit tests for design system types and validation functions
 * 
 * Tests type definitions and validation function edge cases.
 */

import { describe, it, expect } from 'vitest'
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
  type SpacingValue,
  type BorderRadiusValue,
  type ShadowValue,
  type BreakpointValue,
  type ZIndexValue,
  type FontSizeValue,
  type FontWeightValue,
  type LineHeightValue,
  type LetterSpacingValue,
  type Themeable,
  type ColorVariant,
  type SizeVariant,
  type GetColorValue,
  type ThemeColorKeys,
  type ColorShadeKeys,
} from './types'
import { tokens } from './tokens'

describe('Type Definitions', () => {
  describe('ColorScale', () => {
    it('should accept valid color scale objects', () => {
      const scale: ColorScale = {
        50: '#f0f9ff',
        100: '#e0f2fe',
        500: '#0ea5e9',
      }
      expect(scale[50]).toBe('#f0f9ff')
      expect(scale[500]).toBe('#0ea5e9')
    })
  })

  describe('ThemeColors', () => {
    it('should match light theme colors structure', () => {
      const colors: ThemeColors = tokens.colors.light
      expect(colors.primary).toBeDefined()
      expect(colors.background).toBeDefined()
      expect(colors.text).toBeDefined()
    })
  })

  describe('TypographyStyle', () => {
    it('should accept valid typography style objects', () => {
      const style: TypographyStyle = {
        fontSize: '1rem',
        fontWeight: 400,
        lineHeight: 1.5,
        letterSpacing: '0em',
      }
      expect(style.fontSize).toBe('1rem')
      expect(style.fontWeight).toBe(400)
    })
  })

  describe('Token Value Types', () => {
    it('should accept valid SpacingValue', () => {
      const spacing: SpacingValue = 4
      expect(spacing).toBe(4)
    })

    it('should accept valid BorderRadiusValue', () => {
      const radius: BorderRadiusValue = 'lg'
      expect(radius).toBe('lg')
    })

    it('should accept valid ShadowValue', () => {
      const shadow: ShadowValue = 'md'
      expect(shadow).toBe('md')
    })

    it('should accept valid BreakpointValue', () => {
      const breakpoint: BreakpointValue = 'md'
      expect(breakpoint).toBe('md')
    })

    it('should accept valid ZIndexValue', () => {
      const zIndex: ZIndexValue = 'modal'
      expect(zIndex).toBe('modal')
    })

    it('should accept valid FontSizeValue', () => {
      const fontSize: FontSizeValue = 'lg'
      expect(fontSize).toBe('lg')
    })

    it('should accept valid FontWeightValue', () => {
      const fontWeight: FontWeightValue = 'bold'
      expect(fontWeight).toBe('bold')
    })

    it('should accept valid LineHeightValue', () => {
      const lineHeight: LineHeightValue = 'normal'
      expect(lineHeight).toBe('normal')
    })

    it('should accept valid LetterSpacingValue', () => {
      const letterSpacing: LetterSpacingValue = 'normal'
      expect(letterSpacing).toBe('normal')
    })
  })

  describe('Component Prop Types', () => {
    it('should accept Themeable interface', () => {
      const props: Themeable = { theme: 'light' }
      expect(props.theme).toBe('light')
    })

    it('should accept ColorVariant interface', () => {
      const props: ColorVariant = { variant: 'primary' }
      expect(props.variant).toBe('primary')
    })

    it('should accept SizeVariant interface', () => {
      const props: SizeVariant = { size: 'md' }
      expect(props.size).toBe('md')
    })
  })

  describe('Utility Types', () => {
    it('should extract color values correctly', () => {
      // This tests the GetColorValue type indirectly
      const primary500 = tokens.colors.light.primary[500]
      expect(primary500).toBe('#0ea5e9')
    })

    it('should extract theme color keys', () => {
      const keys: ThemeColorKeys[] = ['primary', 'secondary', 'neutral', 'background', 'text', 'border']
      expect(keys.length).toBeGreaterThan(0)
    })

    it('should extract color shade keys', () => {
      const shades: ColorShadeKeys<'primary'>[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
      expect(shades.length).toBe(11)
    })
  })
})

describe('Validation Functions - Additional Edge Cases', () => {
  describe('isValidSpacing', () => {
    it('should handle all valid spacing keys', () => {
      const validSpacings: SpacingValue[] = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64]
      validSpacings.forEach(spacing => {
        expect(isValidSpacing(spacing)).toBe(true)
        expect(isValidSpacing(String(spacing))).toBe(true)
      })
    })
  })

  describe('isValidBorderRadius', () => {
    it('should handle all valid border radius keys', () => {
      const validRadii: BorderRadiusValue[] = ['none', 'sm', 'base', 'md', 'lg', 'xl', '2xl', '3xl', 'full']
      validRadii.forEach(radius => {
        expect(isValidBorderRadius(radius)).toBe(true)
      })
    })
  })

  describe('isValidShadow', () => {
    it('should handle all valid shadow keys', () => {
      const validShadows: ShadowValue[] = ['none', 'xs', 'sm', 'base', 'md', 'lg', 'xl', '2xl', 'inner']
      validShadows.forEach(shadow => {
        expect(isValidShadow(shadow)).toBe(true)
      })
    })
  })

  describe('isValidBreakpoint', () => {
    it('should handle all valid breakpoint keys', () => {
      const validBreakpoints: BreakpointValue[] = ['xs', 'sm', 'md', 'lg', 'xl', '2xl']
      validBreakpoints.forEach(bp => {
        expect(isValidBreakpoint(bp)).toBe(true)
      })
    })
  })

  describe('isValidFontSize', () => {
    it('should handle all valid font size keys', () => {
      const validSizes: FontSizeValue[] = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl']
      validSizes.forEach(size => {
        expect(isValidFontSize(size)).toBe(true)
      })
    })
  })

  describe('isValidFontWeight', () => {
    it('should handle all valid font weight values', () => {
      const validWeights: FontWeightValue[] = ['light', 'normal', 'medium', 'semibold', 'bold', 'extrabold']
      validWeights.forEach(weight => {
        const value = tokens.fontWeights[weight]
        expect(isValidFontWeight(value)).toBe(true)
      })
    })
  })

  describe('isValidTheme', () => {
    it('should handle all valid theme values', () => {
      expect(isValidTheme('light')).toBe(true)
      expect(isValidTheme('dark')).toBe(true)
    })
  })
})
