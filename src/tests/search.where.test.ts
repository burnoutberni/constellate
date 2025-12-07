import { describe, it, expect, afterEach, vi } from 'vitest'
import { buildSearchWhereClause } from '../search.js'
import { prisma } from '../lib/prisma.js'

const baseParams = () => ({
    q: undefined,
    location: undefined,
    startDate: undefined,
    endDate: undefined,
    dateRange: undefined,
    status: undefined,
    mode: undefined,
    username: undefined,
    tags: undefined,
    categories: undefined,
    page: undefined,
    limit: undefined,
})

describe('buildSearchWhereClause', () => {

    afterEach(() => {
        vi.restoreAllMocks()
        vi.useRealTimers()
    })

    it('combines text, location, date, status, and mode filters', async () => {
        const startDate = '2025-01-01T10:00:00.000Z'
        const endDate = '2025-01-05T18:30:00.000Z'

        const where = await buildSearchWhereClause({
            ...baseParams(),
            q: 'Jazz',
            location: 'New York',
            startDate,
            endDate,
            status: 'EventScheduled',
            mode: 'OnlineEventAttendanceMode',
        })

        expect(where.OR).toEqual([
            { title: { contains: 'Jazz', mode: 'insensitive' } },
            { summary: { contains: 'Jazz', mode: 'insensitive' } },
        ])
        expect(where.location).toEqual({ contains: 'New York', mode: 'insensitive' })
        expect((where.startTime as { gte?: Date; lte?: Date }).gte?.toISOString()).toBe(startDate)
        expect((where.startTime as { gte?: Date; lte?: Date }).lte?.toISOString()).toBe(endDate)
        expect(where.eventStatus).toBe('EventScheduled')
        expect(where.eventAttendanceMode).toBe('OnlineEventAttendanceMode')
    })

    it('resolves username to userId', async () => {
        const findUniqueSpy = vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
            id: 'user_123',
        } as any)

        const where = await buildSearchWhereClause({
            ...baseParams(),
            username: 'alice',
        })

        expect(findUniqueSpy).toHaveBeenCalledWith({
            where: { username: 'alice' },
        })
        expect(where.userId).toBe('user_123')
    })

    it('throws when username is not found', async () => {
        vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(null)

        await expect(
            buildSearchWhereClause({
                ...baseParams(),
                username: 'missing-user',
            })
        ).rejects.toThrow('User not found: missing-user')
    })

    it('creates tag filters from normalized values', async () => {
        const where = await buildSearchWhereClause({
            ...baseParams(),
            tags: ' Music , Concert ,music',
        })

        expect(where.tags).toEqual({
            some: {
                tag: {
                    in: ['music', 'concert'],
                },
            },
        })
    })

    it('skips tag filters when normalization removes all values', async () => {
        const where = await buildSearchWhereClause({
            ...baseParams(),
            tags: ' , ## , ',
        })

        expect(where.tags).toBeUndefined()
    })

    it('applies preset date range bounds when explicit dates are missing', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2025-03-10T12:00:00.000Z'))

        const where = await buildSearchWhereClause({
            ...baseParams(),
            dateRange: 'next_7_days',
        })

        expect((where.startTime as { gte?: Date })?.gte?.toISOString()).toBe('2025-03-10T00:00:00.000Z')
        expect((where.startTime as { lte?: Date })?.lte?.toISOString()).toBe('2025-03-16T23:59:59.999Z')
    })

    it('prefers explicit date bounds over presets', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2025-03-10T12:00:00.000Z'))

        const where = await buildSearchWhereClause({
            ...baseParams(),
            dateRange: 'today',
            startDate: '2025-05-01T00:00:00.000Z',
            endDate: '2025-05-07T23:59:59.999Z',
        })

        expect((where.startTime as { gte?: Date })?.gte?.toISOString()).toBe('2025-05-01T00:00:00.000Z')
        expect((where.startTime as { lte?: Date })?.lte?.toISOString()).toBe('2025-05-07T23:59:59.999Z')
    })

    it('treats categories as tag aliases and merges them', async () => {
        const where = await buildSearchWhereClause({
            ...baseParams(),
            tags: 'music',
            categories: 'Workshops, MUSIC ',
        })

        expect(where.tags).toEqual({
            some: {
                tag: {
                    in: ['music', 'workshops'],
                },
            },
        })
    })

    it('handles this_weekend on Sunday correctly (returns just Sunday)', async () => {
        vi.useFakeTimers()
        // Set to a Sunday (2025-03-09 is a Sunday)
        vi.setSystemTime(new Date('2025-03-09T12:00:00.000Z'))

        const where = await buildSearchWhereClause({
            ...baseParams(),
            dateRange: 'this_weekend',
        })

        // On Sunday, should return just that Sunday (not next weekend)
        expect((where.startTime as { gte?: Date })?.gte?.toISOString()).toBe('2025-03-09T00:00:00.000Z')
        expect((where.startTime as { lte?: Date })?.lte?.toISOString()).toBe('2025-03-09T23:59:59.999Z')
    })

    it('handles this_weekend on Saturday correctly (returns Saturday and Sunday)', async () => {
        vi.useFakeTimers()
        // Set to a Saturday (2025-03-08 is a Saturday)
        vi.setSystemTime(new Date('2025-03-08T12:00:00.000Z'))

        const where = await buildSearchWhereClause({
            ...baseParams(),
            dateRange: 'this_weekend',
        })

        // On Saturday, should return Saturday and Sunday
        expect((where.startTime as { gte?: Date })?.gte?.toISOString()).toBe('2025-03-08T00:00:00.000Z')
        expect((where.startTime as { lte?: Date })?.lte?.toISOString()).toBe('2025-03-09T23:59:59.999Z')
    })
})

