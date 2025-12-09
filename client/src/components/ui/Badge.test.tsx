import { describe, it, expect } from 'vitest'
import { Badge } from './Badge'
import type { BadgeProps, BadgeVariant, BadgeSize } from './Badge'

describe('Badge Component', () => {
  describe('Type Exports', () => {
    it('should export BadgeVariant type', () => {
      const variants: BadgeVariant[] = [
        'default',
        'primary',
        'secondary',
        'success',
        'warning',
        'error',
        'info',
      ]
      expect(variants).toHaveLength(7)
    })

    it('should export BadgeSize type', () => {
      const sizes: BadgeSize[] = ['sm', 'md', 'lg']
      expect(sizes).toHaveLength(3)
    })
  })

  describe('Component Structure', () => {
    it('should have displayName', () => {
      expect(Badge.displayName).toBe('Badge')
    })

    it('should be a forwardRef component', () => {
      // forwardRef components are objects with a render property
      expect(Badge).toBeDefined()
      expect(typeof Badge).toBe('object')
      expect(Badge).toHaveProperty('render')
    })
  })

  describe('Props Interface', () => {
    it('should accept variant prop', () => {
      const props: BadgeProps = {
        variant: 'success',
        children: 'Success',
      }
      expect(props.variant).toBe('success')
    })

    it('should accept size prop', () => {
      const props: BadgeProps = {
        size: 'lg',
        children: 'Badge',
      }
      expect(props.size).toBe('lg')
    })

    it('should accept rounded prop', () => {
      const props: BadgeProps = {
        rounded: false,
        children: 'Badge',
      }
      expect(props.rounded).toBe(false)
    })

    it('should accept standard HTML attributes', () => {
      const props: BadgeProps = {
        children: 'Badge',
        'aria-label': 'Status badge',
        className: 'custom-class',
      }
      expect(props['aria-label']).toBe('Status badge')
      expect(props.className).toBe('custom-class')
    })
  })
})
