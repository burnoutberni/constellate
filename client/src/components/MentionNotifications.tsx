import { Link } from 'react-router-dom'
import { useUIStore, MentionNotification } from '../stores'

function formatTimestamp(value: string) {
    try {
        return new Date(value).toLocaleString()
    } catch {
        return value
    }
}

export function MentionNotifications() {
    const notifications = useUIStore((state) => state.mentionNotifications)
    const dismiss = useUIStore((state) => state.dismissMentionNotification)

    if (!notifications.length) {
        return null
    }

    return (
        <div className="fixed bottom-4 right-4 z-40 flex max-w-sm flex-col gap-3">
            {notifications.map((notification) => (
                <MentionToast key={notification.id} notification={notification} onDismiss={dismiss} />
            ))}
        </div>
    )
}

function MentionToast({ notification, onDismiss }: { notification: MentionNotification; onDismiss: (id: string) => void }) {
    const profilePath = notification.eventOwnerHandle
        ? `/@${notification.eventOwnerHandle}/${notification.eventId}`
        : '/feed'

    return (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-xl">
            <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-gray-900">New mention</span>
                <button
                    type="button"
                    onClick={() => onDismiss(notification.id)}
                    className="text-xs font-medium text-gray-500 hover:text-gray-700"
                >
                    Dismiss
                </button>
            </div>
            <p className="mb-2 text-sm text-gray-700">
                You were mentioned by{' '}
                <span className="font-medium">
                    {notification.author?.name || (notification.author?.username ? `@${notification.author.username}` : 'someone')}
                </span>
                {notification.eventTitle && (
                    <>
                        {' '}in{' '}
                        <span className="font-medium">{notification.eventTitle}</span>
                    </>
                )}
            </p>
            {notification.content && (
                <p className="mb-3 text-sm text-gray-600 break-words">
                    “{notification.content}”
                </p>
            )}
            <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{formatTimestamp(notification.createdAt)}</span>
                <Link to={profilePath} className="font-medium text-blue-600 hover:underline" onClick={() => onDismiss(notification.id)}>
                    View comment →
                </Link>
            </div>
        </div>
    )
}
