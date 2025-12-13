import { Link } from 'react-router-dom'

import { useUIStore, MentionNotification } from '@/stores'

import { Stack } from './layout'
import { Button, Card } from './ui'

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
		<Stack className="fixed bottom-4 right-4 z-40 max-w-sm" gap="sm">
			{notifications.map((notification) => (
				<MentionToast
					key={notification.id}
					notification={notification}
					onDismiss={dismiss}
				/>
			))}
		</Stack>
	)
}

function MentionToast({
	notification,
	onDismiss,
}: {
	notification: MentionNotification
	onDismiss: (id: string) => void
}) {
	const profilePath = notification.eventOwnerHandle
		? `/@${notification.eventOwnerHandle}/${notification.eventId}`
		: '/feed'

	return (
		<Card variant="elevated" padding="md" className="shadow-xl">
			<div className="mb-2 flex items-center justify-between gap-3">
				<span className="text-sm font-semibold text-text-primary">New mention</span>
				<Button
					type="button"
					onClick={() => onDismiss(notification.id)}
					variant="ghost"
					size="sm"
					className="text-xs font-medium text-text-secondary hover:text-text-primary h-auto p-0">
					Dismiss
				</Button>
			</div>
			<p className="mb-2 text-sm text-text-primary">
				You were mentioned by{' '}
				<span className="font-medium">
					{notification.author?.name ||
						(notification.author?.username
							? `@${notification.author.username}`
							: 'someone')}
				</span>
				{notification.eventTitle && (
					<>
						{' '}
						in <span className="font-medium">{notification.eventTitle}</span>
					</>
				)}
			</p>
			{notification.content && (
				<p className="mb-3 text-sm text-text-secondary break-words">
					“{notification.content}”
				</p>
			)}
			<div className="flex items-center justify-between text-xs text-text-tertiary">
				<span>{formatTimestamp(notification.createdAt)}</span>
				<Link
					to={profilePath}
					className="font-medium text-primary-600 hover:underline"
					onClick={() => onDismiss(notification.id)}>
					View comment →
				</Link>
			</div>
		</Card>
	)
}
