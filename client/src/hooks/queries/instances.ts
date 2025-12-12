import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { useMutationErrorHandler } from '@/hooks/useErrorHandler'
import { api } from '@/lib/api-client'
import type { InstanceListResponse, InstanceSearchResponse, InstanceWithStats } from '@/types'

import { queryKeys } from './keys'

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
		queryFn: () =>
			api.get<InstanceListResponse>(
				'/instances',
				{ limit, offset, sortBy },
				undefined,
				'Failed to fetch instances'
			),
	})
}

export function useInstanceSearch(query: string, limit = 20) {
	return useQuery<InstanceSearchResponse>({
		queryKey: queryKeys.instances.search(query, limit),
		queryFn: () =>
			api.get<InstanceSearchResponse>(
				'/instances/search',
				{ q: query, limit },
				undefined,
				'Failed to search instances'
			),
		enabled: query.length > 0,
	})
}

export function useInstanceDetail(domain: string) {
	return useQuery<InstanceWithStats>({
		queryKey: queryKeys.instances.detail(domain),
		queryFn: () =>
			api.get<InstanceWithStats>(
				`/instances/${encodeURIComponent(domain)}`,
				undefined,
				undefined,
				'Failed to fetch instance details'
			),
		enabled: Boolean(domain),
	})
}

// Mutations
export function useBlockInstance(domain: string) {
	const queryClient = useQueryClient()
	const handleMutationError = useMutationErrorHandler()

	return useMutation({
		mutationFn: () =>
			api.post(
				`/instances/${encodeURIComponent(domain)}/block`,
				undefined,
				undefined,
				'Failed to block instance'
			),
		onError: (error) => {
			handleMutationError(error, 'Failed to block instance')
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
	const handleMutationError = useMutationErrorHandler()

	return useMutation({
		mutationFn: () =>
			api.post(
				`/instances/${encodeURIComponent(domain)}/unblock`,
				undefined,
				undefined,
				'Failed to unblock instance'
			),
		onError: (error) => {
			handleMutationError(error, 'Failed to unblock instance')
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
	const handleMutationError = useMutationErrorHandler()

	return useMutation({
		mutationFn: () =>
			api.post(
				`/instances/${encodeURIComponent(domain)}/refresh`,
				undefined,
				undefined,
				'Failed to refresh instance'
			),
		onError: (error) => {
			handleMutationError(error, 'Failed to refresh instance')
		},
		onSuccess: () => {
			// Invalidate instance detail query
			queryClient.invalidateQueries({
				queryKey: queryKeys.instances.detail(domain),
			})
		},
	})
}
