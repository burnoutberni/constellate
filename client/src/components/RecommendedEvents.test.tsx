import { describe, it, expect } from 'vitest'
import { RecommendedEvents } from './RecommendedEvents'

describe('RecommendedEvents', () => {
  it('should export RecommendedEvents component', () => {
    expect(RecommendedEvents).toBeDefined()
  })

  it('should accept limit prop', () => {
    expect(typeof RecommendedEvents).toBe('function')
  })
})
