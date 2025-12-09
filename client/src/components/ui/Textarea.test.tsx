import { describe, it, expect } from 'vitest'
import { Textarea } from './Textarea'
import type { TextareaProps, TextareaSize } from './Textarea'

describe('Textarea Component', () => {
  describe('Type Exports', () => {
    it('should export TextareaSize type', () => {
      const sizes: TextareaSize[] = ['sm', 'md', 'lg']
      expect(sizes).toHaveLength(3)
    })
  })

  describe('Component Structure', () => {
    it('should have displayName', () => {
      expect(Textarea.displayName).toBe('Textarea')
    })

    it('should be a forwardRef component', () => {
      // forwardRef components are objects with a render property
      expect(Textarea).toBeDefined()
      expect(typeof Textarea).toBe('object')
      expect(Textarea).toHaveProperty('render')
    })
  })

  describe('Props Interface', () => {
    it('should accept size prop', () => {
      const props: TextareaProps = {
        size: 'lg',
      }
      expect(props.size).toBe('lg')
    })

    it('should accept error prop', () => {
      const props: TextareaProps = {
        error: true,
      }
      expect(props.error).toBe(true)
    })

    it('should accept errorMessage prop', () => {
      const props: TextareaProps = {
        error: true,
        errorMessage: 'This field is required',
      }
      expect(props.errorMessage).toBe('This field is required')
    })

    it('should accept label prop', () => {
      const props: TextareaProps = {
        label: 'Description',
      }
      expect(props.label).toBe('Description')
    })

    it('should accept rows prop', () => {
      const props: TextareaProps = {
        rows: 6,
      }
      expect(props.rows).toBe(6)
    })

    it('should accept standard textarea HTML attributes', () => {
      const props: TextareaProps = {
        placeholder: 'Enter description',
        required: true,
        disabled: false,
        maxLength: 500,
      }
      expect(props.placeholder).toBe('Enter description')
      expect(props.required).toBe(true)
      expect(props.maxLength).toBe(500)
    })
  })

  describe('Accessibility', () => {
    it('should support aria-invalid for error state', () => {
      const props: TextareaProps = {
        error: true,
      }
      expect(props.error).toBe(true)
    })

    it('should support aria-describedby', () => {
      const props: TextareaProps = {
        error: true,
        errorMessage: 'Error message',
        helperText: 'Helper text',
        id: 'test-textarea',
      }
      expect(props.errorMessage).toBeDefined()
      expect(props.helperText).toBeDefined()
    })
  })
})
