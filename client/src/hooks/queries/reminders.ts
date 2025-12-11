import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from './keys'
import type { ReminderWithEvent } from '@/types'

interface UserRemindersResponse {
    reminders: ReminderWithEvent[]
}

export function useUserReminders() {
    return useQuery<UserRemindersResponse>({
        queryKey: queryKeys.reminders.list(),
        queryFn: async () => {
            const response = await fetch('/api/users/me/reminders', {
                credentials: 'include',
            })
            if (!response.ok) {
                throw new Error('Failed to fetch reminders')
            }
            return response.json()
        },
    })
}

export function useDeleteReminder(eventId: string) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (reminderId: string) => {
            const response = await fetch(`/api/events/${eventId}/reminders/${reminderId}`, {
                method: 'DELETE',
                credentials: 'include',
            })

            if (!response.ok) {
                throw new Error('Failed to delete reminder')
            }

            return response.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.reminders.list() })
        },
    })
}
