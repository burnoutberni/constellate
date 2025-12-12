import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { queryKeys } from './keys'
import type { Event } from '@/types'
import { api } from '@/lib/api-client'

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
    sort?: string
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

export function useEventSearch(filters: EventSearchFilters, page = 1, limit = 20) {
    return useQuery<EventSearchResponse>({
        queryKey: queryKeys.search.events({ filters, page, limit }),
        queryFn: () => {
            const queryParams: Record<string, string | number> = {
                page,
                limit,
            }
            Object.entries(filters).forEach(([key, value]) => {
                if (typeof value === 'string' && value.trim().length > 0) {
                    queryParams[key] = value
                }
            })
            return api.get<EventSearchResponse>('/search', queryParams, undefined, 'Failed to search events')
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
        queryFn: () => {
            if (!coordinates) {
                throw new Error('Coordinates are required for nearby events')
            }
            return api.get<NearbyEventsResponse>(
                '/search/nearby',
                {
                    latitude: coordinates.latitude,
                    longitude: coordinates.longitude,
                    radiusKm,
                    limit: 25,
                },
                undefined,
                'Failed to load nearby events'
            )
        },
    })
}
