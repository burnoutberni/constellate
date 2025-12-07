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
})
