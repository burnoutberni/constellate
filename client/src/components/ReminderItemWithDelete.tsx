import { useState } from 'react'

import { useDeleteReminder } from '@/hooks/queries'
import { useErrorHandler } from '@/hooks/useErrorHandler'
import type { ReminderWithEvent } from '@/types'

import { ConfirmationModal } from './ConfirmationModal'
import { ReminderItem } from './ReminderItem'

interface ReminderItemWithDeleteProps {
	reminder: ReminderWithEvent
	isDeleting?: boolean
}

export function ReminderItemWithDelete({ reminder, isDeleting }: ReminderItemWithDeleteProps) {
	const [isConfirmOpen, setIsConfirmOpen] = useState(false)
	const deleteReminder = useDeleteReminder(reminder.event.id)
	const handleError = useErrorHandler()

	const handleDelete = (_: string) => {
		// We ignore reminderId passed from child because we have it in props
		setIsConfirmOpen(true)
	}

	const confirmDelete = () => {
		deleteReminder.mutate(reminder.id, {
			onError: (error) => {
				handleError(error, 'Failed to delete reminder. Please try again.', {
					context: 'ReminderItemWithDelete.handleDelete',
				})
			},
			onSettled: () => {
				setIsConfirmOpen(false)
			},
		})
	}

	return (
		<>
			<ReminderItem
				reminder={reminder}
				onDelete={handleDelete}
				isDeleting={isDeleting || deleteReminder.isPending}
			/>
			<ConfirmationModal
				isOpen={isConfirmOpen}
				onCancel={() => setIsConfirmOpen(false)}
				onConfirm={confirmDelete}
				title="Delete Reminder"
				message={`Are you sure you want to delete the reminder for "${reminder.event.title}"?`}
				confirmLabel="Delete"
				variant="default"
				isPending={deleteReminder.isPending}
			/>
		</>
	)
}
