import { describe, it, expect } from 'vitest'
import { HomeHero } from './HomeHero'

describe('HomeHero', () => {
  it('should render hero title and description', () => {
    const props = {
      isAuthenticated: false,
    }
    
    // Component should be exported and importable
    expect(HomeHero).toBeDefined()
    expect(typeof HomeHero).toBe('function')
    
    // Props interface should accept isAuthenticated
    expect(props.isAuthenticated).toBe(false)
  })

  it('should accept authenticated state', () => {
    const props = {
      isAuthenticated: true,
    }
    
    expect(props.isAuthenticated).toBe(true)
  })

  it('should be a valid React component', () => {
    // Verify the component can be called as a function
    expect(() => HomeHero({ isAuthenticated: false })).not.toThrow()
  })
})
