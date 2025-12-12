import { Link } from 'react-router-dom'

import { useRecommendedEvents } from '@/hooks/queries'
import type { EventRecommendationPayload } from '@/types'

import { Card, Badge } from './ui'

interface RecommendedEventsProps {
	limit?: number
	className?: string
}

/**
 * RecommendedEvents component displays personalized event recommendations.
 * Integrates with WP-013 backend recommendations feature.
 * Only displays for authenticated users.
 */
export function RecommendedEvents({ limit = 6, className }: RecommendedEventsProps) {
	const { data, isLoading, isError } = useRecommendedEvents(limit, { enabled: true })

	if (isLoading) {
		return (
			<Card className={className}>
				<div className="p-6">
					<h3 className="text-lg font-semibold text-neutral-900 mb-4">
						✨ Recommended for You
					</h3>
					<div className="space-y-3">
						{['first', 'second', 'third'].map((position) => (
							<div key={`recommended-skeleton-${position}`} className="animate-pulse">
								<div className="h-4 bg-neutral-200 rounded w-3/4 mb-2" />
								<div className="h-3 bg-neutral-100 rounded w-1/2" />
							</div>
						))}
					</div>
				</div>
			</Card>
		)
	}

	if (isError || !data || data.recommendations.length === 0) {
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

	const getReasonLabel = (recommendation: EventRecommendationPayload) => {
		if (recommendation.reasons.includes('tag_match')) {
			return '🏷️ Similar interests'
		}
		if (recommendation.reasons.includes('host_match')) {
			return '👤 From host you follow'
		}
		if (recommendation.reasons.includes('followed_user_attending')) {
			return '👥 Friends attending'
		}
		return null
	}

	return (
		<Card className={className}>
			<div className="p-6">
				<div className="flex items-center justify-between mb-4">
					<h3 className="text-lg font-semibold text-neutral-900">
						✨ Recommended for You
					</h3>
					{data.metadata ? (
						<span className="text-xs text-neutral-500">
							Based on{' '}
							{data.metadata.signals.tags +
								data.metadata.signals.hosts +
								data.metadata.signals.followed}{' '}
							signals
						</span>
					) : null}
				</div>

				<div className="space-y-3">
					{data.recommendations.map((recommendation) => (
						<RecommendedEventItem
							key={recommendation.event.id}
							recommendation={recommendation}
							formatDate={formatEventDate}
							reasonLabel={getReasonLabel(recommendation)}
						/>
					))}
				</div>

				<Link
					to="/search"
					className="block text-center text-sm text-info-600 hover:text-info-700 mt-4 font-medium">
					Explore more events →
				</Link>
			</div>
		</Card>
	)
}

interface RecommendedEventItemProps {
	recommendation: EventRecommendationPayload
	formatDate: (date: string) => string
	reasonLabel: string | null
}

function RecommendedEventItem({
	recommendation,
	formatDate,
	reasonLabel,
}: RecommendedEventItemProps) {
	const { event, score } = recommendation
	const eventPath = event.user?.username
		? `/@${event.user.username}/${event.originalEventId || event.id}`
		: undefined

	if (!eventPath) {
		return null
	}

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
					{reasonLabel && <p className="text-xs text-info-600 mt-1">{reasonLabel}</p>}
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
				{score > 0 && (
					<div className="flex items-center gap-1 text-xs text-neutral-400 shrink-0">
						<span>⭐</span>
						<span>{score.toFixed(1)}</span>
					</div>
				)}
			</div>
		</Link>
	)
}
