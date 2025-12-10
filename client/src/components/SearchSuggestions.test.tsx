import { describe, it, expect } from 'vitest'
import { SearchSuggestions, addRecentSearch, clearRecentSearches } from './SearchSuggestions'

describe('SearchSuggestions', () => {
  it('should export SearchSuggestions component', () => {
    expect(SearchSuggestions).toBeDefined()
  })

  it('should export utility functions', () => {
    expect(addRecentSearch).toBeDefined()
    expect(clearRecentSearches).toBeDefined()
  })

  it('addRecentSearch should be callable', () => {
    expect(() => addRecentSearch('test')).not.toThrow()
  })

  it('clearRecentSearches should be callable', () => {
    expect(() => clearRecentSearches()).not.toThrow()
  })
})
