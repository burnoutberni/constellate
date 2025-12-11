import { useEffect, useRef, useState } from 'react'

export interface LocationSuggestion {
    id: string
    label: string
    latitude: number
    longitude: number
    hint?: string | null
}

interface SuggestionResponse {
    results: LocationSuggestion[]
}

// Keep aligned with backend MIN_LOCATION_QUERY_LENGTH
export const MIN_QUERY_LENGTH = 3
const DEBOUNCE_MS = 300

export function useLocationSuggestions(query: string, enabled: boolean = true) {
    const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const abortRef = useRef<AbortController | null>(null)

    useEffect(() => {
        if (!enabled) {
            setSuggestions([])
            setLoading(false)
            setError(null)
            return
        }

        const trimmed = query.trim()
        if (trimmed.length < MIN_QUERY_LENGTH) {
            setSuggestions([])
            setLoading(false)
            setError(null)
            abortRef.current?.abort()
            abortRef.current = null
            return
        }

        setLoading(true)
        setError(null)

        const timer = window.setTimeout(async () => {
            abortRef.current?.abort()
            const controller = new AbortController()
            abortRef.current = controller

            try {
                const response = await fetch(`/api/location/search?q=${encodeURIComponent(trimmed)}&limit=5`, {
                    signal: controller.signal,
                    credentials: 'include',
                })

                if (!response.ok) {
                    const statusCode = response.status
                    const isClientError = statusCode >= 400 && statusCode < 500
                    const isServerError = statusCode >= 500

                    let errorMessage: string
                    if (isClientError) {
                        errorMessage = `Location lookup failed (${statusCode}): Please check your search query.`
                    } else if (isServerError) {
                        errorMessage = `Location lookup failed (${statusCode}): Service temporarily unavailable.`
                    } else {
                        errorMessage = `Location lookup failed (${statusCode})`
                    }
                    throw new Error(errorMessage)
                }

                const body = await response.json() as SuggestionResponse
                setSuggestions(Array.isArray(body.results) ? body.results : [])
            } catch (err) {
                if ((err as Error).name === 'AbortError') {
                    // Don't update loading state if request was aborted
                    // A new request may be starting, so let it manage its own loading state
                    return
                }
                console.error('Location suggestion error:', err)
                setError('Unable to fetch location suggestions')
                setSuggestions([])
            } finally {
                // Only set loading to false if the request wasn't aborted
                // Check if controller is still the current one (not aborted)
                if (abortRef.current === controller && !controller.signal.aborted) {
                    setLoading(false)
                }
            }
        }, DEBOUNCE_MS)

        return () => {
            window.clearTimeout(timer)
            abortRef.current?.abort()
            abortRef.current = null
        }
    }, [query, enabled])

    return {
        suggestions,
        loading,
        error,
    }
}
