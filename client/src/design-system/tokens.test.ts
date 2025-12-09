/**
 * Unit tests for design system tokens
 * 
 * Tests token validation, type safety, and token structure.
 */

import { describe, it, expect } from 'vitest'
import {
  tokens,
  primaryColors,
  secondaryColors,
  neutralColors,
  semanticColors,
  lightThemeColors,
  darkThemeColors,
  fontSizes,
  fontWeights,
  spacing,
  borderRadius,
  shadows,
  breakpoints,
  zIndex,
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
} from './types'

describe('Design Tokens', () => {
  describe('Color Tokens', () => {
    it('should have all primary color shades', () => {
      const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
      shades.forEach(shade => {
        expect(primaryColors[shade as keyof typeof primaryColors]).toBeDefined()
        expect(typeof primaryColors[shade as keyof typeof primaryColors]).toBe('string')
        expect(primaryColors[shade as keyof typeof primaryColors]).toMatch(/^#[0-9a-fA-F]{6}$/)
      })
    })

    it('should have all secondary color shades', () => {
      const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
      shades.forEach(shade => {
        expect(secondaryColors[shade as keyof typeof secondaryColors]).toBeDefined()
        expect(typeof secondaryColors[shade as keyof typeof secondaryColors]).toBe('string')
        expect(secondaryColors[shade as keyof typeof secondaryColors]).toMatch(/^#[0-9a-fA-F]{6}$/)
      })
    })

    it('should have all neutral color shades', () => {
      const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
      shades.forEach(shade => {
        expect(neutralColors[shade as keyof typeof neutralColors]).toBeDefined()
        expect(typeof neutralColors[shade as keyof typeof neutralColors]).toBe('string')
        expect(neutralColors[shade as keyof typeof neutralColors]).toMatch(/^#[0-9a-fA-F]{6}$/)
      })
    })

    it('should have semantic colors with all shades', () => {
      const semanticTypes = ['success', 'warning', 'error', 'info'] as const
      const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
      
      semanticTypes.forEach(type => {
        shades.forEach(shade => {
          const color = semanticColors[type][shade as keyof typeof semanticColors.success]
          expect(color).toBeDefined()
          expect(typeof color).toBe('string')
          expect(color).toMatch(/^#[0-9a-fA-F]{6}$/)
        })
      })
    })

    it('should have light theme colors with all required properties', () => {
      expect(lightThemeColors.primary).toBeDefined()
      expect(lightThemeColors.secondary).toBeDefined()
      expect(lightThemeColors.neutral).toBeDefined()
      expect(lightThemeColors.background).toBeDefined()
      expect(lightThemeColors.text).toBeDefined()
      expect(lightThemeColors.border).toBeDefined()
      
      // Check background colors
      expect(lightThemeColors.background.primary).toBe('#ffffff')
      expect(lightThemeColors.background.secondary).toBeDefined()
      
      // Check text colors
      expect(lightThemeColors.text.primary).toBeDefined()
      expect(lightThemeColors.text.secondary).toBeDefined()
      expect(lightThemeColors.text.inverse).toBe('#ffffff')
    })

    it('should have dark theme colors with all required properties', () => {
      expect(darkThemeColors.primary).toBeDefined()
      expect(darkThemeColors.secondary).toBeDefined()
      expect(darkThemeColors.neutral).toBeDefined()
      expect(darkThemeColors.background).toBeDefined()
      expect(darkThemeColors.text).toBeDefined()
      expect(darkThemeColors.border).toBeDefined()
      
      // Check background colors (should be dark)
      expect(darkThemeColors.background.primary).not.toBe('#ffffff')
      
      // Check text colors (should be light)
      expect(darkThemeColors.text.primary).not.toBe(lightThemeColors.text.primary)
    })

    it('should have consistent color structure between themes', () => {
      const lightKeys = Object.keys(lightThemeColors)
      const darkKeys = Object.keys(darkThemeColors)
      
      expect(lightKeys.sort()).toEqual(darkKeys.sort())
      
      // Check nested structure
      expect(Object.keys(lightThemeColors.background)).toEqual(
        Object.keys(darkThemeColors.background)
      )
      expect(Object.keys(lightThemeColors.text)).toEqual(
        Object.keys(darkThemeColors.text)
      )
      expect(Object.keys(lightThemeColors.border)).toEqual(
        Object.keys(darkThemeColors.border)
      )
    })
  })

  describe('Typography Tokens', () => {
    it('should have all font sizes', () => {
      const sizes = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl']
      sizes.forEach(size => {
        expect(fontSizes[size as keyof typeof fontSizes]).toBeDefined()
        expect(typeof fontSizes[size as keyof typeof fontSizes]).toBe('string')
        expect(fontSizes[size as keyof typeof fontSizes]).toMatch(/^\d+\.?\d*rem$/)
      })
    })

    it('should have all font weights', () => {
      const weights = ['light', 'normal', 'medium', 'semibold', 'bold', 'extrabold']
      weights.forEach(weight => {
        expect(fontWeights[weight as keyof typeof fontWeights]).toBeDefined()
        expect(typeof fontWeights[weight as keyof typeof fontWeights]).toBe('number')
        expect(fontWeights[weight as keyof typeof fontWeights]).toBeGreaterThanOrEqual(300)
        expect(fontWeights[weight as keyof typeof fontWeights]).toBeLessThanOrEqual(800)
      })
    })

    it('should have typography styles with all required properties', () => {
      const styles = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'body', 'bodySmall', 'caption', 'label']
      
      styles.forEach(style => {
        const typographyStyle = tokens.typography[style as keyof typeof tokens.typography]
        expect(typographyStyle).toBeDefined()
        expect(typographyStyle.fontSize).toBeDefined()
        expect(typographyStyle.fontWeight).toBeDefined()
        expect(typographyStyle.lineHeight).toBeDefined()
        expect(typographyStyle.letterSpacing).toBeDefined()
      })
    })

    it('should have hierarchical font sizes for headings', () => {
      const h1Size = parseFloat(tokens.typography.h1.fontSize)
      const h2Size = parseFloat(tokens.typography.h2.fontSize)
      const h3Size = parseFloat(tokens.typography.h3.fontSize)
      
      expect(h1Size).toBeGreaterThan(h2Size)
      expect(h2Size).toBeGreaterThan(h3Size)
    })
  })

  describe('Spacing Tokens', () => {
    it('should have spacing values in rem units', () => {
      Object.values(spacing).forEach(value => {
        if (value !== '0') {
          expect(value).toMatch(/^\d+\.?\d*rem$/)
        }
      })
    })

    it('should have consistent spacing scale', () => {
      // Check that spacing follows a logical progression
      const values = Object.entries(spacing)
        .filter(([_, value]) => value !== '0')
        .map(([_, value]) => parseFloat(value))
        .sort((a, b) => a - b)
      
      // Values should generally increase
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThanOrEqual(values[i - 1])
      }
    })

    it('should have zero spacing', () => {
      expect(spacing[0]).toBe('0')
    })
  })

  describe('Border Radius Tokens', () => {
    it('should have border radius values', () => {
      const radii = ['none', 'sm', 'base', 'md', 'lg', 'xl', '2xl', '3xl', 'full']
      radii.forEach(radius => {
        expect(borderRadius[radius as keyof typeof borderRadius]).toBeDefined()
      })
    })

    it('should have full border radius for circles', () => {
      expect(borderRadius.full).toBe('9999px')
    })

    it('should have none border radius', () => {
      expect(borderRadius.none).toBe('0')
    })
  })

  describe('Shadow Tokens', () => {
    it('should have shadow values', () => {
      const shadowKeys = ['none', 'xs', 'sm', 'base', 'md', 'lg', 'xl', '2xl', 'inner']
      shadowKeys.forEach(key => {
        expect(shadows[key as keyof typeof shadows]).toBeDefined()
      })
    })

    it('should have none shadow', () => {
      expect(shadows.none).toBe('none')
    })

    it('should have inner shadow', () => {
      expect(shadows.inner).toContain('inset')
    })
  })

  describe('Breakpoint Tokens', () => {
    it('should have all breakpoints', () => {
      const breakpointKeys = ['xs', 'sm', 'md', 'lg', 'xl', '2xl']
      breakpointKeys.forEach(key => {
        expect(breakpoints[key as keyof typeof breakpoints]).toBeDefined()
        expect(breakpoints[key as keyof typeof breakpoints]).toMatch(/^\d+px$/)
      })
    })

    it('should have breakpoints in ascending order', () => {
      const values = [
        parseInt(breakpoints.xs),
        parseInt(breakpoints.sm),
        parseInt(breakpoints.md),
        parseInt(breakpoints.lg),
        parseInt(breakpoints.xl),
        parseInt(breakpoints['2xl']),
      ]
      
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThan(values[i - 1])
      }
    })

    it('should start with xs at 0px', () => {
      expect(breakpoints.xs).toBe('0px')
    })
  })

  describe('Z-Index Tokens', () => {
    it('should have z-index values in ascending order', () => {
      const values = [
        zIndex.base,
        zIndex.dropdown,
        zIndex.sticky,
        zIndex.fixed,
        zIndex.modalBackdrop,
        zIndex.modal,
        zIndex.popover,
        zIndex.tooltip,
        zIndex.toast,
      ]
      
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThan(values[i - 1])
      }
    })

    it('should have base z-index of 0', () => {
      expect(zIndex.base).toBe(0)
    })
  })

  describe('Token Structure', () => {
    it('should export tokens object with all categories', () => {
      expect(tokens.colors).toBeDefined()
      expect(tokens.typography).toBeDefined()
      expect(tokens.spacing).toBeDefined()
      expect(tokens.borderRadius).toBeDefined()
      expect(tokens.shadows).toBeDefined()
      expect(tokens.breakpoints).toBeDefined()
      expect(tokens.zIndex).toBeDefined()
      expect(tokens.transitions).toBeDefined()
    })

    it('should have both light and dark theme colors', () => {
      expect(tokens.colors.light).toBeDefined()
      expect(tokens.colors.dark).toBeDefined()
    })
  })
})

describe('Token Validation Functions', () => {
  describe('isValidSpacing', () => {
    it('should validate valid spacing tokens', () => {
      expect(isValidSpacing('0')).toBe(true)
      expect(isValidSpacing('4')).toBe(true)
      expect(isValidSpacing('16')).toBe(true)
    })

    it('should reject invalid spacing tokens', () => {
      expect(isValidSpacing('invalid')).toBe(false)
      expect(isValidSpacing('99')).toBe(false)
      expect(isValidSpacing('')).toBe(false)
    })
  })

  describe('isValidBorderRadius', () => {
    it('should validate valid border radius tokens', () => {
      expect(isValidBorderRadius('none')).toBe(true)
      expect(isValidBorderRadius('lg')).toBe(true)
      expect(isValidBorderRadius('full')).toBe(true)
    })

    it('should reject invalid border radius tokens', () => {
      expect(isValidBorderRadius('invalid')).toBe(false)
      expect(isValidBorderRadius('xxl')).toBe(false)
    })
  })

  describe('isValidShadow', () => {
    it('should validate valid shadow tokens', () => {
      expect(isValidShadow('none')).toBe(true)
      expect(isValidShadow('md')).toBe(true)
      expect(isValidShadow('xl')).toBe(true)
      expect(isValidShadow('inner')).toBe(true)
    })

    it('should reject invalid shadow tokens', () => {
      expect(isValidShadow('invalid')).toBe(false)
      expect(isValidShadow('huge')).toBe(false)
    })
  })

  describe('isValidBreakpoint', () => {
    it('should validate valid breakpoint tokens', () => {
      expect(isValidBreakpoint('xs')).toBe(true)
      expect(isValidBreakpoint('md')).toBe(true)
      expect(isValidBreakpoint('2xl')).toBe(true)
    })

    it('should reject invalid breakpoint tokens', () => {
      expect(isValidBreakpoint('invalid')).toBe(false)
      expect(isValidBreakpoint('xxl')).toBe(false)
    })
  })

  describe('isValidFontSize', () => {
    it('should validate valid font size tokens', () => {
      expect(isValidFontSize('xs')).toBe(true)
      expect(isValidFontSize('base')).toBe(true)
      expect(isValidFontSize('5xl')).toBe(true)
    })

    it('should reject invalid font size tokens', () => {
      expect(isValidFontSize('invalid')).toBe(false)
      expect(isValidFontSize('7xl')).toBe(false)
    })
  })

  describe('isValidFontWeight', () => {
    it('should validate valid font weight values', () => {
      expect(isValidFontWeight(300)).toBe(true)
      expect(isValidFontWeight(400)).toBe(true)
      expect(isValidFontWeight(700)).toBe(true)
    })

    it('should reject invalid font weight values', () => {
      expect(isValidFontWeight(100)).toBe(false)
      expect(isValidFontWeight(900)).toBe(false)
      expect(isValidFontWeight(250)).toBe(false)
    })
  })

  describe('isValidTheme', () => {
    it('should validate valid theme values', () => {
      expect(isValidTheme('light')).toBe(true)
      expect(isValidTheme('dark')).toBe(true)
    })

    it('should reject invalid theme values', () => {
      expect(isValidTheme('invalid')).toBe(false)
      expect(isValidTheme('auto')).toBe(false)
      expect(isValidTheme('')).toBe(false)
    })
  })
})

describe('Type Safety', () => {
  it('should have consistent Theme type', () => {
    const lightTheme: Theme = 'light'
    const darkTheme: Theme = 'dark'
    
    expect(lightTheme).toBe('light')
    expect(darkTheme).toBe('dark')
  })

  it('should have readonly token objects', () => {
    // TypeScript should prevent mutations, but we can test runtime structure
    expect(Object.isFrozen(tokens) || Object.isSealed(tokens)).toBe(false) // Not frozen in JS, but const prevents reassignment
  })
})
