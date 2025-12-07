import { useQuery } from '@tanstack/react-query'
import { queryKeys } from './keys'
import type { Event } from '../../types'

export interface EventSearchFilters {
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

interface EventSearchResponse {
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
                throw new Error('Failed to search events')
            }

            return response.json()
        },
        keepPreviousData: true,
    })
}
