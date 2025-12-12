import { describe, it, expect } from 'vitest'
import {
	calculateTrendingScore,
	clampTrendingLimit,
	clampTrendingWindowDays,
	DAY_IN_MS,
} from '../lib/trending.js'

describe('trending helpers', () => {
	it('clamps trending limit within supported range', () => {
		expect(clampTrendingLimit(-5)).toBe(1)
		expect(clampTrendingLimit(0)).toBe(1)
		expect(clampTrendingLimit(10)).toBe(10)
		expect(clampTrendingLimit(500)).toBe(50)
		expect(clampTrendingLimit(Number.NaN)).toBe(10)
	})

	it('clamps trending window days within supported range', () => {
		expect(clampTrendingWindowDays(-10)).toBe(1)
		expect(clampTrendingWindowDays(0)).toBe(1)
		expect(clampTrendingWindowDays(5)).toBe(5)
		expect(clampTrendingWindowDays(100)).toBe(30)
		expect(clampTrendingWindowDays(Number.NaN)).toBe(7)
	})

	it('returns zero score when there is no engagement', () => {
		const now = new Date()
		const score = calculateTrendingScore({
			metrics: { likes: 0, comments: 0, attendance: 0 },
			event: {
				startTime: now,
				createdAt: now,
				updatedAt: now,
			},
			windowDays: 7,
			now,
		})
		expect(score).toBe(0)
	})

	it('boosts upcoming events with equal engagement compared to stale events', () => {
		const now = new Date('2025-01-01T12:00:00Z')
		const metrics = { likes: 3, comments: 2, attendance: 4 }

		const upcomingScore = calculateTrendingScore({
			metrics,
			event: {
				startTime: new Date(now.getTime() + DAY_IN_MS * 2),
				createdAt: now,
				updatedAt: now,
			},
			windowDays: 7,
			now,
		})

		const staleScore = calculateTrendingScore({
			metrics,
			event: {
				startTime: new Date(now.getTime() - DAY_IN_MS * 10),
				createdAt: new Date(now.getTime() - DAY_IN_MS * 10),
				updatedAt: new Date(now.getTime() - DAY_IN_MS * 10),
			},
			windowDays: 7,
			now,
		})

		expect(upcomingScore).toBeGreaterThan(staleScore)
	})

	it('handles null/undefined event dates gracefully', () => {
		const now = new Date('2025-01-01T12:00:00Z')
		const metrics = { likes: 5, comments: 3, attendance: 2 }

		// Test with null startTime
		const scoreWithNullStart = calculateTrendingScore({
			metrics,
			event: {
				startTime: null as any,
				createdAt: now,
				updatedAt: now,
			},
			windowDays: 7,
			now,
		})
		expect(scoreWithNullStart).toBeGreaterThan(0)

		// Test with null createdAt
		const scoreWithNullCreated = calculateTrendingScore({
			metrics,
			event: {
				startTime: now,
				createdAt: null as any,
				updatedAt: now,
			},
			windowDays: 7,
			now,
		})
		expect(scoreWithNullCreated).toBeGreaterThan(0)

		// Test with null updatedAt
		const scoreWithNullUpdated = calculateTrendingScore({
			metrics,
			event: {
				startTime: now,
				createdAt: now,
				updatedAt: null as any,
			},
			windowDays: 7,
			now,
		})
		expect(scoreWithNullUpdated).toBeGreaterThan(0)

		// Test with all null dates
		const scoreWithAllNull = calculateTrendingScore({
			metrics,
			event: {
				startTime: null as any,
				createdAt: null as any,
				updatedAt: null as any,
			},
			windowDays: 7,
			now,
		})
		expect(scoreWithAllNull).toBeGreaterThan(0)
	})

	it('handles very high engagement numbers correctly', () => {
		const now = new Date('2025-01-01T12:00:00Z')
		const highMetrics = { likes: 10000, comments: 5000, attendance: 8000 }

		const score = calculateTrendingScore({
			metrics: highMetrics,
			event: {
				startTime: now,
				createdAt: now,
				updatedAt: now,
			},
			windowDays: 7,
			now,
		})

		// Should calculate a valid score without overflow
		expect(score).toBeGreaterThan(0)
		expect(Number.isFinite(score)).toBe(true)
		expect(score).toBeLessThan(Number.MAX_SAFE_INTEGER)

		// Base score should be: 10000*4 + 5000*5 + 8000*3 = 40000 + 25000 + 24000 = 89000
		// With multiplier near 1 for recent events, score should be close to base
		expect(score).toBeGreaterThan(50000)
	})

	it('handles windowDays at min/max boundaries', () => {
		const now = new Date('2025-01-01T12:00:00Z')
		const metrics = { likes: 10, comments: 5, attendance: 8 }

		// Test with minimum windowDays (1)
		const minWindowScore = calculateTrendingScore({
			metrics,
			event: {
				startTime: now,
				createdAt: now,
				updatedAt: now,
			},
			windowDays: 1,
			now,
		})
		expect(minWindowScore).toBeGreaterThan(0)
		expect(Number.isFinite(minWindowScore)).toBe(true)

		// Test with maximum windowDays (30)
		const maxWindowScore = calculateTrendingScore({
			metrics,
			event: {
				startTime: now,
				createdAt: now,
				updatedAt: now,
			},
			windowDays: 30,
			now,
		})
		expect(maxWindowScore).toBeGreaterThan(0)
		expect(Number.isFinite(maxWindowScore)).toBe(true)

		// Scores should be similar for very recent events regardless of window
		expect(Math.abs(minWindowScore - maxWindowScore)).toBeLessThan(100)
	})

	it('verifies final multiplier calculation uses correct weights (65% recency, 35% freshness)', () => {
		const now = new Date('2025-01-01T12:00:00Z')
		const baseMetrics = { likes: 10, comments: 5, attendance: 8 }
		// Base score: 10*4 + 5*5 + 8*3 = 40 + 25 + 24 = 89

		// Create an event that's 1 day old (past startTime, but recently updated)
		const oneDayAgo = new Date(now.getTime() - DAY_IN_MS)
		const recentlyUpdated = new Date(now.getTime() - DAY_IN_MS * 0.5) // Updated 12 hours ago

		const score = calculateTrendingScore({
			metrics: baseMetrics,
			event: {
				startTime: oneDayAgo,
				createdAt: oneDayAgo,
				updatedAt: recentlyUpdated,
			},
			windowDays: 7,
			now,
		})

		// Calculate expected multipliers manually
		const normalizedWindow = 7
		const anchorMs = Math.max(
			oneDayAgo.getTime(),
			recentlyUpdated.getTime(),
			oneDayAgo.getTime()
		)
		const anchorDeltaDays = (now.getTime() - anchorMs) / DAY_IN_MS
		const decayWindow = normalizedWindow * 1.25
		const recencyMultiplier = Math.max(
			0.35,
			1 - Math.min(anchorDeltaDays, decayWindow) / decayWindow
		)

		const freshnessDeltaDays = (now.getTime() - recentlyUpdated.getTime()) / DAY_IN_MS
		const freshnessMultiplier = Math.max(
			0.35,
			1 - Math.max(freshnessDeltaDays, 0) / (normalizedWindow * 2)
		)

		const expectedFinalMultiplier = recencyMultiplier * 0.65 + freshnessMultiplier * 0.35
		const expectedScore = 89 * expectedFinalMultiplier

		// Allow small floating point differences
		expect(Math.abs(score - expectedScore)).toBeLessThan(0.1)

		// Verify that recency has more weight than freshness
		// If we artificially set recency to 1 and freshness to 0.5, final should be 0.65 + 0.175 = 0.825
		// This test verifies the weighting is applied correctly
		expect(score).toBeGreaterThan(0)
	})
})
