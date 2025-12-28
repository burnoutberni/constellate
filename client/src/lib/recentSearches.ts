// Helper functions for managing recent searches in localStorage
import { logger } from './logger'

const RECENT_SEARCHES_KEY = 'constellate_recent_searches'
const MAX_RECENT_SEARCHES = 5

function getRecentSearches(): string[] {
	try {
		const stored = localStorage.getItem(RECENT_SEARCHES_KEY)
		return stored ? (JSON.parse(stored) as string[]) : []
	} catch {
		return []
	}
}

export function addRecentSearch(query: string): void {
	if (!query.trim()) {
		return
	}

	try {
		const searches = getRecentSearches()
		const filtered = searches.filter((s) => s !== query)
		const updated = [query, ...filtered].slice(0, MAX_RECENT_SEARCHES)
		localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
	} catch (error) {
		logger.error('Failed to save recent search:', error)
	}
}

export function clearRecentSearches(): void {
	try {
		localStorage.removeItem(RECENT_SEARCHES_KEY)
	} catch (error) {
		logger.error('Failed to clear recent searches:', error)
	}
}

export function getRecentSearchesList(): string[] {
	return getRecentSearches()
}
