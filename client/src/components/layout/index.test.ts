/**
 * Tests for layout index.ts exports
 * 
 * Ensures all layout component exports are available.
 */

import { describe, it, expect } from 'vitest'
import * as Layout from './index'
import type { ContainerProps, ContainerSize } from './index'
import type { GridProps, GridCols, GridGap } from './index'
import type { StackProps, StackDirection, StackAlign, StackJustify, StackGap } from './index'
import type { SectionProps, SectionPadding, SectionVariant } from './index'
import type { PageLayoutProps } from './index'

describe('Layout Index Exports', () => {
  describe('Component Exports', () => {
    it('should export Container component', () => {
      expect(Layout.Container).toBeDefined()
      expect(typeof Layout.Container).toBe('object')
    })

    it('should export Grid component', () => {
      expect(Layout.Grid).toBeDefined()
      expect(typeof Layout.Grid).toBe('object')
    })

    it('should export Stack component', () => {
      expect(Layout.Stack).toBeDefined()
      expect(typeof Layout.Stack).toBe('object')
    })

    it('should export Section component', () => {
      expect(Layout.Section).toBeDefined()
      expect(typeof Layout.Section).toBe('object')
    })

    it('should export PageLayout component', () => {
      expect(Layout.PageLayout).toBeDefined()
      expect(typeof Layout.PageLayout).toBe('object')
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

  describe('Type Exports Verification', () => {
    it('should export Container types from index', () => {
      // Verify types are actually exported from the index module
      expect(Layout.Container).toBeDefined()
      // Type check: ensure ContainerProps and ContainerSize are available from index
      const _testProps: ContainerProps = { children: 'test' }
      const _testSize: ContainerSize = 'lg'
      expect(_testProps).toBeDefined()
      expect(_testSize).toBeDefined()
    })

    it('should export Grid types from index', () => {
      expect(Layout.Grid).toBeDefined()
      const _testProps: GridProps = { children: 'test' }
      const _testCols: GridCols = 2
      const _testGap: GridGap = 'md'
      expect(_testProps).toBeDefined()
      expect(_testCols).toBeDefined()
      expect(_testGap).toBeDefined()
    })

    it('should export Stack types from index', () => {
      expect(Layout.Stack).toBeDefined()
      const _testProps: StackProps = { children: 'test' }
      const _testDirection: StackDirection = 'row'
      const _testAlign: StackAlign = 'center'
      const _testJustify: StackJustify = 'between'
      const _testGap: StackGap = 'md'
      expect(_testProps).toBeDefined()
      expect(_testDirection).toBeDefined()
      expect(_testAlign).toBeDefined()
      expect(_testJustify).toBeDefined()
      expect(_testGap).toBeDefined()
    })

    it('should export Section types from index', () => {
      expect(Layout.Section).toBeDefined()
      const _testProps: SectionProps = { children: 'test' }
      const _testPadding: SectionPadding = 'lg'
      const _testVariant: SectionVariant = 'default'
      expect(_testProps).toBeDefined()
      expect(_testPadding).toBeDefined()
      expect(_testVariant).toBeDefined()
    })

    it('should export PageLayout types from index', () => {
      expect(Layout.PageLayout).toBeDefined()
      const _testProps: PageLayoutProps = { children: 'test' }
      expect(_testProps).toBeDefined()
    })
  })
})
