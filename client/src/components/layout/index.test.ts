/**
 * Tests for layout index.ts exports
 * 
 * Ensures all layout component exports are available.
 */

import { describe, it, expect } from 'vitest'
import * as Layout from './index'
import { Container, type ContainerProps, type ContainerSize } from './Container'
import { Grid, type GridProps, type GridCols, type GridGap } from './Grid'
import { Stack, type StackProps, type StackDirection, type StackAlign, type StackJustify, type StackGap } from './Stack'
import { Section, type SectionProps, type SectionPadding, type SectionVariant } from './Section'
import { PageLayout, type PageLayoutProps } from './PageLayout'

describe('Layout Index Exports', () => {
  describe('Component Exports', () => {
    it('should export Container component', () => {
      expect(Layout.Container).toBe(Container)
    })

    it('should export Grid component', () => {
      expect(Layout.Grid).toBe(Grid)
    })

    it('should export Stack component', () => {
      expect(Layout.Stack).toBe(Stack)
    })

    it('should export Section component', () => {
      expect(Layout.Section).toBe(Section)
    })

    it('should export PageLayout component', () => {
      expect(Layout.PageLayout).toBe(PageLayout)
    })
  })

  describe('Type Exports', () => {
    it('should export Container types', () => {
      const props: ContainerProps = { children: 'test' }
      const size: ContainerSize = 'lg'
      expect(props).toBeDefined()
      expect(size).toBe('lg')
    })

    it('should export Grid types', () => {
      const props: GridProps = { children: 'test' }
      const cols: GridCols = 2
      const gap: GridGap = 'md'
      expect(props).toBeDefined()
      expect(cols).toBe(2)
      expect(gap).toBe('md')
    })

    it('should export Stack types', () => {
      const props: StackProps = { children: 'test' }
      const direction: StackDirection = 'row'
      const align: StackAlign = 'center'
      const justify: StackJustify = 'between'
      const gap: StackGap = 'md'
      expect(props).toBeDefined()
      expect(direction).toBe('row')
      expect(align).toBe('center')
      expect(justify).toBe('between')
      expect(gap).toBe('md')
    })

    it('should export Section types', () => {
      const props: SectionProps = { children: 'test' }
      const padding: SectionPadding = 'lg'
      const variant: SectionVariant = 'default'
      expect(props).toBeDefined()
      expect(padding).toBe('lg')
      expect(variant).toBe('default')
    })

    it('should export PageLayout types', () => {
      const props: PageLayoutProps = { children: 'test' }
      expect(props).toBeDefined()
    })
  })

  describe('Type Completeness', () => {
    it('should have all ContainerSize values', () => {
      const sizes: ContainerSize[] = ['sm', 'md', 'lg', 'xl', 'full']
      sizes.forEach(size => {
        expect(typeof size).toBe('string')
      })
    })

    it('should have all GridCols values', () => {
      const cols: GridCols[] = [1, 2, 3, 4, 5, 6, 12]
      cols.forEach(col => {
        expect(typeof col).toBe('number')
      })
    })

    it('should have all GridGap values', () => {
      const gaps: GridGap[] = ['none', 'sm', 'md', 'lg', 'xl']
      gaps.forEach(gap => {
        expect(typeof gap).toBe('string')
      })
    })

    it('should have all StackDirection values', () => {
      const directions: StackDirection[] = ['row', 'column']
      directions.forEach(direction => {
        expect(typeof direction).toBe('string')
      })
    })

    it('should have all StackAlign values', () => {
      const aligns: StackAlign[] = ['start', 'center', 'end', 'stretch']
      aligns.forEach(align => {
        expect(typeof align).toBe('string')
      })
    })

    it('should have all StackJustify values', () => {
      const justifies: StackJustify[] = ['start', 'center', 'end', 'between', 'around', 'evenly']
      justifies.forEach(justify => {
        expect(typeof justify).toBe('string')
      })
    })

    it('should have all StackGap values', () => {
      const gaps: StackGap[] = ['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl']
      gaps.forEach(gap => {
        expect(typeof gap).toBe('string')
      })
    })

    it('should have all SectionPadding values', () => {
      const paddings: SectionPadding[] = ['none', 'sm', 'md', 'lg', 'xl', '2xl']
      paddings.forEach(padding => {
        expect(typeof padding).toBe('string')
      })
    })

    it('should have all SectionVariant values', () => {
      const variants: SectionVariant[] = ['default', 'muted', 'accent']
      variants.forEach(variant => {
        expect(typeof variant).toBe('string')
      })
    })
  })
})
