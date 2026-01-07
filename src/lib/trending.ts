import type { Event } from '@prisma/client'

export const DAY_IN_MS = 1000 * 60 * 60 * 24
export const DEFAULT_TRENDING_LIMIT = 10
export const MAX_TRENDING_LIMIT = 50
export const DEFAULT_TRENDING_WINDOW_DAYS = 7
export const MAX_TRENDING_WINDOW_DAYS = 30

export interface EngagementCounts {
	likes: number
	comments: number
	attendance: number
}

export interface TrendingEvent {
	id: string
	title: string
	startTime: Date
	updatedAt: Date
	// Add other fields as needed for the feed consumer
	user?: {
		id: string
		username: string
		name: string | null
		displayColor: string
		profileImage: string | null
		isRemote: boolean
	} | null
	tags: Array<{ id: string; tag: string }>
	viewerStatus?: 'attending' | 'maybe' | 'not_attending' | null
	attendance?: Array<{
		status: string
		user: {
			id: string
			username: string
			profileImage?: string | null
		}
	}>
	_count?: Partial<EngagementCounts>
	headerImage?: string | null
}

const MIN_SCORE_MULTIPLIER = 0.35

function getTimestamp(value?: Date | null): number {
	if (!value) {
		return 0
	}
	return value.getTime()
}

export function clampTrendingLimit(limit: number | undefined): number {
	if (limit === undefined || !Number.isFinite(limit)) {
		return DEFAULT_TRENDING_LIMIT
	}
	return Math.min(Math.max(Math.trunc(limit), 1), MAX_TRENDING_LIMIT)
}

export function clampTrendingWindowDays(windowDays: number | undefined): number {
	if (windowDays === undefined || !Number.isFinite(windowDays)) {
		return DEFAULT_TRENDING_WINDOW_DAYS
	}
	return Math.min(Math.max(Math.trunc(windowDays), 1), MAX_TRENDING_WINDOW_DAYS)
}

function baseEngagementScore(metrics: EngagementCounts): number {
	return metrics.likes * 4 + metrics.comments * 5 + metrics.attendance * 3
}

export function calculateTrendingScore({
	metrics,
	event,
	windowDays,
	now = new Date(),
}: {
	metrics: EngagementCounts
	event: Pick<Event, 'startTime' | 'createdAt' | 'updatedAt'>
	windowDays: number
	now?: Date
}): number {
	const baseScore = baseEngagementScore(metrics)
	if (baseScore <= 0) {
		return 0
	}

	const normalizedWindow = Math.max(windowDays, 1)
	const nowMs = now.getTime()

	const anchorMs = Math.max(
		getTimestamp(event.startTime),
		getTimestamp(event.updatedAt),
		getTimestamp(event.createdAt)
	)

	const anchorDeltaDays = (nowMs - anchorMs) / DAY_IN_MS

	let recencyMultiplier = 1
	if (Number.isFinite(anchorDeltaDays)) {
		if (anchorDeltaDays >= 0) {
			const decayWindow = normalizedWindow * 1.25
			recencyMultiplier = Math.max(
				MIN_SCORE_MULTIPLIER,
				1 - Math.min(anchorDeltaDays, decayWindow) / decayWindow
			)
		} else {
			const daysUntil = Math.min(Math.abs(anchorDeltaDays), normalizedWindow)
			recencyMultiplier = 1 + (daysUntil / normalizedWindow) * 0.25
		}
	}

	const freshnessDeltaDays = (nowMs - getTimestamp(event.updatedAt)) / DAY_IN_MS
	const freshnessMultiplier = Number.isFinite(freshnessDeltaDays)
		? Math.max(
				MIN_SCORE_MULTIPLIER,
				1 - Math.max(freshnessDeltaDays, 0) / (normalizedWindow * 2)
			)
		: 1

	const finalMultiplier = recencyMultiplier * 0.65 + freshnessMultiplier * 0.35
	const score = baseScore * finalMultiplier

	return Number(score.toFixed(2))
}
