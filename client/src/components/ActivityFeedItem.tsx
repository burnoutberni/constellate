import { Link } from 'react-router-dom'
import type { Activity } from '../types/activity'
import type { EventVisibility } from '../types'
import { getVisibilityMeta } from '../lib/visibility'

interface ActivityFeedItemProps {
    activity: Activity
}

export function ActivityFeedItem({ activity }: ActivityFeedItemProps) {
    const visibilityMeta = getVisibilityMeta(activity.event.visibility as EventVisibility | undefined)
    const rsvpStatus = activity.data?.status === 'attending' ? 'will attend' : 'might attend'

    const getActivityText = () => {
        switch (activity.type) {
            case 'like':
                return (
                    <span>
                        <strong>{activity.user.name || activity.user.username}</strong> liked{' '}
                        <strong>{activity.event.title}</strong>
                    </span>
                )
            case 'rsvp':
                return (
                    <span>
                        <strong>{activity.user.name || activity.user.username}</strong> {rsvpStatus}{' '}
                        <strong>{activity.event.title}</strong>
                    </span>
                )
            case 'comment':
                return (
                    <span>
                        <strong>{activity.user.name || activity.user.username}</strong> commented on{' '}
                        <strong>{activity.event.title}</strong>
                    </span>
                )
            case 'event_created':
                return (
                    <span>
                        <strong>{activity.user.name || activity.user.username}</strong> created{' '}
                        <strong>{activity.event.title}</strong>
                    </span>
                )
            default:
                return null
        }
    }

    const getActivityIcon = () => {
        switch (activity.type) {
            case 'like':
                return '❤️'
            case 'rsvp':
                return '👍'
            case 'comment':
                return '💬'
            case 'event_created':
                return '📅'
            default:
                return '📌'
        }
    }

    const formatTime = (dateString: string) => {
        const date = new Date(dateString)
        const now = new Date()
        const diff = now.getTime() - date.getTime()
        const minutes = Math.floor(diff / (1000 * 60))
        const hours = Math.floor(diff / (1000 * 60 * 60))
        const days = Math.floor(diff / (1000 * 60 * 60 * 24))

        if (minutes < 1) return 'just now'
        if (minutes < 60) return `${minutes}m ago`
        if (hours < 24) return `${hours}h ago`
        if (days < 7) return `${days}d ago`

        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        })
    }

    return (
        <Link
            to={`/@${activity.event.user?.username}/${activity.event.id}`}
            className="block"
        >
            <div className="card-hover p-4 animate-fade-in">
                <div className="flex items-start gap-3">
                    <div
                        className="avatar w-10 h-10 flex-shrink-0"
                        style={{ backgroundColor: activity.user.displayColor || '#3b82f6' }}
                    >
                        {activity.user.name?.[0] || activity.user.username[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 mb-1">
                            <span className="text-lg">{getActivityIcon()}</span>
                            <div className="flex-1">
                                <p className="text-gray-900">
                                    {getActivityText()}
                                </p>
                                {activity.type === 'comment' && activity.data?.commentContent && (
                                    <p className="text-sm text-gray-600 mt-1 italic">
                                        "{activity.data.commentContent}"
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
                            <span className={`badge ${visibilityMeta.badgeClass}`}>
                                {visibilityMeta.icon} {visibilityMeta.label}
                            </span>
                            <span>{formatTime(activity.createdAt)}</span>
                            {activity.event.location && (
                                <span>📍 {activity.event.location}</span>
                            )}
                            <span>
                                📅{' '}
                                {new Date(activity.event.startTime).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                })}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </Link>
    )
}

