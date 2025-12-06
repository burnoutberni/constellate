import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Event as PrismaEvent, User } from '@prisma/client'

vi.mock('../lib/eventVisibility.js', () => ({
    canUserViewEvent: vi.fn(),
}))

vi.mock('../lib/prisma.js', () => ({
    prisma: {
        eventLike: {
            findMany: vi.fn(),
        },
        eventAttendance: {
            findMany: vi.fn(),
        },
        comment: {
            findMany: vi.fn(),
        },
        event: {
            findMany: vi.fn(),
        },
        user: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
        },
    },
}))

import { __testExports, type FeedActivity } from '../activity.js'
import { prisma } from '../lib/prisma.js'
import { canUserViewEvent } from '../lib/eventVisibility.js'

const {
    buildEventSummary,
    filterVisibleActivities,
    resolveActorUser,
    resolveFollowedUserIds,
    fetchLikeActivities,
    fetchRsvpActivities,
    fetchCommentActivities,
    fetchNewEventActivities,
} = __testExports

type VisibilityTarget = Parameters<typeof canUserViewEvent>[0]

function buildTestActivity(id: string): FeedActivity {
    const timestamp = new Date().toISOString()
    return {
        id,
        type: 'like',
        createdAt: timestamp,
        user: null,
        event: {
            id: `event-${id}`,
            title: 'Sample',
            startTime: timestamp,
            location: null,
            user: {
                id: 'owner',
                username: 'owner',
                name: 'Owner',
                displayColor: '#000000',
            },
        },
    }
}

describe('activity helpers', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        process.env.BETTER_AUTH_URL = 'http://localhost:3000'
    })

    it('buildEventSummary formats date fields', () => {
        const date = new Date('2024-01-01T12:00:00Z')
        const summary = buildEventSummary({
            id: 'event-1',
            title: 'Hello',
            startTime: date,
            location: 'Somewhere',
            user: { id: 'user-1', username: 'alice', name: 'Alice', displayColor: '#fff' },
        })

        expect(summary).toEqual({
            id: 'event-1',
            title: 'Hello',
            startTime: date.toISOString(),
            location: 'Somewhere',
            user: { id: 'user-1', username: 'alice', name: 'Alice', displayColor: '#fff' },
        })
    })

    it('filterVisibleActivities filters using canUserViewEvent', async () => {
        const visibleEvent = { visibility: 'PUBLIC', userId: 'owner' } as VisibilityTarget
        const hiddenEvent = { visibility: 'PRIVATE', userId: 'owner' } as VisibilityTarget
        const records = [
            { id: 'keep', event: visibleEvent },
            { id: 'hide', event: hiddenEvent },
        ]

        vi.mocked(canUserViewEvent)
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce(false)

        const result = await filterVisibleActivities(
            records,
            'viewer',
            (record) => record.event,
            (record) => buildTestActivity(record.id)
        )

        expect(result).toHaveLength(1)
        expect(result[0].id).toBe('keep')
        expect(canUserViewEvent).toHaveBeenCalledTimes(2)
    })

    it('resolveActorUser handles local and remote actors', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: 'local-user', username: 'alice', name: 'Alice', createdAt: new Date(), updatedAt: new Date(), email: null, emailVerified: false, displayColor: '#fff', bio: null, profileImage: null, headerImage: null, isRemote: false, externalActorUrl: null, autoAcceptFollowers: false } as User)
        vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({ id: 'remote-user', username: 'bob', name: 'Bob', createdAt: new Date(), updatedAt: new Date(), email: null, emailVerified: false, displayColor: '#fff', bio: null, profileImage: null, headerImage: null, isRemote: true, externalActorUrl: 'https://remote.example/users/bob', autoAcceptFollowers: false } as User)

        const local = await resolveActorUser('http://localhost:3000/users/alice', 'http://localhost:3000')
        const remote = await resolveActorUser('https://remote.example/users/bob', 'http://localhost:3000')

        expect(local?.id).toBe('local-user')
        expect(remote?.id).toBe('remote-user')
    })

    it('resolveFollowedUserIds resolves ids from actor URLs', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: 'local-id', username: 'alice', name: 'Alice', createdAt: new Date(), updatedAt: new Date(), email: null, emailVerified: false, displayColor: '#fff', bio: null, profileImage: null, headerImage: null, isRemote: false, externalActorUrl: null, autoAcceptFollowers: false } as User)
        vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({ id: 'remote-id', username: 'bob', name: 'Bob', createdAt: new Date(), updatedAt: new Date(), email: null, emailVerified: false, displayColor: '#fff', bio: null, profileImage: null, headerImage: null, isRemote: true, externalActorUrl: 'https://remote.example/users/bob', autoAcceptFollowers: false } as User)

        const ids = await resolveFollowedUserIds([
            { actorUrl: 'http://localhost:3000/users/alice' },
            { actorUrl: 'https://remote.example/users/bob' },
        ])

        expect(ids).toEqual(['local-id', 'remote-id'])
    })

    it('fetchLikeActivities filters by visibility', async () => {
        const createdAt = new Date('2024-01-01T00:00:00Z')
        const mockEvent = {
            id: 'event-1',
            title: 'Event',
            startTime: createdAt,
            location: null,
            user: { id: 'owner', username: 'owner', name: 'Owner', displayColor: '#000' },
        } as PrismaEvent & { user: FeedActivity['event']['user'] }

        vi.mocked(prisma.eventLike.findMany).mockResolvedValue([
            {
                id: 'like-1',
                createdAt,
                user: { id: 'u1', username: 'alice', name: 'Alice', displayColor: '#fff', profileImage: null },
                event: mockEvent,
            },
        ] as unknown as Awaited<ReturnType<typeof prisma.eventLike.findMany>>)
        vi.mocked(canUserViewEvent).mockResolvedValueOnce(true)

        const activities = await fetchLikeActivities(['u1'], 'viewer')
        expect(activities).toHaveLength(1)
        expect(activities[0].type).toBe('like')
    })

    it('fetchRsvpActivities filters hidden events', async () => {
        const createdAt = new Date('2024-01-01T00:00:00Z')
        const mockEvent = {
            id: 'event-1',
            title: 'Event',
            startTime: createdAt,
            location: null,
            user: { id: 'owner', username: 'owner', name: 'Owner', displayColor: '#000' },
        } as PrismaEvent & { user: FeedActivity['event']['user'] }

        vi.mocked(prisma.eventAttendance.findMany).mockResolvedValue([
            {
                id: 'rsvp-1',
                createdAt,
                status: 'attending',
                user: { id: 'u1', username: 'alice', name: 'Alice', displayColor: '#fff', profileImage: null },
                event: mockEvent,
            },
        ] as unknown as Awaited<ReturnType<typeof prisma.eventAttendance.findMany>>)
        vi.mocked(canUserViewEvent).mockResolvedValueOnce(false)

        const activities = await fetchRsvpActivities(['u1'], 'viewer')
        expect(activities).toHaveLength(0)
    })

    it('fetchCommentActivities returns comment payloads', async () => {
        const createdAt = new Date('2024-01-01T00:00:00Z')
        const mockEvent = {
            id: 'event-1',
            title: 'Event',
            startTime: createdAt,
            location: null,
            user: { id: 'owner', username: 'owner', name: 'Owner', displayColor: '#000' },
        } as PrismaEvent & { user: FeedActivity['event']['user'] }

        vi.mocked(prisma.comment.findMany).mockResolvedValue([
            {
                id: 'comment-1',
                createdAt,
                content: 'Great event',
                author: { id: 'u1', username: 'alice', name: 'Alice', displayColor: '#fff', profileImage: null },
                event: mockEvent,
            },
        ] as unknown as Awaited<ReturnType<typeof prisma.comment.findMany>>)
        vi.mocked(canUserViewEvent).mockResolvedValueOnce(true)

        const activities = await fetchCommentActivities(['u1'], 'viewer')
        expect(activities).toHaveLength(1)
        expect(activities[0].type).toBe('comment')
        expect(activities[0].data?.commentContent).toBe('Great event')
    })

    it('fetchNewEventActivities returns creator events', async () => {
        const createdAt = new Date('2024-01-01T00:00:00Z')
        vi.mocked(prisma.event.findMany).mockResolvedValue([
            {
                id: 'event-1',
                createdAt,
                title: 'Launch',
                startTime: createdAt,
                location: null,
                user: { id: 'owner', username: 'owner', name: 'Owner', displayColor: '#000', profileImage: null },
            },
        ] as unknown as Awaited<ReturnType<typeof prisma.event.findMany>>)
        vi.mocked(canUserViewEvent).mockResolvedValueOnce(true)

        const activities = await fetchNewEventActivities(['owner'], 'viewer')
        expect(activities).toHaveLength(1)
        expect(activities[0].type).toBe('event_created')
    })
})
