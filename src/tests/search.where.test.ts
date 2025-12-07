import { describe, it, expect, afterEach, vi } from 'vitest'
import { buildSearchWhereClause } from '../search.js'
import { prisma } from '../lib/prisma.js'

const baseParams = () => ({
    q: undefined,
    location: undefined,
    startDate: undefined,
    endDate: undefined,
    status: undefined,
    mode: undefined,
    username: undefined,
    tags: undefined,
    page: undefined,
    limit: undefined,
})

describe('buildSearchWhereClause', () => {

    afterEach(() => {
        vi.restoreAllMocks()
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
})

