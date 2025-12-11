import { ReminderItem } from './ReminderItem'
import { useDeleteReminder } from '@/hooks/queries'
import { useUIStore } from '@/stores'
import type { ReminderWithEvent } from '@/types'

interface ReminderItemWithDeleteProps {
    reminder: ReminderWithEvent
    isDeleting?: boolean
}

export function ReminderItemWithDelete({ reminder, isDeleting }: ReminderItemWithDeleteProps) {
    const deleteReminder = useDeleteReminder(reminder.event.id)
    const addErrorToast = useUIStore((state) => state.addErrorToast)

    const handleDelete = (reminderId: string) => {
        deleteReminder.mutate(reminderId, {
            onError: (error) => {
                console.error('Failed to delete reminder:', error)
                addErrorToast({
                    id: crypto.randomUUID(),
                    message: 'Failed to delete reminder. Please try again.',
                })
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
