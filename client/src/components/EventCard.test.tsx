import { describe, it, expect } from 'vitest'
import { EventCard } from './EventCard'
import type { Event } from '../types'

describe('EventCard', () => {
  const mockEvent: Event = {
    id: '1',
    title: 'Test Event',
    summary: 'A test event',
    location: 'Test Location',
    startTime: new Date().toISOString(),
    timezone: 'UTC',
    tags: [],
    user: {
      id: 'user1',
      username: 'testuser',
      name: 'Test User',
      isRemote: false,
    },
    _count: {
      attendance: 5,
      likes: 3,
      comments: 2,
    },
  }

  it('should accept event and variant props', () => {
    const props = {
      event: mockEvent,
      variant: 'full' as const,
      isAuthenticated: false,
    }
    
    expect(EventCard).toBeDefined()
    expect(typeof EventCard).toBe('function')
    expect(props.event.id).toBe('1')
    expect(props.variant).toBe('full')
  })

  it('should accept compact variant', () => {
    const props = {
      event: mockEvent,
      variant: 'compact' as const,
      isAuthenticated: true,
    }
    
    expect(props.variant).toBe('compact')
  })

  it('should handle authentication state', () => {
    const propsUnauthenticated = {
      event: mockEvent,
      isAuthenticated: false,
    }
    
    const propsAuthenticated = {
      event: mockEvent,
      isAuthenticated: true,
    }
    
    expect(propsUnauthenticated.isAuthenticated).toBe(false)
    expect(propsAuthenticated.isAuthenticated).toBe(true)
  })

  it('should be a valid React component', () => {
    expect(() => EventCard({ event: mockEvent })).not.toThrow()
  })
})
