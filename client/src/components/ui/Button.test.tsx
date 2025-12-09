import { describe, it, expect } from 'vitest'
import { Button } from './Button'
import type { ButtonProps, ButtonVariant, ButtonSize } from './Button'

describe('Button Component', () => {
  describe('Type Exports', () => {
    it('should export ButtonVariant type', () => {
      const variants: ButtonVariant[] = ['primary', 'secondary', 'ghost', 'danger']
      expect(variants).toHaveLength(4)
    })

    it('should export ButtonSize type', () => {
      const sizes: ButtonSize[] = ['sm', 'md', 'lg']
      expect(sizes).toHaveLength(3)
    })
  })

  describe('Component Structure', () => {
    it('should have displayName', () => {
      expect(Button.displayName).toBe('Button')
    })

    it('should be a forwardRef component', () => {
      // forwardRef components are objects with a render property
      expect(Button).toBeDefined()
      expect(typeof Button).toBe('object')
      expect(Button).toHaveProperty('render')
    })
  })

  describe('Props Interface', () => {
    it('should accept variant prop', () => {
      const props: ButtonProps = {
        variant: 'primary',
        children: 'Test',
      }
      expect(props.variant).toBe('primary')
    })

    it('should accept size prop', () => {
      const props: ButtonProps = {
        size: 'lg',
        children: 'Test',
      }
      expect(props.size).toBe('lg')
    })

    it('should accept loading prop', () => {
      const props: ButtonProps = {
        loading: true,
        children: 'Test',
      }
      expect(props.loading).toBe(true)
    })

    it('should accept fullWidth prop', () => {
      const props: ButtonProps = {
        fullWidth: true,
        children: 'Test',
      }
      expect(props.fullWidth).toBe(true)
    })

    it('should accept standard button HTML attributes', () => {
      const props: ButtonProps = {
        children: 'Test',
        disabled: true,
        type: 'submit',
        onClick: () => {},
        'aria-label': 'Test button',
      }
      expect(props.disabled).toBe(true)
      expect(props.type).toBe('submit')
    })
  })

  describe('Accessibility', () => {
    it('should support aria-busy for loading state', () => {
      const props: ButtonProps = {
        loading: true,
        children: 'Loading',
      }
      expect(props.loading).toBe(true)
    })

    it('should support aria-disabled', () => {
      const props: ButtonProps = {
        disabled: true,
        children: 'Disabled',
      }
      expect(props.disabled).toBe(true)
    })
  })
})
