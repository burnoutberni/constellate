import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { queryKeys } from './keys'
import type { Event } from '../../types'

export interface EventSearchFilters extends Record<string, string | undefined> {
    q?: string
    location?: string
    startDate?: string
    endDate?: string
    dateRange?: string
    status?: string
    mode?: string
    username?: string
    tags?: string
    categories?: string
}

export interface EventSearchResponse {
    events: Event[]
    pagination: {
        page: number
        limit: number
        total: number
        pages: number
    }
    filters: Record<string, string | undefined>
}

const buildQueryString = (filters: EventSearchFilters, page: number, limit: number) => {
    const params = new URLSearchParams()

    Object.entries(filters).forEach(([key, value]) => {
        if (typeof value === 'string' && value.trim().length > 0) {
            params.set(key, value)
        }
    })

    params.set('page', String(page))
    params.set('limit', String(limit))

    return params.toString()
}

export function useEventSearch(filters: EventSearchFilters, page = 1, limit = 20) {
    return useQuery<EventSearchResponse>({
        queryKey: queryKeys.search.events({ filters, page, limit }),
        queryFn: async () => {
            const query = buildQueryString(filters, page, limit)
            const response = await fetch(`/api/search?${query}`, {
                credentials: 'include',
            })

            if (!response.ok) {
                const statusCode = response.status
                let errorMessage = 'Failed to search events'
                try {
                    const errorBody = await response.json() as { error?: string }
                    if (errorBody.error) {
                        errorMessage = `${errorMessage}: ${errorBody.error}`
                    }
                } catch {
                    // If response body isn't JSON, use status-based message
                    if (statusCode >= 400 && statusCode < 500) {
                        errorMessage = `${errorMessage} (${statusCode}): Invalid search parameters.`
                    } else if (statusCode >= 500) {
                        errorMessage = `${errorMessage} (${statusCode}): Server error. Please try again later.`
                    }
                }
                throw new Error(errorMessage)
            }

            return response.json()
        },
        placeholderData: keepPreviousData,
    })
}

interface NearbyEventsResponse {
    events: Array<Event & { distanceKm?: number }>
    origin: {
        latitude: number
        longitude: number
        radiusKm: number
    }
}

// Default radius for nearby event searches (matches backend default in src/search.ts)
const DEFAULT_NEARBY_RADIUS_KM = 25

interface Coordinates {
    latitude: number
    longitude: number
}

export function useNearbyEvents(
    coordinates: Coordinates | undefined,
    radiusKm: number = DEFAULT_NEARBY_RADIUS_KM,
    enabled: boolean = true,
) {
    return useQuery<NearbyEventsResponse>({
        queryKey: queryKeys.events.nearby(coordinates?.latitude, coordinates?.longitude, radiusKm),
        enabled: Boolean(coordinates) && enabled,
        staleTime: 1000 * 60 * 5,
        queryFn: async () => {
            if (!coordinates) {
                throw new Error('Coordinates are required for nearby events')
            }
            const params = new URLSearchParams({
                latitude: coordinates.latitude.toString(),
                longitude: coordinates.longitude.toString(),
                radiusKm: radiusKm.toString(),
                limit: '25',
            })

            const response = await fetch(`/api/search/nearby?${params.toString()}`, {
                credentials: 'include',
            })

            if (!response.ok) {
                const statusCode = response.status
                let errorMessage = 'Failed to load nearby events'
                try {
                    const errorBody = await response.json() as { error?: string }
                    if (errorBody.error) {
                        errorMessage = `${errorMessage}: ${errorBody.error}`
                    }
                } catch {
                    // If response body isn't JSON, use status-based message
                    if (statusCode >= 400 && statusCode < 500) {
                        errorMessage = `${errorMessage} (${statusCode}): Invalid request parameters.`
                    } else if (statusCode >= 500) {
                        errorMessage = `${errorMessage} (${statusCode}): Server error. Please try again later.`
                    }
                }
                throw new Error(errorMessage)
            }

            return response.json()
        },
    })
}
