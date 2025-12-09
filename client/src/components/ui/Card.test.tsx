import { describe, it, expect } from 'vitest'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from './Card'
import type {
  CardProps,
  CardVariant,
  CardHeaderProps,
  CardTitleProps,
  CardContentProps,
  CardFooterProps,
} from './Card'

describe('Card Component', () => {
  describe('Type Exports', () => {
    it('should export CardVariant type', () => {
      const variants: CardVariant[] = ['default', 'outlined', 'elevated', 'flat']
      expect(variants).toHaveLength(4)
    })
  })

  describe('Component Structure', () => {
    it('should have displayName', () => {
      expect(Card.displayName).toBe('Card')
      expect(CardHeader.displayName).toBe('CardHeader')
      expect(CardTitle.displayName).toBe('CardTitle')
      expect(CardContent.displayName).toBe('CardContent')
      expect(CardFooter.displayName).toBe('CardFooter')
    })

    it('should be forwardRef components', () => {
      // forwardRef components are objects with a render property
      expect(Card).toBeDefined()
      expect(CardHeader).toBeDefined()
      expect(CardTitle).toBeDefined()
      expect(CardContent).toBeDefined()
      expect(CardFooter).toBeDefined()
      expect(Card).toHaveProperty('render')
      expect(CardHeader).toHaveProperty('render')
      expect(CardTitle).toHaveProperty('render')
      expect(CardContent).toHaveProperty('render')
      expect(CardFooter).toHaveProperty('render')
    })
  })

  describe('Card Props Interface', () => {
    it('should accept variant prop', () => {
      const props: CardProps = {
        variant: 'elevated',
        children: 'Test',
      }
      expect(props.variant).toBe('elevated')
    })

    it('should accept interactive prop', () => {
      const props: CardProps = {
        interactive: true,
        children: 'Test',
      }
      expect(props.interactive).toBe(true)
    })

    it('should accept padding prop', () => {
      const props: CardProps = {
        padding: 'lg',
        children: 'Test',
      }
      expect(props.padding).toBe('lg')
    })
  })

  describe('Card Subcomponents', () => {
    it('should accept CardHeader props', () => {
      const props: CardHeaderProps = {
        children: 'Header',
      }
      expect(props.children).toBe('Header')
    })

    it('should accept CardTitle props with as prop', () => {
      const props: CardTitleProps = {
        as: 'h2',
        children: 'Title',
      }
      expect(props.as).toBe('h2')
      expect(props.children).toBe('Title')
    })

    it('should accept CardContent props', () => {
      const props: CardContentProps = {
        children: 'Content',
      }
      expect(props.children).toBe('Content')
    })

    it('should accept CardFooter props', () => {
      const props: CardFooterProps = {
        children: 'Footer',
      }
      expect(props.children).toBe('Footer')
    })
  })
})
