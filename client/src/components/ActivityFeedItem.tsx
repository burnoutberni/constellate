import { Link } from 'react-router-dom'

import type { Activity, EventVisibility } from '@/types'

import { getVisibilityMeta } from '../lib/visibility'

import { FollowButton } from './FollowButton'
import { Avatar, Badge, Card, SafeHTML } from './ui'

interface ActivityFeedItemProps {
	activity: Activity
}

export function ActivityFeedItem({ activity }: ActivityFeedItemProps) {
	const visibilityMeta = getVisibilityMeta(
		activity.event.visibility as EventVisibility | undefined
	)
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
			case 'event_shared':
				return (
					<span>
						<strong>{activity.user.name || activity.user.username}</strong> shared{' '}
						<strong>{activity.sharedEvent?.title}</strong>
						{activity.sharedEvent?.user && (
							<>
								{' '}
								from <strong>@{activity.sharedEvent.user.username}</strong>
							</>
						)}
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
			case 'event_shared':
				return '🔁'
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

		if (minutes < 1) {
			return 'just now'
		}
		if (minutes < 60) {
			return `${minutes}m ago`
		}
		if (hours < 24) {
			return `${hours}h ago`
		}
		if (days < 7) {
			return `${days}d ago`
		}

		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
		})
	}

	return (
		<Card
			variant="default"
			padding="md"
			className="hover:border-border-hover transition-colors">
			<div className="flex items-start gap-3">
				{/* User Avatar */}
				<Link to={`/@${activity.user.username}`} className="flex-shrink-0">
					<Avatar
						src={activity.user.profileImage || undefined}
						fallback={(
							activity.user.name?.[0] || activity.user.username[0]
						).toUpperCase()}
						alt={activity.user.name || activity.user.username}
						size="md"
					/>
				</Link>

				<div className="flex-1 min-w-0">
					{/* Activity Header */}
					<div className="flex items-start justify-between gap-2 mb-2">
						<div className="flex items-start gap-2 flex-1 min-w-0">
							<span className="text-lg flex-shrink-0">{getActivityIcon()}</span>
							<div className="flex-1 min-w-0">
								<p className="text-text-primary text-sm">{getActivityText()}</p>
								{activity.type === 'comment' && activity.data?.commentContent && (
									<p className="text-sm text-text-secondary mt-1 italic">
										&quot;{activity.data.commentContent}&quot;
									</p>
								)}
								{activity.type === 'event_shared' &&
									activity.sharedEvent?.summary && (
										<div className="text-sm text-text-secondary mt-1">
											<SafeHTML html={activity.sharedEvent.summary} />
										</div>
									)}
							</div>
						</div>
						{/* Follow Button */}
						<div className="flex-shrink-0">
							<FollowButton
								username={activity.user.username}
								size="sm"
								variant="ghost"
							/>
						</div>
					</div>

					{/* Event Link */}
					<Link
						to={`/@${activity.event.user?.username}/${activity.event.id}`}
						className="block hover:opacity-80 transition-opacity">
						{/* Event Info */}
						<div className="flex items-center gap-2 mt-2 text-xs text-text-tertiary flex-wrap">
							<Badge variant={visibilityMeta.variant} size="sm">
								{visibilityMeta.icon} {visibilityMeta.label}
							</Badge>
							<span>{formatTime(activity.createdAt)}</span>
							{activity.event.location && <span>📍 {activity.event.location}</span>}
							<span>
								📅{' '}
								{new Date(activity.event.startTime).toLocaleDateString('en-US', {
									month: 'short',
									day: 'numeric',
								})}
							</span>
						</div>

						{/* Event Tags */}
						{activity.event.tags && activity.event.tags.length > 0 && (
							<div className="flex flex-wrap gap-1 mt-2">
								{activity.event.tags.slice(0, 3).map((tag) => (
									<Badge key={tag.id} variant="primary" size="sm">
										#{tag.tag}
									</Badge>
								))}
								{activity.event.tags.length > 3 && (
									<span className="text-xs text-text-tertiary">
										+{activity.event.tags.length - 3} more
									</span>
								)}
							</div>
						)}
					</Link>
				</div>
			</div>
		</Card>
	)
}
