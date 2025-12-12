import { Link } from 'react-router-dom'
import { Card, CardContent, Button, Badge, Avatar } from './ui'
import type { ReminderWithEvent, ReminderStatus } from '@/types'
import { REMINDER_OPTIONS } from './reminderConstants'

interface ReminderItemProps {
	reminder: ReminderWithEvent
	onDelete: (reminderId: string) => void
	isDeleting?: boolean
}

function formatDateTime(dateString: string, timezone: string): string {
	try {
		const date = new Date(dateString)
		return new Intl.DateTimeFormat('en-US', {
			dateStyle: 'medium',
			timeStyle: 'short',
			timeZone: timezone,
		}).format(date)
	} catch {
		return dateString
	}
}

function getReminderLabel(minutes: number): string {
	const option = REMINDER_OPTIONS.find(
		(opt: { label: string; value: number | null }) => opt.value === minutes
	)
	return option?.label || `${minutes} minutes before`
}

function getStatusBadgeVariant(
	status: ReminderStatus
): 'default' | 'success' | 'warning' | 'error' {
	switch (status) {
		case 'SENT':
			return 'success'
		case 'FAILED':
			return 'error'
		case 'CANCELLED':
			return 'default'
		case 'SENDING':
			return 'warning'
		case 'PENDING':
		default:
			return 'default'
	}
}

export function ReminderItem({ reminder, onDelete, isDeleting = false }: ReminderItemProps) {
	const { event } = reminder
	const eventStartTime = formatDateTime(event.startTime, event.timezone)
	const remindAt = formatDateTime(reminder.remindAt, event.timezone)
	const reminderLabel = getReminderLabel(reminder.minutesBeforeStart)

	return (
		<Card>
			<CardContent className="p-4">
				<div className="flex items-start gap-4">
					{/* Event Image/Avatar */}
					<div className="flex-shrink-0">
						{event.headerImage ? (
							<img
								src={event.headerImage}
								alt={event.title}
								className="h-16 w-16 rounded-md object-cover"
							/>
						) : (
							<div className="h-16 w-16 rounded-md bg-surface flex items-center justify-center">
								<span className="text-2xl">📅</span>
							</div>
						)}
					</div>

					{/* Event Info */}
					<div className="flex-1 min-w-0">
						<Link
							to={`/@${event.user.username}/${event.id}`}
							className="text-base font-semibold text-text-primary hover:text-primary">
							{event.title}
						</Link>

						<div className="mt-1 flex items-center gap-2 text-sm text-text-secondary">
							<Avatar
								src={event.user.profileImage || undefined}
								fallback={event.user.username.slice(0, 2).toUpperCase()}
								size="sm"
							/>
							<Link to={`/@${event.user.username}`} className="hover:text-primary">
								{event.user.name || event.user.username}
							</Link>
						</div>

						<div className="mt-2 space-y-1 text-sm text-text-secondary">
							<div>
								<span className="font-medium">Event:</span> {eventStartTime}
							</div>
							<div>
								<span className="font-medium">Remind:</span> {remindAt} (
								{reminderLabel})
							</div>
						</div>

						<div className="mt-2 flex items-center gap-2">
							<Badge variant={getStatusBadgeVariant(reminder.status)}>
								{reminder.status}
							</Badge>
							{reminder.failureReason && (
								<span
									className="text-xs text-error-600"
									title={reminder.failureReason}>
									Failed: {reminder.failureReason}
								</span>
							)}
						</div>
					</div>

					{/* Actions */}
					<div className="flex-shrink-0">
						{reminder.status === 'PENDING' && (
							<Button
								variant="danger"
								size="sm"
								onClick={() => onDelete(reminder.id)}
								disabled={isDeleting}>
								{isDeleting ? 'Deleting...' : 'Delete'}
							</Button>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	)
}
