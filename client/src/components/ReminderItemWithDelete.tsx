import { ReminderItem } from './ReminderItem'
import { useDeleteReminder } from '@/hooks/queries'
import { useErrorHandler } from '@/hooks/useErrorHandler'
import type { ReminderWithEvent } from '@/types'

interface ReminderItemWithDeleteProps {
    reminder: ReminderWithEvent
    isDeleting?: boolean
}

export function ReminderItemWithDelete({ reminder, isDeleting }: ReminderItemWithDeleteProps) {
    const deleteReminder = useDeleteReminder(reminder.event.id)
    const handleError = useErrorHandler()

    const handleDelete = (reminderId: string) => {
        deleteReminder.mutate(reminderId, {
            onError: (error) => {
                handleError(error, 'Failed to delete reminder. Please try again.', { context: 'ReminderItemWithDelete.handleDelete' })
            },
        })
    }

    return (
        <ReminderItem
            reminder={reminder}
            onDelete={handleDelete}
            isDeleting={isDeleting || deleteReminder.isPending}
        />
    )
}
