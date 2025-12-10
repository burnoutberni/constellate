import { useState } from 'react'
import { ReminderItem } from './ReminderItem'
import type { EventReminder } from '../types'

interface ReminderWithEvent extends EventReminder {
    event: {
        id: string
        title: string
        startTime: string
        endTime?: string | null
        timezone: string
        headerImage?: string | null
        user: {
            id: string
            username: string
            name?: string | null
            displayColor?: string
            profileImage?: string | null
            isRemote: boolean
        }
    }
}

interface ReminderListProps {
    reminders: ReminderWithEvent[]
    onDelete: (reminderId: string, eventId: string) => void
}

export function ReminderList({ reminders, onDelete }: ReminderListProps) {
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const handleDelete = async (reminderId: string) => {
        const reminder = reminders.find((r) => r.id === reminderId)
        if (!reminder) return

        setDeletingId(reminderId)
        try {
            await onDelete(reminderId, reminder.event.id)
        } finally {
            setDeletingId(null)
        }
    }

    if (reminders.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="text-6xl mb-4">🔔</div>
                <h3 className="text-lg font-semibold text-text-primary mb-2">No reminders yet</h3>
                <p className="text-text-secondary">
                    Set reminders on events you're attending to get notified before they start.
                </p>
            </div>
        )
    }

    // Group reminders by status
    const pendingReminders = reminders.filter((r) => r.status === 'PENDING')
    const sentReminders = reminders.filter((r) => r.status === 'SENT')
    const failedReminders = reminders.filter((r) => r.status === 'FAILED')
    const otherReminders = reminders.filter(
        (r) => r.status !== 'PENDING' && r.status !== 'SENT' && r.status !== 'FAILED'
    )

    return (
        <div className="space-y-6">
            {pendingReminders.length > 0 && (
                <div>
                    <h3 className="text-lg font-semibold text-text-primary mb-3">
                        Upcoming Reminders ({pendingReminders.length})
                    </h3>
                    <div className="space-y-3">
                        {pendingReminders.map((reminder) => (
                            <ReminderItem
                                key={reminder.id}
                                reminder={reminder}
                                onDelete={handleDelete}
                                isDeleting={deletingId === reminder.id}
                            />
                        ))}
                    </div>
                </div>
            )}

            {failedReminders.length > 0 && (
                <div>
                    <h3 className="text-lg font-semibold text-text-primary mb-3">
                        Failed Reminders ({failedReminders.length})
                    </h3>
                    <div className="space-y-3">
                        {failedReminders.map((reminder) => (
                            <ReminderItem
                                key={reminder.id}
                                reminder={reminder}
                                onDelete={handleDelete}
                                isDeleting={deletingId === reminder.id}
                            />
                        ))}
                    </div>
                </div>
            )}

            {sentReminders.length > 0 && (
                <div>
                    <h3 className="text-lg font-semibold text-text-primary mb-3">
                        Sent Reminders ({sentReminders.length})
                    </h3>
                    <div className="space-y-3">
                        {sentReminders.map((reminder) => (
                            <ReminderItem
                                key={reminder.id}
                                reminder={reminder}
                                onDelete={handleDelete}
                                isDeleting={deletingId === reminder.id}
                            />
                        ))}
                    </div>
                </div>
            )}

            {otherReminders.length > 0 && (
                <div>
                    <h3 className="text-lg font-semibold text-text-primary mb-3">
                        Other ({otherReminders.length})
                    </h3>
                    <div className="space-y-3">
                        {otherReminders.map((reminder) => (
                            <ReminderItem
                                key={reminder.id}
                                reminder={reminder}
                                onDelete={handleDelete}
                                isDeleting={deletingId === reminder.id}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
