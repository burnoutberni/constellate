import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { useMutationErrorHandler } from '@/hooks/useErrorHandler'
import { api } from '@/lib/api-client'
import type { ReminderWithEvent } from '@/types'

import { queryKeys } from './keys'

interface UserRemindersResponse {
	reminders: ReminderWithEvent[]
}

export function useUserReminders() {
	return useQuery<UserRemindersResponse>({
		queryKey: queryKeys.reminders.list(),
		queryFn: () =>
			api.get<UserRemindersResponse>(
				'/users/me/reminders',
				undefined,
				undefined,
				'Failed to fetch reminders'
			),
	})
}

export function useDeleteReminder(eventId: string) {
	const queryClient = useQueryClient()
	const handleMutationError = useMutationErrorHandler()

	return useMutation({
		mutationFn: (reminderId: string) =>
			api.delete(
				`/events/${eventId}/reminders/${reminderId}`,
				undefined,
				'Failed to delete reminder'
			),
		onError: (error) => {
			handleMutationError(error, 'Failed to delete reminder')
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.reminders.list() })
		},
	})
}
