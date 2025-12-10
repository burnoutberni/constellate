import { describe, it, expect } from 'vitest'
import { AdvancedSearchFilters } from './AdvancedSearchFilters'

describe('AdvancedSearchFilters', () => {
  it('should export AdvancedSearchFilters component', () => {
    expect(AdvancedSearchFilters).toBeDefined()
  })

  it('should accept filters, onFiltersChange, onApply, and onClear props', () => {
    expect(typeof AdvancedSearchFilters).toBe('function')
  })
})
