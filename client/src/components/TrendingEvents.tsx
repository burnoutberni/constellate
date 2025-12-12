import { Link } from 'react-router-dom'
import { useTrendingEvents } from '@/hooks/queries'
import { Card, Badge } from './ui'
import type { Event } from '@/types'

interface TrendingEventsProps {
	limit?: number
	windowDays?: number
	className?: string
}

/**
 * TrendingEvents component displays trending events based on activity.
 * Integrates with WP-012 backend trending events feature.
 */
export function TrendingEvents({ limit = 5, windowDays = 7, className }: TrendingEventsProps) {
	const { data, isLoading, isError } = useTrendingEvents(limit, windowDays)

	if (isLoading) {
		return (
			<Card className={className}>
				<div className="p-6">
					<h3 className="text-lg font-semibold text-neutral-900 mb-4">
						🔥 Trending Events
					</h3>
					<div className="space-y-3">
						{['first', 'second', 'third'].map((position) => (
							<div key={`trending-skeleton-${position}`} className="animate-pulse">
								<div className="h-4 bg-neutral-200 rounded w-3/4 mb-2" />
								<div className="h-3 bg-neutral-100 rounded w-1/2" />
							</div>
						))}
					</div>
				</div>
			</Card>
		)
	}

	if (isError || !data || data.events.length === 0) {
		return null
	}

	const formatEventDate = (dateString: string) => {
		const date = new Date(dateString)
		const now = new Date()
		const diff = date.getTime() - now.getTime()
		const days = Math.floor(diff / (1000 * 60 * 60 * 24))

		if (days === 0) {
			return 'Today'
		}
		if (days === 1) {
			return 'Tomorrow'
		}
		if (days > 1 && days < 7) {
			return `In ${days} days`
		}

		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
		})
	}

	return (
		<Card className={className}>
			<div className="p-6">
				<div className="flex items-center justify-between mb-4">
					<h3 className="text-lg font-semibold text-neutral-900">🔥 Trending Events</h3>
					<span className="text-xs text-neutral-500">Last {data.windowDays} days</span>
				</div>

				<div className="space-y-3">
					{data.events.map((event: Event) => (
						<TrendingEventItem
							key={event.id}
							event={event}
							formatDate={formatEventDate}
						/>
					))}
				</div>

				<Link
					to="/search"
					className="block text-center text-sm text-info-600 hover:text-info-700 mt-4 font-medium">
					View all events →
				</Link>
			</div>
		</Card>
	)
}

function TrendingEventItem({
	event,
	formatDate,
}: {
	event: Event
	formatDate: (date: string) => string
}) {
	const eventPath = event.user?.username
		? `/@${event.user.username}/${event.originalEventId || event.id}`
		: undefined

	if (!eventPath) {
		return null
	}

	const engagementCount =
		(event._count?.likes || 0) + (event._count?.comments || 0) + (event._count?.attendance || 0)

	return (
		<Link
			to={eventPath}
			className="block p-3 rounded-lg hover:bg-neutral-50 transition-colors border border-neutral-100">
			<div className="flex items-start justify-between gap-2">
				<div className="flex-1 min-w-0">
					<h4 className="font-medium text-neutral-900 text-sm truncate">{event.title}</h4>
					<p className="text-xs text-neutral-500 mt-1">
						{formatDate(event.startTime)}
						{event.location && <span> • {event.location}</span>}
					</p>
					{event.tags.length > 0 && (
						<div className="flex flex-wrap gap-1 mt-2">
							{event.tags.slice(0, 2).map((tag) => (
								<Badge key={tag.id} variant="default" size="sm">
									#{tag.tag}
								</Badge>
							))}
						</div>
					)}
				</div>
				{engagementCount > 0 && (
					<div className="flex items-center gap-1 text-xs text-neutral-500 shrink-0">
						<span>🔥</span>
						<span>{engagementCount}</span>
					</div>
				)}
			</div>
		</Link>
	)
}
