import { ReminderItem } from './ReminderItem'
import { ReminderItemWithDelete } from './ReminderItemWithDelete'
import type { ReminderWithEvent } from '../types'

interface ReminderListProps {
    reminders: ReminderWithEvent[]
    onDelete?: (reminderId: string, eventId: string) => void
}

export function ReminderList({ reminders, onDelete }: ReminderListProps) {
    // If onDelete is provided, use the old pattern for backwards compatibility
    // Otherwise, use ReminderItemWithDelete which handles deletion with hooks
    const useHookBasedDeletion = !onDelete

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
                        {pendingReminders.map((reminder) =>
                            useHookBasedDeletion ? (
                                <ReminderItemWithDelete key={reminder.id} reminder={reminder} />
                            ) : (
                                <ReminderItem
                                    key={reminder.id}
                                    reminder={reminder}
                                    onDelete={(id) => {
                                        const r = reminders.find((rem) => rem.id === id)
                                        if (r) onDelete(id, r.event.id)
                                    }}
                                />
                            )
                        )}
                    </div>
                </div>
            )}

            {failedReminders.length > 0 && (
                <div>
                    <h3 className="text-lg font-semibold text-text-primary mb-3">
                        Failed Reminders ({failedReminders.length})
                    </h3>
                    <div className="space-y-3">
                        {failedReminders.map((reminder) =>
                            useHookBasedDeletion ? (
                                <ReminderItemWithDelete key={reminder.id} reminder={reminder} />
                            ) : (
                                <ReminderItem
                                    key={reminder.id}
                                    reminder={reminder}
                                    onDelete={(id) => {
                                        const r = reminders.find((rem) => rem.id === id)
                                        if (r) onDelete(id, r.event.id)
                                    }}
                                />
                            )
                        )}
                    </div>
                </div>
            )}

            {sentReminders.length > 0 && (
                <div>
                    <h3 className="text-lg font-semibold text-text-primary mb-3">
                        Sent Reminders ({sentReminders.length})
                    </h3>
                    <div className="space-y-3">
                        {sentReminders.map((reminder) =>
                            useHookBasedDeletion ? (
                                <ReminderItemWithDelete key={reminder.id} reminder={reminder} />
                            ) : (
                                <ReminderItem
                                    key={reminder.id}
                                    reminder={reminder}
                                    onDelete={(id) => {
                                        const r = reminders.find((rem) => rem.id === id)
                                        if (r) onDelete(id, r.event.id)
                                    }}
                                />
                            )
                        )}
                    </div>
                </div>
            )}

            {otherReminders.length > 0 && (
                <div>
                    <h3 className="text-lg font-semibold text-text-primary mb-3">
                        Other ({otherReminders.length})
                    </h3>
                    <div className="space-y-3">
                        {otherReminders.map((reminder) =>
                            useHookBasedDeletion ? (
                                <ReminderItemWithDelete key={reminder.id} reminder={reminder} />
                            ) : (
                                <ReminderItem
                                    key={reminder.id}
                                    reminder={reminder}
                                    onDelete={(id) => {
                                        const r = reminders.find((rem) => rem.id === id)
                                        if (r) onDelete(id, r.event.id)
                                    }}
                                />
                            )
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
