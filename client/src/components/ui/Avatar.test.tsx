import { describe, it, expect } from 'vitest'
import { Avatar, AvatarGroup } from './Avatar'
import type { AvatarProps, AvatarSize, AvatarGroupProps } from './Avatar'

describe('Avatar Component', () => {
  describe('Type Exports', () => {
    it('should export AvatarSize type', () => {
      const sizes: AvatarSize[] = ['xs', 'sm', 'md', 'lg', 'xl']
      expect(sizes).toHaveLength(5)
    })
  })

  describe('Component Structure', () => {
    it('should have displayName', () => {
      expect(Avatar.displayName).toBe('Avatar')
      expect(AvatarGroup.displayName).toBe('AvatarGroup')
    })

    it('should be forwardRef components', () => {
      // forwardRef components are objects with a render property
      expect(Avatar).toBeDefined()
      expect(AvatarGroup).toBeDefined()
      expect(Avatar).toHaveProperty('render')
      expect(AvatarGroup).toHaveProperty('render')
    })
  })

  describe('Avatar Props Interface', () => {
    it('should accept src prop', () => {
      const props: AvatarProps = {
        src: 'https://example.com/avatar.jpg',
      }
      expect(props.src).toBe('https://example.com/avatar.jpg')
    })

    it('should accept alt prop', () => {
      const props: AvatarProps = {
        alt: 'User avatar',
      }
      expect(props.alt).toBe('User avatar')
    })

    it('should accept fallback prop', () => {
      const props: AvatarProps = {
        fallback: 'JD',
      }
      expect(props.fallback).toBe('JD')
    })

    it('should accept size prop', () => {
      const props: AvatarProps = {
        size: 'xl',
      }
      expect(props.size).toBe('xl')
    })

    it('should accept rounded prop', () => {
      const props: AvatarProps = {
        rounded: false,
      }
      expect(props.rounded).toBe(false)
    })

    it('should accept bordered prop', () => {
      const props: AvatarProps = {
        bordered: true,
      }
      expect(props.bordered).toBe(true)
    })

    it('should accept status prop', () => {
      const props: AvatarProps = {
        status: 'online',
      }
      expect(props.status).toBe('online')
    })

    it('should accept all status values', () => {
      const statuses: Array<AvatarProps['status']> = ['online', 'offline', 'away', 'busy']
      expect(statuses).toHaveLength(4)
    })
  })

  describe('AvatarGroup Props Interface', () => {
    it('should accept max prop', () => {
      const props: AvatarGroupProps = {
        max: 5,
        avatars: [],
      }
      expect(props.max).toBe(5)
    })

    it('should accept size prop', () => {
      const props: AvatarGroupProps = {
        size: 'lg',
        avatars: [],
      }
      expect(props.size).toBe('lg')
    })

    it('should accept avatars array', () => {
      const props: AvatarGroupProps = {
        avatars: [
          { src: 'avatar1.jpg', alt: 'User 1' },
          { src: 'avatar2.jpg', alt: 'User 2', fallback: 'U2' },
        ],
      }
      expect(props.avatars).toHaveLength(2)
      expect(props.avatars[0].src).toBe('avatar1.jpg')
      expect(props.avatars[1].fallback).toBe('U2')
    })
  })
})
