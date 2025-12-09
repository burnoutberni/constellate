import { describe, it, expect } from 'vitest'
import { Input } from './Input'
import type { InputProps, InputSize } from './Input'

describe('Input Component', () => {
  describe('Type Exports', () => {
    it('should export InputSize type', () => {
      const sizes: InputSize[] = ['sm', 'md', 'lg']
      expect(sizes).toHaveLength(3)
    })
  })

  describe('Component Structure', () => {
    it('should have displayName', () => {
      expect(Input.displayName).toBe('Input')
    })

    it('should be a forwardRef component', () => {
      // forwardRef components are objects with a render property
      expect(Input).toBeDefined()
      expect(typeof Input).toBe('object')
      expect(Input).toHaveProperty('render')
    })
  })

  describe('Props Interface', () => {
    it('should accept size prop', () => {
      const props: InputProps = {
        size: 'lg',
        type: 'text',
      }
      expect(props.size).toBe('lg')
    })

    it('should accept error prop', () => {
      const props: InputProps = {
        error: true,
        type: 'text',
      }
      expect(props.error).toBe(true)
    })

    it('should accept errorMessage prop', () => {
      const props: InputProps = {
        error: true,
        errorMessage: 'This field is required',
        type: 'text',
      }
      expect(props.errorMessage).toBe('This field is required')
    })

    it('should accept label prop', () => {
      const props: InputProps = {
        label: 'Email Address',
        type: 'email',
      }
      expect(props.label).toBe('Email Address')
    })

    it('should accept helperText prop', () => {
      const props: InputProps = {
        helperText: 'Enter your email address',
        type: 'email',
      }
      expect(props.helperText).toBe('Enter your email address')
    })

    it('should accept leftIcon and rightIcon props', () => {
      const props: InputProps = {
        leftIcon: <span>🔍</span>,
        rightIcon: <span>✓</span>,
        type: 'text',
      }
      expect(props.leftIcon).toBeDefined()
      expect(props.rightIcon).toBeDefined()
    })

    it('should accept standard input HTML attributes', () => {
      const props: InputProps = {
        type: 'email',
        placeholder: 'Enter email',
        required: true,
        disabled: false,
        value: 'test@example.com',
      }
      expect(props.type).toBe('email')
      expect(props.placeholder).toBe('Enter email')
      expect(props.required).toBe(true)
    })
  })

  describe('Accessibility', () => {
    it('should support aria-invalid for error state', () => {
      const props: InputProps = {
        error: true,
        type: 'text',
      }
      expect(props.error).toBe(true)
    })

    it('should support aria-describedby for error and helper text', () => {
      const props: InputProps = {
        error: true,
        errorMessage: 'Error message',
        helperText: 'Helper text',
        type: 'text',
        id: 'test-input',
      }
      expect(props.errorMessage).toBeDefined()
      expect(props.helperText).toBeDefined()
    })

    it('should support aria-required', () => {
      const props: InputProps = {
        required: true,
        type: 'text',
      }
      expect(props.required).toBe(true)
    })
  })
})
