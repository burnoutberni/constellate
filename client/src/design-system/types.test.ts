/**
 * Unit tests for design system types and validation functions
 * 
 * Tests type definitions and validation function edge cases.
 */

import { describe, it, expect } from 'vitest'
import {
  type ThemeColorKeys,
  type ColorShadeKeys,
} from './types'
import { tokens } from './tokens'

describe('Type Definitions', () => {
  describe('Utility Types', () => {
    it('should extract color values correctly from tokens', () => {
      // This tests the GetColorValue type indirectly by verifying runtime token access
      const primary500 = tokens.colors.light.primary[500]
      expect(primary500).toBe('#0ea5e9')
    })

    it('should extract theme color keys that match actual token structure', () => {
      // Verify that ThemeColorKeys matches the actual keys in tokens
      const keys: ThemeColorKeys[] = ['primary', 'secondary', 'neutral', 'background', 'text', 'border']
      keys.forEach(key => {
        expect(tokens.colors.light[key]).toBeDefined()
      })
      expect(keys.length).toBeGreaterThan(0)
    })

    it('should extract color shade keys that match actual color scales', () => {
      // Verify that ColorShadeKeys matches actual shade keys in color scales
      const shades: ColorShadeKeys<'primary'>[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
      shades.forEach(shade => {
        expect(tokens.colors.light.primary[shade]).toBeDefined()
      })
      expect(shades.length).toBe(11)
    })
  })
})

