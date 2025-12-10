import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from './keys'
import type { InstanceListResponse, InstanceSearchResponse, InstanceWithStats } from '../../types'

interface InstanceListParams {
    limit?: number
    offset?: number
    sortBy?: 'activity' | 'users' | 'created'
}

// Queries
export function useInstances(params: InstanceListParams = {}) {
    const { limit = 50, offset = 0, sortBy = 'activity' } = params

    return useQuery<InstanceListResponse>({
        queryKey: queryKeys.instances.list({ limit, offset, sortBy }),
        queryFn: async () => {
            const searchParams = new URLSearchParams()
            searchParams.append('limit', limit.toString())
            searchParams.append('offset', offset.toString())
            searchParams.append('sortBy', sortBy)

            const response = await fetch(`/api/instances?${searchParams.toString()}`, {
                credentials: 'include',
            })

            if (!response.ok) {
                throw new Error('Failed to fetch instances')
            }

            return response.json()
        },
    })
}

export function useInstanceSearch(query: string, limit = 20) {
    return useQuery<InstanceSearchResponse>({
        queryKey: queryKeys.instances.search(query, limit),
        queryFn: async () => {
            const searchParams = new URLSearchParams()
            searchParams.append('q', query)
            searchParams.append('limit', limit.toString())

            const response = await fetch(`/api/instances/search?${searchParams.toString()}`, {
                credentials: 'include',
            })

            if (!response.ok) {
                throw new Error('Failed to search instances')
            }

            return response.json()
        },
        enabled: query.length > 0,
    })
}

export function useInstanceDetail(domain: string) {
    return useQuery<InstanceWithStats>({
        queryKey: queryKeys.instances.detail(domain),
        queryFn: async () => {
            const response = await fetch(`/api/instances/${encodeURIComponent(domain)}`, {
                credentials: 'include',
            })

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Instance not found')
                }
                throw new Error('Failed to fetch instance details')
            }

            return response.json()
        },
        enabled: !!domain,
    })
}

// Mutations
export function useBlockInstance(domain: string) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async () => {
            const response = await fetch(`/api/instances/${encodeURIComponent(domain)}/block`, {
                method: 'POST',
                credentials: 'include',
            })

            if (!response.ok) {
                const error = await response.json().catch(() => ({
                    error: 'Failed to block instance',
                }))
                throw new Error(error.error || 'Failed to block instance')
            }

            return response.json()
        },
        onSuccess: () => {
            // Invalidate all instance queries
            queryClient.invalidateQueries({
                queryKey: queryKeys.instances.all(),
            })
        },
    })
}

export function useUnblockInstance(domain: string) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async () => {
            const response = await fetch(`/api/instances/${encodeURIComponent(domain)}/unblock`, {
                method: 'POST',
                credentials: 'include',
            })

            if (!response.ok) {
                const error = await response.json().catch(() => ({
                    error: 'Failed to unblock instance',
                }))
                throw new Error(error.error || 'Failed to unblock instance')
            }

            return response.json()
        },
        onSuccess: () => {
            // Invalidate all instance queries
            queryClient.invalidateQueries({
                queryKey: queryKeys.instances.all(),
            })
        },
    })
}

export function useRefreshInstance(domain: string) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async () => {
            const response = await fetch(`/api/instances/${encodeURIComponent(domain)}/refresh`, {
                method: 'POST',
                credentials: 'include',
            })

            if (!response.ok) {
                const error = await response.json().catch(() => ({
                    error: 'Failed to refresh instance',
                }))
                throw new Error(error.error || 'Failed to refresh instance')
            }

            return response.json()
        },
        onSuccess: () => {
            // Invalidate instance detail query
            queryClient.invalidateQueries({
                queryKey: queryKeys.instances.detail(domain),
            })
        },
    })
}
