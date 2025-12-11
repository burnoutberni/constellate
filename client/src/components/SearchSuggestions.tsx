import { useEffect, useState } from 'react'
import { Badge } from './ui'
import { getRecentSearchesList } from '../lib/recentSearches'

interface SearchSuggestionsProps {
  query: string
  onSelect: (suggestion: string) => void
  className?: string
}

interface Suggestion {
  type: 'tag' | 'location' | 'recent'
  value: string
  count?: number
}

/**
 * SearchSuggestions component provides autocomplete suggestions for search.
 * Shows popular tags, locations, and recent searches.
 */
export function SearchSuggestions({ query, onSelect, className }: SearchSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([])
      return
    }

    setIsLoading(true)
    const timer = setTimeout(async () => {
      try {
        // Fetch tag suggestions from the backend
        const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}`, {
          credentials: 'include',
        })

        if (response.ok) {
          const data = await response.json()
          const tagSuggestions: Suggestion[] = (data.tags || []).map((tag: { tag: string; count: number }) => ({
            type: 'tag' as const,
            value: tag.tag,
            count: tag.count,
          }))

          const locationSuggestions: Suggestion[] = (data.locations || []).map((location: string) => ({
            type: 'location' as const,
            value: location,
          }))

          setSuggestions([...tagSuggestions, ...locationSuggestions])
        } else {
          // Fallback to showing recent searches if API fails
          const recentSearches = getRecentSearchesList().filter((s) =>
            s.toLowerCase().includes(query.toLowerCase()),
          )
          setSuggestions(recentSearches.map((s) => ({ type: 'recent' as const, value: s })))
        }
      } catch (error) {
        console.error('Failed to fetch suggestions:', error)
        // Fallback to recent searches
        const recentSearches = getRecentSearchesList().filter((s) =>
          s.toLowerCase().includes(query.toLowerCase()),
        )
        setSuggestions(recentSearches.map((s) => ({ type: 'recent' as const, value: s })))
      } finally {
        setIsLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  if (!query.trim() || query.length < 2) {
    // Show recent searches when no query
    const recentSearches = getRecentSearchesList()
    if (recentSearches.length === 0) {
return null
}

    return (
      <div className={className}>
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 space-y-2">
          <p className="text-xs text-gray-500 font-medium px-2">Recent Searches</p>
          {recentSearches.map((search) => (
            <button
              key={`recent-${search}`}
              onClick={() => onSelect(search)}
              className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <span className="text-gray-400">🕐</span>
              <span className="text-sm text-gray-900">{search}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className={className}>
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
          </div>
        </div>
      </div>
    )
  }

  if (suggestions.length === 0) {
    return null
  }

  return (
    <div className={className}>
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 space-y-2">
        {suggestions.map((suggestion) => (
          <button
            key={`${suggestion.type}-${suggestion.value}`}
            onClick={() => onSelect(suggestion.value)}
            className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 transition-colors flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {suggestion.type === 'tag' && <span className="text-gray-400 shrink-0">🏷️</span>}
              {suggestion.type === 'location' && <span className="text-gray-400 shrink-0">📍</span>}
              {suggestion.type === 'recent' && <span className="text-gray-400 shrink-0">🕐</span>}
              <span className="text-sm text-gray-900 truncate">
                {suggestion.type === 'tag' ? `#${suggestion.value}` : suggestion.value}
              </span>
            </div>
            {suggestion.count && suggestion.count > 0 && (
              <Badge variant="default" size="sm">
                {suggestion.count}
              </Badge>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
