import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { useMutationErrorHandler } from '@/hooks/useErrorHandler'
import { api } from '@/lib/api-client'

import { queryKeys } from './keys'

export interface EmailPreferences {
	FOLLOW: boolean
	COMMENT: boolean
	LIKE: boolean
	MENTION: boolean
	EVENT: boolean
	SYSTEM: boolean
}

export interface EmailPreferencesResponse {
	preferences: EmailPreferences
}

export function useEmailPreferences(options?: { enabled?: boolean }) {
	const enabled = options?.enabled ?? true

	return useQuery<EmailPreferencesResponse>({
		queryKey: queryKeys.emailPreferences.all(),
		queryFn: () =>
			api.get<EmailPreferencesResponse>(
				'/email-preferences',
				undefined,
				undefined,
				'Failed to fetch email preferences'
			),
		enabled,
		staleTime: 1000 * 60 * 5, // 5 minutes
	})
}

export function useUpdateEmailPreferences() {
	const queryClient = useQueryClient()
	const handleMutationError = useMutationErrorHandler()

	return useMutation({
		mutationFn: (preferences: Partial<EmailPreferences>) =>
			api.put<EmailPreferencesResponse>(
				'/email-preferences',
				preferences,
				undefined,
				'Failed to update email preferences'
			),
		onError: (error) => {
			handleMutationError(error, 'Failed to update email preferences')
		},
		onSuccess: (response) => {
			queryClient.setQueryData(queryKeys.emailPreferences.all(), response)
		},
	})
}

export function useResetEmailPreferences() {
	const queryClient = useQueryClient()
	const handleMutationError = useMutationErrorHandler()

	return useMutation({
		mutationFn: () =>
			api.post<EmailPreferencesResponse>(
				'/email-preferences/reset',
				undefined,
				undefined,
				'Failed to reset email preferences'
			),
		onError: (error) => {
			handleMutationError(error, 'Failed to reset email preferences')
		},
		onSuccess: (response) => {
			queryClient.setQueryData(queryKeys.emailPreferences.all(), response)
		},
	})
}