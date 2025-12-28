
import { Link } from 'react-router-dom'

import { Badge, Card } from '@/components/ui'
import { formatDateTime } from '@/lib/date'
import { getVisibilityMeta } from '@/lib/visibility'
import type { EventVisibility } from '@/types'

export interface TrendingEvent {
    id: string
    title: string
    startTime: string
    visibility: string
    trendingRank?: number
    trendingScore?: number
    user?: {
        username: string
    }
    trendingMetrics?: {
        likes: number
        comments: number
        attendance: number
    }
    engagement?: {
        likes: number
        comments: number
        attendance: number
    }
    tags?: Array<{ id: string; tag: string }>
}

interface TrendingEventProps {
    event: TrendingEvent
    showRank?: boolean
}

export function TrendingEventCard({ event, showRank = false }: TrendingEventProps) {
    const visibilityMeta = getVisibilityMeta(
        event.visibility as EventVisibility | undefined
    )

    // Helper to handle click - wrapping in Link is better than onClick handler for accessibility/SEO
    // but the original code used onClick. Link is better.

    return (
        <Link to={`/@${event.user?.username}/${event.id}`} className="block mb-4">
            <Card
                variant="default"
                padding="md"
                className="hover:border-primary-200 dark:hover:border-primary-800 transition-colors cursor-pointer"
            >
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 text-sm text-text-tertiary mb-1">
                            {showRank && event.trendingRank && (
                                <span className="font-semibold">#{event.trendingRank}</span>
                            )}
                            <span>{formatDateTime(event.startTime)}</span>
                        </div>
                        <h3 className="text-xl font-semibold text-text-primary truncate">
                            {event.title}
                        </h3>
                        {event.user && (
                            <p className="text-sm text-text-secondary">
                                @{event.user.username}
                            </p>
                        )}
                    </div>
                    <div className="text-right flex-shrink-0">
                        {event.trendingScore !== undefined && (
                            <Badge variant="warning" size="md" className="font-semibold mb-2 block w-fit ml-auto">
                                🔥 {event.trendingScore?.toFixed(1)}
                            </Badge>
                        )}
                        <div>
                            <Badge
                                variant={visibilityMeta.variant}
                                size="sm">
                                {visibilityMeta.icon} {visibilityMeta.label}
                            </Badge>
                        </div>
                    </div>
                </div>

                {/* Metrics if available (trending events usually have them) */}
                {(event.trendingMetrics || event.engagement) && (
                    <div className="mt-4 flex flex-wrap gap-4 text-xs text-text-secondary">
                        {(event.trendingMetrics?.likes ?? 0) > 0 && <span>❤️ {event.trendingMetrics?.likes} likes</span>}
                        {(event.trendingMetrics?.comments ?? 0) > 0 && <span>💬 {event.trendingMetrics?.comments} comments</span>}
                        {(event.trendingMetrics?.attendance ?? 0) > 0 && <span>📅 {event.trendingMetrics?.attendance} RSVPs</span>}
                    </div>
                )}

                {event.tags && event.tags.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {event.tags.slice(0, 4).map((tag) => (
                            <Badge key={tag.id} variant="primary" size="sm">
                                #{tag.tag}
                            </Badge>
                        ))}
                        {event.tags.length > 4 && (
                            <span className="text-xs text-text-tertiary">
                                +{event.tags.length - 4} more
                            </span>
                        )}
                    </div>
                ) : null}
            </Card>
        </Link>
    )
}
