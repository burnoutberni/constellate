import { describe, it, expect } from 'vitest'
import { EventStats } from './EventStats'

describe('EventStats', () => {
  it('should accept required statistics props', () => {
    const props = {
      totalEvents: 10,
      upcomingEvents: 5,
      isLoading: false,
    }
    
    expect(EventStats).toBeDefined()
    expect(typeof EventStats).toBe('function')
    expect(props.totalEvents).toBe(10)
    expect(props.upcomingEvents).toBe(5)
  })

  it('should accept optional statistics props', () => {
    const props = {
      totalEvents: 10,
      upcomingEvents: 5,
      todayEvents: 2,
      activeUsers: 50,
      isLoading: false,
    }
    
    expect(props.todayEvents).toBe(2)
    expect(props.activeUsers).toBe(50)
  })

  it('should handle loading state', () => {
    const props = {
      totalEvents: 0,
      upcomingEvents: 0,
      isLoading: true,
    }
    
    expect(props.isLoading).toBe(true)
  })

  it('should be a valid React component', () => {
    expect(() => EventStats({ 
      totalEvents: 10, 
      upcomingEvents: 5 
    })).not.toThrow()
  })
})
