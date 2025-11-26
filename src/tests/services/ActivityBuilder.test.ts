import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
    buildCreateEventActivity,
    buildUpdateEventActivity,
    buildDeleteEventActivity,
    buildFollowActivity,
    buildAcceptActivity,
    buildLikeActivity,
    buildUndoActivity,
    buildAttendingActivity,
    buildNotAttendingActivity,
    buildMaybeAttendingActivity,
    buildCreateCommentActivity,
    buildDeleteCommentActivity,
    buildUpdateProfileActivity,
} from '../../services/ActivityBuilder.js'
import { ActivityType, ObjectType, PUBLIC_COLLECTION } from '../../constants/activitypub.js'
import type { Event, User, Comment } from '@prisma/client'

// Mock dependencies
vi.mock('../../lib/activitypubHelpers.js', () => ({
    getBaseUrl: vi.fn(() => 'http://localhost:3000'),
}))

describe('ActivityBuilder', () => {
    const mockUser: User = {
        id: 'user_123',
        username: 'alice',
        name: 'Alice Smith',
        email: 'alice@example.com',
        bio: null,
        profileImage: 'https://example.com/avatar.jpg',
        headerImage: null,
        displayColor: '#3b82f6',
        publicKey: '-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        isRemote: false,
        externalActorUrl: null,
        inboxUrl: null,
        sharedInboxUrl: null,
    } as User

    const mockEvent: Event & { user: User | null } = {
        id: 'event_123',
        title: 'Test Event',
        summary: 'Test event summary',
        location: 'Test Location',
        headerImage: 'https://example.com/event.jpg',
        url: 'https://example.com/meet',
        startTime: new Date('2024-12-01T10:00:00Z'),
        endTime: new Date('2024-12-01T11:00:00Z'),
        duration: 'PT1H',
        eventStatus: 'EventScheduled',
        eventAttendanceMode: 'MixedEventAttendanceMode',
        maximumAttendeeCapacity: 50,
        userId: 'user_123',
        attributedTo: 'http://localhost:3000/users/alice',
        externalId: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        user: mockUser,
    } as Event & { user: User | null }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('buildCreateEventActivity', () => {
        it('should build a Create activity for an event', () => {
            const activity = buildCreateEventActivity(mockEvent, 'user_123')

            expect(activity).toMatchObject({
                '@context': expect.any(Array),
                type: ActivityType.CREATE,
                actor: 'http://localhost:3000/users/alice',
                published: mockEvent.createdAt.toISOString(),
                to: [PUBLIC_COLLECTION],
                cc: ['http://localhost:3000/users/alice/followers'],
                object: {
                    type: ObjectType.EVENT,
                    id: 'http://localhost:3000/events/event_123',
                    name: 'Test Event',
                    summary: 'Test event summary',
                    startTime: mockEvent.startTime.toISOString(),
                    endTime: mockEvent.endTime?.toISOString(),
                    location: 'Test Location',
                    url: 'https://example.com/meet',
                    attributedTo: 'http://localhost:3000/users/alice',
                    eventStatus: 'EventScheduled',
                    eventAttendanceMode: 'MixedEventAttendanceMode',
                    maximumAttendeeCapacity: 50,
                },
            })
        })

        it('should handle optional fields', () => {
            const eventWithoutOptional: Event & { user: User | null } = {
                ...mockEvent,
                summary: null,
                location: null,
                headerImage: null,
                url: null,
                endTime: null,
                duration: null,
                eventStatus: null,
                eventAttendanceMode: null,
                maximumAttendeeCapacity: null,
            }

            const activity = buildCreateEventActivity(eventWithoutOptional, 'user_123')

            expect(activity.object.summary).toBeUndefined()
            expect(activity.object.location).toBeUndefined()
            expect(activity.object.url).toBeUndefined()
            expect(activity.object.endTime).toBeUndefined()
            expect(activity.object.duration).toBeUndefined()
            expect(activity.object.eventStatus).toBeUndefined()
            expect(activity.object.eventAttendanceMode).toBeUndefined()
            expect(activity.object.maximumAttendeeCapacity).toBeUndefined()
            expect(activity.object.attachment).toBeUndefined()
        })

        it('should include attachment when headerImage is present', () => {
            const activity = buildCreateEventActivity(mockEvent, 'user_123')

            expect(activity.object.attachment).toEqual([
                {
                    type: ObjectType.IMAGE,
                    url: 'https://example.com/event.jpg',
                },
            ])
        })
    })

    describe('buildUpdateEventActivity', () => {
        it('should build an Update activity for an event', () => {
            const activity = buildUpdateEventActivity(mockEvent, 'user_123')

            expect(activity).toMatchObject({
                type: ActivityType.UPDATE,
                actor: 'http://localhost:3000/users/alice',
                object: {
                    type: ObjectType.EVENT,
                    updated: mockEvent.updatedAt.toISOString(),
                },
            })
        })

        it('should generate unique activity ID with timestamp', async () => {
            const activity1 = buildUpdateEventActivity(mockEvent, 'user_123')
            // Wait a bit to ensure different timestamp
            await new Promise(resolve => setTimeout(resolve, 10))
            const activity2 = buildUpdateEventActivity(mockEvent, 'user_123')

            expect(activity1.id).not.toBe(activity2.id)
            expect(activity1.id).toContain('update-')
        })
    })

    describe('buildDeleteEventActivity', () => {
        it('should build a Delete activity for an event', () => {
            const activity = buildDeleteEventActivity('event_123', mockUser)

            expect(activity).toMatchObject({
                type: ActivityType.DELETE,
                actor: 'http://localhost:3000/users/alice',
                object: {
                    type: ObjectType.TOMBSTONE,
                    id: 'http://localhost:3000/events/event_123',
                    formerType: ObjectType.EVENT,
                    deleted: expect.any(String),
                },
            })
        })
    })

    describe('buildFollowActivity', () => {
        it('should build a Follow activity', () => {
            const targetActorUrl = 'https://example.com/users/bob'
            const activity = buildFollowActivity(mockUser, targetActorUrl)

            expect(activity).toMatchObject({
                type: ActivityType.FOLLOW,
                actor: 'http://localhost:3000/users/alice',
                object: targetActorUrl,
                published: expect.any(String),
            })
        })
    })

    describe('buildAcceptActivity', () => {
        it('should build an Accept activity with Follow activity object', () => {
            const followActivity = {
                type: ActivityType.FOLLOW,
                actor: 'https://example.com/users/bob',
                object: 'http://localhost:3000/users/alice',
            }
            const activity = buildAcceptActivity(mockUser, followActivity)

            expect(activity).toMatchObject({
                type: ActivityType.ACCEPT,
                actor: 'http://localhost:3000/users/alice',
                object: followActivity,
            })
        })

        it('should build an Accept activity with string object', () => {
            const followActivityId = 'https://example.com/activities/follow-123'
            const activity = buildAcceptActivity(mockUser, followActivityId)

            expect(activity).toMatchObject({
                type: ActivityType.ACCEPT,
                object: followActivityId,
            })
        })
    })

    describe('buildLikeActivity', () => {
        it('should build a Like activity for a public event', () => {
            const eventUrl = 'http://localhost:3000/events/event_123'
            const eventAuthorUrl = 'http://localhost:3000/users/alice'
            const eventAuthorFollowersUrl = 'http://localhost:3000/users/alice/followers'

            const activity = buildLikeActivity(
                mockUser,
                eventUrl,
                eventAuthorUrl,
                eventAuthorFollowersUrl,
                true
            )

            expect(activity).toMatchObject({
                type: ActivityType.LIKE,
                actor: 'http://localhost:3000/users/alice',
                object: eventUrl,
                to: [eventAuthorUrl],
                cc: expect.arrayContaining([PUBLIC_COLLECTION, eventAuthorFollowersUrl]),
            })
        })

        it('should build a Like activity for a private event', () => {
            const eventUrl = 'http://localhost:3000/events/event_123'
            const eventAuthorUrl = 'http://localhost:3000/users/alice'

            const activity = buildLikeActivity(mockUser, eventUrl, eventAuthorUrl, undefined, false)

            expect(activity).toMatchObject({
                type: ActivityType.LIKE,
                to: [eventAuthorUrl],
                cc: undefined,
            })
        })

        it('should generate unique activity ID', async () => {
            const eventUrl = 'http://localhost:3000/events/event_123'
            const activity1 = buildLikeActivity(mockUser, eventUrl, eventUrl)
            // Wait a bit to ensure different timestamp
            await new Promise(resolve => setTimeout(resolve, 10))
            const activity2 = buildLikeActivity(mockUser, eventUrl, eventUrl)

            expect(activity1.id).not.toBe(activity2.id)
        })
    })

    describe('buildUndoActivity', () => {
        it('should build an Undo activity for a Like', () => {
            const likeActivity = {
                type: ActivityType.LIKE,
                id: 'http://localhost:3000/users/alice/likes/event_123',
                actor: 'http://localhost:3000/users/alice',
                object: 'http://localhost:3000/events/event_123',
                to: ['http://localhost:3000/users/bob'],
                cc: [PUBLIC_COLLECTION],
            }

            const activity = buildUndoActivity(mockUser, likeActivity)

            expect(activity).toMatchObject({
                type: ActivityType.UNDO,
                actor: 'http://localhost:3000/users/alice',
                object: likeActivity,
                to: likeActivity.to,
                cc: likeActivity.cc,
            })
        })

        it('should preserve addressing from original activity', () => {
            const originalActivity = {
                type: ActivityType.FOLLOW,
                id: 'http://localhost:3000/users/alice/follows/123',
                actor: 'http://localhost:3000/users/alice',
                object: 'https://example.com/users/bob',
                to: ['https://example.com/users/bob'],
                cc: undefined,
            }

            const activity = buildUndoActivity(mockUser, originalActivity)

            expect(activity.to).toEqual(originalActivity.to)
            expect(activity.cc).toBeUndefined()
        })
    })

    describe('buildAttendingActivity', () => {
        it('should build an Accept activity for attending', () => {
            const eventUrl = 'http://localhost:3000/events/event_123'
            const eventAuthorUrl = 'http://localhost:3000/users/bob'
            const eventAuthorFollowersUrl = 'http://localhost:3000/users/bob/followers'
            const userFollowersUrl = 'http://localhost:3000/users/alice/followers'

            const activity = buildAttendingActivity(
                mockUser,
                eventUrl,
                eventAuthorUrl,
                eventAuthorFollowersUrl,
                userFollowersUrl,
                true
            )

            expect(activity).toMatchObject({
                type: ActivityType.ACCEPT,
                actor: 'http://localhost:3000/users/alice',
                object: eventUrl,
                to: [eventAuthorUrl],
                cc: expect.arrayContaining([
                    PUBLIC_COLLECTION,
                    eventAuthorFollowersUrl,
                    userFollowersUrl,
                ]),
            })
        })

        it('should handle missing optional URLs', () => {
            const eventUrl = 'http://localhost:3000/events/event_123'
            const eventAuthorUrl = 'http://localhost:3000/users/bob'

            // When isPublic is false and optional URLs are missing, cc should be undefined
            const activity = buildAttendingActivity(mockUser, eventUrl, eventAuthorUrl, undefined, undefined, false)

            expect(activity.to).toEqual([eventAuthorUrl])
            expect(activity.cc).toBeUndefined()
        })
    })

    describe('buildNotAttendingActivity', () => {
        it('should build a Reject activity for not attending', () => {
            const eventUrl = 'http://localhost:3000/events/event_123'
            const eventAuthorUrl = 'http://localhost:3000/users/bob'

            const activity = buildNotAttendingActivity(mockUser, eventUrl, eventAuthorUrl)

            expect(activity).toMatchObject({
                type: ActivityType.REJECT,
                actor: 'http://localhost:3000/users/alice',
                object: eventUrl,
                to: [eventAuthorUrl],
            })
        })
    })

    describe('buildMaybeAttendingActivity', () => {
        it('should build a TentativeAccept activity for maybe attending', () => {
            const eventUrl = 'http://localhost:3000/events/event_123'
            const eventAuthorUrl = 'http://localhost:3000/users/bob'

            const activity = buildMaybeAttendingActivity(mockUser, eventUrl, eventAuthorUrl)

            expect(activity).toMatchObject({
                type: ActivityType.TENTATIVE_ACCEPT,
                actor: 'http://localhost:3000/users/alice',
                object: eventUrl,
                to: [eventAuthorUrl],
            })
        })
    })

    describe('buildCreateCommentActivity', () => {
        it('should build a Create activity for a comment', () => {
            const mockComment: Comment & { author: User; event: Event } = {
                id: 'comment_123',
                content: 'Great event!',
                authorId: 'user_123',
                eventId: 'event_123',
                inReplyToId: null,
                externalId: null,
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-01'),
                author: mockUser,
                event: mockEvent as Event,
            } as Comment & { author: User; event: Event }

            const eventAuthorUrl = 'http://localhost:3000/users/bob'
            const activity = buildCreateCommentActivity(mockComment, eventAuthorUrl)

            expect(activity).toMatchObject({
                type: ActivityType.CREATE,
                actor: 'http://localhost:3000/users/alice',
                object: {
                    type: ObjectType.NOTE,
                    id: 'http://localhost:3000/comments/comment_123',
                    content: 'Great event!',
                    attributedTo: 'http://localhost:3000/users/alice',
                    inReplyTo: expect.stringContaining('/events/event_123'),
                },
            })
        })

        it('should handle reply comments', () => {
            const mockComment: Comment & { author: User; event: Event } = {
                id: 'comment_456',
                content: 'Reply comment',
                authorId: 'user_123',
                eventId: 'event_123',
                inReplyToId: 'comment_123',
                externalId: null,
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-01'),
                author: mockUser,
                event: mockEvent as Event,
            } as Comment & { author: User; event: Event }

            const eventAuthorUrl = 'http://localhost:3000/users/bob'
            const parentCommentAuthorUrl = 'http://localhost:3000/users/charlie'
            const activity = buildCreateCommentActivity(
                mockComment,
                eventAuthorUrl,
                undefined,
                parentCommentAuthorUrl
            )

            expect(activity.to).toContain(eventAuthorUrl)
            expect(activity.to).toContain(parentCommentAuthorUrl)
            expect(activity.object.inReplyTo).toContain('comment_123')
        })
    })

    describe('buildDeleteCommentActivity', () => {
        it('should build a Delete activity for a comment', () => {
            const mockComment: Comment & { author: User; event: Event } = {
                id: 'comment_123',
                content: 'Great event!',
                authorId: 'user_123',
                eventId: 'event_123',
                inReplyToId: null,
                externalId: null,
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-01'),
                author: mockUser,
                event: mockEvent as Event,
            } as Comment & { author: User; event: Event }

            const eventAuthorUrl = 'http://localhost:3000/users/bob'
            const activity = buildDeleteCommentActivity(mockComment, eventAuthorUrl)

            expect(activity).toMatchObject({
                type: ActivityType.DELETE,
                actor: 'http://localhost:3000/users/alice',
                object: {
                    type: ObjectType.TOMBSTONE,
                    id: expect.stringContaining('comment_123'),
                    formerType: ObjectType.NOTE,
                    deleted: expect.any(String),
                },
            })
        })
    })

    describe('buildUpdateProfileActivity', () => {
        it('should build an Update activity for a user profile', () => {
            const activity = buildUpdateProfileActivity(mockUser)

            expect(activity).toMatchObject({
                type: ActivityType.UPDATE,
                actor: 'http://localhost:3000/users/alice',
                to: [PUBLIC_COLLECTION],
                cc: ['http://localhost:3000/users/alice/followers'],
                object: {
                    type: ObjectType.PERSON,
                    id: 'http://localhost:3000/users/alice',
                    preferredUsername: 'alice',
                    name: 'Alice Smith',
                    displayColor: '#3b82f6',
                    icon: {
                        type: ObjectType.IMAGE,
                        url: 'https://example.com/avatar.jpg',
                    },
                    inbox: 'http://localhost:3000/users/alice/inbox',
                    outbox: 'http://localhost:3000/users/alice/outbox',
                    followers: 'http://localhost:3000/users/alice/followers',
                    following: 'http://localhost:3000/users/alice/following',
                    publicKey: {
                        id: 'http://localhost:3000/users/alice#main-key',
                        owner: 'http://localhost:3000/users/alice',
                        publicKeyPem: mockUser.publicKey,
                    },
                    endpoints: {
                        sharedInbox: 'http://localhost:3000/inbox',
                    },
                },
            })
        })

        it('should handle user without optional fields', () => {
            const userWithoutOptional: User = {
                ...mockUser,
                name: null,
                bio: null,
                profileImage: null,
                headerImage: null,
            }

            const activity = buildUpdateProfileActivity(userWithoutOptional)

            expect(activity.object.name).toBe('alice') // Falls back to username
            expect(activity.object.summary).toBeUndefined()
            expect(activity.object.icon).toBeUndefined()
            expect(activity.object.image).toBeUndefined()
        })
    })
})

