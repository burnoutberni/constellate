/**
 * Tests for Federation Handlers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { config } from 'dotenv'
config()
import { handleActivity } from '../federation.js'
import { ActivityType, ObjectType, AttendanceStatus } from '../constants/activitypub.js'
import { prisma } from '../lib/prisma.js'
import * as activitypubHelpers from '../lib/activitypubHelpers.js'
import * as activityBuilder from '../services/ActivityBuilder.js'
import * as activityDelivery from '../services/ActivityDelivery.js'
import * as realtime from '../realtime.js'

// Mock dependencies
vi.mock('../lib/activitypubHelpers.js')
vi.mock('../services/ActivityBuilder.js')
vi.mock('../services/ActivityDelivery.js')
vi.mock('../realtime.js')

describe('Federation Handlers', () => {
    let testUser: any
    let testEvent: any
    const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000'

    beforeEach(async () => {
        // Clean up processed activities
        await prisma.processedActivity.deleteMany({})
        await prisma.eventAttendance.deleteMany({})
        await prisma.eventLike.deleteMany({})
        await prisma.comment.deleteMany({})
        await prisma.follower.deleteMany({})
        await prisma.following.deleteMany({})
        await prisma.event.deleteMany({})
        await prisma.user.deleteMany({})

        // Create test user
        testUser = await prisma.user.create({
            data: {
                username: 'alice',
                email: 'alice@test.com',
                name: 'Alice Test',
                isRemote: false,
            },
        })

        // Create test event
        testEvent = await prisma.event.create({
            data: {
                title: 'Test Event',
                startTime: new Date(),
                userId: testUser.id,
                attributedTo: `${baseUrl}/users/${testUser.username}`,
            },
        })

        // Reset mocks
        vi.clearAllMocks()
    })

    describe('handleActivity', () => {
        it('should skip already processed activities', async () => {
            const activity = {
                id: 'https://example.com/activities/1',
                type: ActivityType.FOLLOW,
                actor: 'https://example.com/users/bob',
                object: `${baseUrl}/users/${testUser.username}`,
            }

            // Mark as processed
            await prisma.processedActivity.create({
                data: {
                    activityId: activity.id,
                    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                },
            })

            await handleActivity(activity as any)

            // Should not call any handlers
            expect(vi.mocked(activitypubHelpers.fetchActor)).not.toHaveBeenCalled()
        })

        it('should handle Follow activity', async () => {
            const remoteActor = {
                id: 'https://example.com/users/bob',
                type: 'Person',
                preferredUsername: 'bob',
                inbox: 'https://example.com/users/bob/inbox',
                endpoints: {
                    sharedInbox: 'https://example.com/inbox',
                },
            }

            const remoteUser = {
                id: 'remote-user-id',
                username: 'bob@example.com',
                inboxUrl: 'https://example.com/users/bob/inbox',
                sharedInboxUrl: 'https://example.com/inbox',
            }

            vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor)
            vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue(remoteUser as any)
            vi.mocked(activityBuilder.buildAcceptActivity).mockReturnValue({
                type: ActivityType.ACCEPT,
                actor: `${baseUrl}/users/${testUser.username}`,
                object: {
                    type: ActivityType.FOLLOW,
                    actor: remoteActor.id,
                    object: `${baseUrl}/users/${testUser.username}`,
                },
            } as any)
            vi.mocked(activityDelivery.deliverToInbox).mockResolvedValue(true)

            const activity = {
                id: 'https://example.com/activities/follow-1',
                type: ActivityType.FOLLOW,
                actor: remoteActor.id,
                object: `${baseUrl}/users/${testUser.username}`,
            }

            await handleActivity(activity as any)

            // Verify follower was created
            const follower = await prisma.follower.findFirst({
                where: {
                    userId: testUser.id,
                    actorUrl: remoteActor.id,
                },
            })

            expect(follower).toBeTruthy()
            expect(follower?.accepted).toBe(true)
            expect(vi.mocked(activityDelivery.deliverToInbox)).toHaveBeenCalled()
        })

        it('should handle Accept activity for event attendance', async () => {
            const remoteActor = {
                id: 'https://example.com/users/bob',
                type: 'Person',
                preferredUsername: 'bob',
                inbox: 'https://example.com/users/bob/inbox',
            }

            // Create the remote user in the database first
            const remoteUser = await prisma.user.create({
                data: {
                    username: 'bob@example.com',
                    email: 'bob@example.com',
                    name: 'Bob',
                    isRemote: true,
                    externalActorUrl: remoteActor.id,
                    inboxUrl: remoteActor.inbox,
                },
            })

            vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor)
            vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue(remoteUser as any)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            const activity = {
                id: 'https://example.com/activities/accept-1',
                type: ActivityType.ACCEPT,
                actor: remoteActor.id,
                object: `${baseUrl}/events/${testEvent.id}`,
            }

            await handleActivity(activity as any)

            // Verify attendance was created
            const attendance = await prisma.eventAttendance.findFirst({
                where: {
                    eventId: testEvent.id,
                    userId: remoteUser.id,
                },
            })

            expect(attendance).toBeTruthy()
            expect(attendance?.status).toBe(AttendanceStatus.ATTENDING)
            expect(vi.mocked(realtime.broadcast)).toHaveBeenCalled()
        })

        it('should handle Create activity for events', async () => {
            const remoteActor = {
                id: 'https://example.com/users/bob',
                type: 'Person',
                preferredUsername: 'bob',
                inbox: 'https://example.com/users/bob/inbox',
            }

            // Create the remote user in the database first
            const remoteUser = await prisma.user.create({
                data: {
                    username: 'bob@example.com',
                    email: 'bob@example.com',
                    name: 'Bob',
                    isRemote: true,
                    externalActorUrl: remoteActor.id,
                    inboxUrl: remoteActor.inbox,
                },
            })

            vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor)
            vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue(remoteUser as any)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            const activity = {
                id: 'https://example.com/activities/create-1',
                type: ActivityType.CREATE,
                actor: remoteActor.id,
                object: {
                    type: ObjectType.EVENT,
                    id: 'https://example.com/events/remote-event-1',
                    name: 'Remote Event',
                    startTime: new Date().toISOString(),
                    endTime: new Date(Date.now() + 3600000).toISOString(),
                },
            }

            await handleActivity(activity as any)

            // Verify event was created
            const event = await prisma.event.findFirst({
                where: {
                    externalId: activity.object.id,
                },
            })

            expect(event).toBeTruthy()
            expect(event?.title).toBe('Remote Event')
            expect(event?.attributedTo).toBe(remoteActor.id)
            expect(vi.mocked(realtime.broadcast)).toHaveBeenCalled()
        })

        it('should handle Create activity for comments', async () => {
            const remoteActor = {
                id: 'https://example.com/users/bob',
                type: 'Person',
                preferredUsername: 'bob',
                inbox: 'https://example.com/users/bob/inbox',
            }

            // Create the remote user in the database first
            const remoteUser = await prisma.user.create({
                data: {
                    username: 'bob@example.com',
                    email: 'bob@example.com',
                    name: 'Bob',
                    isRemote: true,
                    externalActorUrl: remoteActor.id,
                    inboxUrl: remoteActor.inbox,
                },
            })

            vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor)
            vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue(remoteUser as any)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            const activity = {
                id: 'https://example.com/activities/create-comment-1',
                type: ActivityType.CREATE,
                actor: remoteActor.id,
                object: {
                    type: ObjectType.NOTE,
                    id: 'https://example.com/comments/1',
                    content: 'This is a comment',
                    inReplyTo: `${baseUrl}/events/${testEvent.id}`,
                },
            }

            await handleActivity(activity as any)

            // Verify comment was created
            const comment = await prisma.comment.findFirst({
                where: {
                    externalId: activity.object.id,
                },
            })

            expect(comment).toBeTruthy()
            expect(comment?.content).toBe('This is a comment')
            expect(comment?.eventId).toBe(testEvent.id)
            expect(vi.mocked(realtime.broadcast)).toHaveBeenCalled()
        })

        it('should handle Update activity for events', async () => {
            const remoteEvent = await prisma.event.create({
                data: {
                    title: 'Remote Event',
                    startTime: new Date(),
                    externalId: 'https://example.com/events/remote-1',
                    attributedTo: 'https://example.com/users/bob',
                },
            })

            const activity = {
                id: 'https://example.com/activities/update-1',
                type: ActivityType.UPDATE,
                actor: 'https://example.com/users/bob',
                object: {
                    type: ObjectType.EVENT,
                    id: remoteEvent.externalId,
                    name: 'Updated Remote Event',
                    startTime: new Date().toISOString(),
                },
            }

            await handleActivity(activity as any)

            // Verify event was updated
            const updatedEvent = await prisma.event.findFirst({
                where: {
                    externalId: remoteEvent.externalId,
                },
            })

            expect(updatedEvent?.title).toBe('Updated Remote Event')
        })

        it('should handle Delete activity for events', async () => {
            const remoteEvent = await prisma.event.create({
                data: {
                    title: 'Remote Event',
                    startTime: new Date(),
                    externalId: 'https://example.com/events/remote-1',
                    attributedTo: 'https://example.com/users/bob',
                },
            })

            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            const activity = {
                id: 'https://example.com/activities/delete-1',
                type: ActivityType.DELETE,
                actor: 'https://example.com/users/bob',
                object: {
                    type: ObjectType.EVENT,
                    id: remoteEvent.externalId,
                },
            }

            await handleActivity(activity as any)

            // Verify event was deleted
            const deletedEvent = await prisma.event.findFirst({
                where: {
                    externalId: remoteEvent.externalId,
                },
            })

            expect(deletedEvent).toBeNull()
            expect(vi.mocked(realtime.broadcast)).toHaveBeenCalled()
        })

        it('should handle Like activity', async () => {
            const remoteActor = {
                id: 'https://example.com/users/bob',
                type: 'Person',
                preferredUsername: 'bob',
                inbox: 'https://example.com/users/bob/inbox',
            }

            // Create the remote user in the database first
            const remoteUser = await prisma.user.create({
                data: {
                    username: 'bob@example.com',
                    email: 'bob@example.com',
                    name: 'Bob',
                    isRemote: true,
                    externalActorUrl: remoteActor.id,
                    inboxUrl: remoteActor.inbox,
                },
            })

            vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor)
            vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue(remoteUser as any)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            const activity = {
                id: 'https://example.com/activities/like-1',
                type: ActivityType.LIKE,
                actor: remoteActor.id,
                object: `${baseUrl}/events/${testEvent.id}`,
            }

            await handleActivity(activity as any)

            // Verify like was created
            const like = await prisma.eventLike.findFirst({
                where: {
                    eventId: testEvent.id,
                    userId: remoteUser.id,
                },
            })

            expect(like).toBeTruthy()
            expect(vi.mocked(realtime.broadcast)).toHaveBeenCalled()
        })

        it('should handle Undo Like activity', async () => {
            const remoteUser = {
                id: 'remote-user-id',
                username: 'bob@example.com',
                externalActorUrl: 'https://example.com/users/bob',
            }

            await prisma.user.create({
                data: remoteUser,
            })

            await prisma.eventLike.create({
                data: {
                    eventId: testEvent.id,
                    userId: remoteUser.id,
                },
            })

            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            const activity = {
                id: 'https://example.com/activities/undo-1',
                type: ActivityType.UNDO,
                actor: remoteUser.externalActorUrl,
                object: {
                    type: ActivityType.LIKE,
                    actor: remoteUser.externalActorUrl,
                    object: `${baseUrl}/events/${testEvent.id}`,
                },
            }

            await handleActivity(activity as any)

            // Verify like was deleted
            const like = await prisma.eventLike.findFirst({
                where: {
                    eventId: testEvent.id,
                    userId: remoteUser.id,
                },
            })

            expect(like).toBeNull()
            expect(vi.mocked(realtime.broadcast)).toHaveBeenCalled()
        })

        it('should handle TentativeAccept activity', async () => {
            const remoteActor = {
                id: 'https://example.com/users/bob',
                type: 'Person',
                preferredUsername: 'bob',
                inbox: 'https://example.com/users/bob/inbox',
            }

            // Create the remote user in the database first
            const remoteUser = await prisma.user.create({
                data: {
                    username: 'bob@example.com',
                    email: 'bob@example.com',
                    name: 'Bob',
                    isRemote: true,
                    externalActorUrl: remoteActor.id,
                    inboxUrl: remoteActor.inbox,
                },
            })

            vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor)
            vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue(remoteUser as any)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            const activity = {
                id: 'https://example.com/activities/tentative-accept-1',
                type: ActivityType.TENTATIVE_ACCEPT,
                actor: remoteActor.id,
                object: `${baseUrl}/events/${testEvent.id}`,
            }

            await handleActivity(activity as any)

            // Verify attendance was created with maybe status
            const attendance = await prisma.eventAttendance.findFirst({
                where: {
                    eventId: testEvent.id,
                    userId: remoteUser.id,
                },
            })

            expect(attendance).toBeTruthy()
            expect(attendance?.status).toBe(AttendanceStatus.MAYBE)
        })

        it('should handle Reject activity', async () => {
            const remoteActor = {
                id: 'https://example.com/users/bob',
                type: 'Person',
                preferredUsername: 'bob',
                inbox: 'https://example.com/users/bob/inbox',
            }

            // Create the remote user in the database first
            const remoteUser = await prisma.user.create({
                data: {
                    username: 'bob@example.com',
                    email: 'bob@example.com',
                    name: 'Bob',
                    isRemote: true,
                    externalActorUrl: remoteActor.id,
                    inboxUrl: remoteActor.inbox,
                },
            })

            vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor)
            vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue(remoteUser as any)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            const activity = {
                id: 'https://example.com/activities/reject-1',
                type: ActivityType.REJECT,
                actor: remoteActor.id,
                object: `${baseUrl}/events/${testEvent.id}`,
            }

            await handleActivity(activity as any)

            // Verify attendance was created with not_attending status
            const attendance = await prisma.eventAttendance.findFirst({
                where: {
                    eventId: testEvent.id,
                    userId: remoteUser.id,
                },
            })

            expect(attendance).toBeTruthy()
            expect(attendance?.status).toBe(AttendanceStatus.NOT_ATTENDING)
        })

        it('should handle unhandled activity types gracefully', async () => {
            const activity = {
                id: 'https://example.com/activities/unknown-1',
                type: 'UnknownActivity',
                actor: 'https://example.com/users/bob',
                object: 'https://example.com/events/1',
            }

            // Should not throw
            await expect(handleActivity(activity as any)).resolves.not.toThrow()
        })

        it('should handle errors gracefully', async () => {
            vi.mocked(activitypubHelpers.fetchActor).mockRejectedValue(new Error('Network error'))

            const activity = {
                id: 'https://example.com/activities/error-1',
                type: ActivityType.FOLLOW,
                actor: 'https://example.com/users/bob',
                object: `${baseUrl}/users/${testUser.username}`,
            }

            // Should not throw, should mark as processed
            await expect(handleActivity(activity as any)).resolves.not.toThrow()

            // Activity should still be marked as processed
            const processed = await prisma.processedActivity.findFirst({
                where: {
                    activityId: activity.id,
                },
            })

            expect(processed).toBeTruthy()
        })
    })
})

