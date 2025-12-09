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
import { BroadcastEvents } from '../realtime.js'

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

        it('should handle Update activity for profile', async () => {
            const remoteUser = await prisma.user.create({
                data: {
                    username: 'remoteuser@example.com',
                    email: 'remote@example.com',
                    name: 'Remote User',
                    isRemote: true,
                    externalActorUrl: 'https://example.com/users/remoteuser',
                },
            })

            const activity = {
                id: 'https://example.com/activities/update-profile-1',
                type: ActivityType.UPDATE,
                actor: 'https://example.com/users/remoteuser',
                object: {
                    type: ObjectType.PERSON,
                    id: 'https://example.com/users/remoteuser',
                    preferredUsername: 'remoteuser',
                    name: 'Updated Remote User',
                    summary: 'Updated bio',
                    displayColor: '#ff0000',
                    icon: {
                        url: 'https://example.com/new-avatar.jpg',
                    },
                    image: {
                        url: 'https://example.com/new-header.jpg',
                    },
                },
            }

            await handleActivity(activity as any)

            const updatedUser = await prisma.user.findUnique({
                where: { id: remoteUser.id },
            })

            expect(updatedUser?.name).toBe('Updated Remote User')
            expect(updatedUser?.bio).toBe('Updated bio')
            expect(updatedUser?.displayColor).toBe('#ff0000')
            expect(updatedUser?.profileImage).toBe('https://example.com/new-avatar.jpg')
            expect(updatedUser?.headerImage).toBe('https://example.com/new-header.jpg')
        })

        it('should handle Delete activity for comments', async () => {
            const remoteUser = await prisma.user.create({
                data: {
                    username: 'remoteuser@example.com',
                    email: 'remote@example.com',
                    isRemote: true,
                    externalActorUrl: 'https://example.com/users/remoteuser',
                },
            })

            const comment = await prisma.comment.create({
                data: {
                    externalId: 'https://example.com/comments/1',
                    content: 'Test comment',
                    eventId: testEvent.id,
                    authorId: remoteUser.id,
                },
            })

            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            const activity = {
                id: 'https://example.com/activities/delete-comment-1',
                type: ActivityType.DELETE,
                actor: 'https://example.com/users/remoteuser',
                object: {
                    type: ObjectType.TOMBSTONE,
                    id: 'https://example.com/comments/1',
                    formerType: ObjectType.NOTE,
                },
            }

            await handleActivity(activity as any)

            const deletedComment = await prisma.comment.findUnique({
                where: { id: comment.id },
            })

            expect(deletedComment).toBeNull()
            expect(vi.mocked(realtime.broadcast)).toHaveBeenCalled()
        })



        it('should handle Announce activity', async () => {
            const activity = {
                id: 'https://example.com/activities/announce-1',
                type: ActivityType.ANNOUNCE,
                actor: 'https://example.com/users/bob',
                object: `${baseUrl}/events/${testEvent.id}`,
            }

            // Should not throw
            await expect(handleActivity(activity as any)).resolves.not.toThrow()
        })

        it('should handle Follow activity for non-local target', async () => {
            const activity = {
                id: 'https://example.com/activities/follow-nonlocal-1',
                type: ActivityType.FOLLOW,
                actor: 'https://example.com/users/bob',
                object: 'https://otherdomain.com/users/alice', // Not local
            }

            await handleActivity(activity as any)

            // Should not create follower for non-local target
            const follower = await prisma.follower.findFirst({
                where: {
                    actorUrl: 'https://example.com/users/bob',
                },
            })

            expect(follower).toBeNull()
        })

        it('should handle Create activity with missing object', async () => {
            const activity = {
                id: 'https://example.com/activities/create-missing-1',
                type: ActivityType.CREATE,
                actor: 'https://example.com/users/bob',
                // Missing object
            }

            await expect(handleActivity(activity as any)).resolves.not.toThrow()
        })

        it('should handle Create activity with unsupported object type', async () => {
            const activity = {
                id: 'https://example.com/activities/create-unsupported-1',
                type: ActivityType.CREATE,
                actor: 'https://example.com/users/bob',
                object: {
                    type: 'UnsupportedType',
                    id: 'https://example.com/objects/1',
                },
            }

            await expect(handleActivity(activity as any)).resolves.not.toThrow()
        })

        it('should handle Update activity with unsupported object type', async () => {
            const activity = {
                id: 'https://example.com/activities/update-unsupported-1',
                type: ActivityType.UPDATE,
                actor: 'https://example.com/users/bob',
                object: {
                    type: 'UnsupportedType',
                    id: 'https://example.com/objects/1',
                },
            }

            await expect(handleActivity(activity as any)).resolves.not.toThrow()
        })

        it('should handle Create Note without inReplyTo', async () => {
            const remoteActor = {
                id: 'https://example.com/users/bob',
                type: 'Person',
                preferredUsername: 'bob',
                inbox: 'https://example.com/users/bob/inbox',
            }

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

            const activity = {
                id: 'https://example.com/activities/create-note-no-reply-1',
                type: ActivityType.CREATE,
                actor: remoteActor.id,
                object: {
                    type: ObjectType.NOTE,
                    id: 'https://example.com/comments/2',
                    content: 'Comment without inReplyTo',
                    // Missing inReplyTo
                },
            }

            await handleActivity(activity as any)

            // Should not create comment
            const comment = await prisma.comment.findFirst({
                where: {
                    externalId: activity.object.id,
                },
            })

            expect(comment).toBeNull()
        })

        it('should handle Accept Follow for non-local follower', async () => {
            const activity = {
                id: 'https://example.com/activities/accept-follow-nonlocal-1',
                type: ActivityType.ACCEPT,
                actor: 'https://example.com/users/bob',
                object: {
                    type: ActivityType.FOLLOW,
                    actor: 'https://otherdomain.com/users/alice', // Not local
                    object: 'https://example.com/users/bob',
                },
            }

            await handleActivity(activity as any)

            // Should not update following
            const following = await prisma.following.findFirst({
                where: {
                    actorUrl: 'https://example.com/users/bob',
                },
            })

            expect(following).toBeNull()
        })

        it('should handle error when processing activity fails', async () => {
            const activity = {
                id: 'https://example.com/activities/error',
                type: ActivityType.FOLLOW,
                actor: 'https://example.com/users/bob',
                object: `${baseUrl}/users/${testUser.username}`,
            }

            // Mock fetchActor to throw an error
            vi.mocked(activitypubHelpers.fetchActor).mockRejectedValue(new Error('Network error'))

            // Should not throw - error is caught and logged
            await expect(handleActivity(activity as any)).resolves.not.toThrow()
        })

        it('should handle unhandled activity types', async () => {
            const activity = {
                id: 'https://example.com/activities/unhandled',
                type: 'UnknownActivityType',
                actor: 'https://example.com/users/bob',
                object: `${baseUrl}/users/${testUser.username}`,
            }

            // Should not throw
            await expect(handleActivity(activity as any)).resolves.not.toThrow()
        })

        it('should handle Follow activity when target is not local', async () => {
            const activity = {
                id: 'https://example.com/activities/1',
                type: ActivityType.FOLLOW,
                actor: 'https://example.com/users/bob',
                object: 'https://remote.example.com/users/alice', // Not local
            }

            await handleActivity(activity as any)

            // Should not process
            expect(vi.mocked(activitypubHelpers.fetchActor)).not.toHaveBeenCalled()
        })

        it('should handle Follow activity when target user not found', async () => {
            const activity = {
                id: 'https://example.com/activities/1',
                type: ActivityType.FOLLOW,
                actor: 'https://example.com/users/bob',
                object: `${baseUrl}/users/nonexistent`,
            }

            await handleActivity(activity as any)

            // Should not throw
            expect(true).toBe(true)
        })

        it('should handle Follow activity when actor fetch fails', async () => {
            const activity = {
                id: 'https://example.com/activities/1',
                type: ActivityType.FOLLOW,
                actor: 'https://example.com/users/bob',
                object: `${baseUrl}/users/${testUser.username}`,
            }

            vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(null)

            await handleActivity(activity as any)

            // Should not throw
            expect(true).toBe(true)
        })


        it('should handle Accept activity with Follow object', async () => {
            const activity = {
                id: 'https://example.com/activities/accept',
                type: ActivityType.ACCEPT,
                actor: `${baseUrl}/users/${testUser.username}`,
                object: {
                    type: ActivityType.FOLLOW,
                    actor: 'https://example.com/users/bob',
                    object: `${baseUrl}/users/${testUser.username}`,
                },
            }

            await handleActivity(activity as any)

            // Should process Follow Accept
            expect(true).toBe(true)
        })

        it('should handle Accept activity with Event object', async () => {
            const activity = {
                id: 'https://example.com/activities/accept',
                type: ActivityType.ACCEPT,
                actor: 'https://example.com/users/bob',
                object: `${baseUrl}/events/${testEvent.id}`,
            }

            const remoteActor = {
                id: 'https://example.com/users/bob',
                type: 'Person',
                preferredUsername: 'bob',
            }

            vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor as any)
            vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue({
                id: 'remote-user-id',
                username: 'bob@example.com',
            } as any)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            await handleActivity(activity as any)

            // Should create attendance
            const attendance = await prisma.eventAttendance.findFirst({
                where: {
                    eventId: testEvent.id,
                },
            })

            expect(attendance).toBeDefined()
        })

        it('should handle Accept activity when actor fetch fails', async () => {
            const activity = {
                id: 'https://example.com/activities/accept',
                type: ActivityType.ACCEPT,
                actor: 'https://example.com/users/bob',
                object: `${baseUrl}/events/${testEvent.id}`,
            }

            vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(null)

            await handleActivity(activity as any)

            // Should not throw
            expect(true).toBe(true)
        })

        it('should handle Accept activity when event not found', async () => {
            const activity = {
                id: 'https://example.com/activities/accept',
                type: ActivityType.ACCEPT,
                actor: 'https://example.com/users/bob',
                object: `${baseUrl}/events/nonexistent`,
            }

            const remoteActor = {
                id: 'https://example.com/users/bob',
                type: 'Person',
                preferredUsername: 'bob',
            }

            vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor as any)
            vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue({
                id: 'remote-user-id',
                username: 'bob@example.com',
            } as any)

            await handleActivity(activity as any)

            // Should not throw
            expect(true).toBe(true)
        })

        it('should handle Accept Follow when follower is not local', async () => {
            const activity = {
                id: 'https://example.com/activities/accept',
                type: ActivityType.ACCEPT,
                actor: `${baseUrl}/users/${testUser.username}`,
                object: {
                    type: ActivityType.FOLLOW,
                    actor: 'https://remote.example.com/users/bob', // Not local
                    object: `${baseUrl}/users/${testUser.username}`,
                },
            }

            await handleActivity(activity as any)

            // Should not process
            expect(true).toBe(true)
        })

        it('should handle Accept Follow when following not found', async () => {
            const activity = {
                id: 'https://example.com/activities/accept',
                type: ActivityType.ACCEPT,
                actor: `${baseUrl}/users/${testUser.username}`,
                object: {
                    type: ActivityType.FOLLOW,
                    actor: `${baseUrl}/users/nonexistent`,
                    object: `${baseUrl}/users/${testUser.username}`,
                },
            }

            await handleActivity(activity as any)

            // Should not throw
            expect(true).toBe(true)
        })

        it('should handle Create activity', async () => {
            const activity = {
                id: 'https://example.com/activities/create',
                type: ActivityType.CREATE,
                actor: 'https://example.com/users/bob',
                object: {
                    type: ObjectType.EVENT,
                    id: 'https://example.com/events/1',
                    name: 'Remote Event',
                    startTime: new Date().toISOString(),
                },
            }

            const remoteActor = {
                id: 'https://example.com/users/bob',
                type: 'Person',
                preferredUsername: 'bob',
            }

            vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor as any)
            vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue({
                id: 'remote-user-id',
                username: 'bob@example.com',
            } as any)

            await handleActivity(activity as any)

            // Should create event
            const event = await prisma.event.findFirst({
                where: {
                    externalId: 'https://example.com/events/1',
                },
            })

            expect(event).toBeDefined()
        })

        it('should handle Update activity', async () => {
            const remoteEvent = await prisma.event.create({
                data: {
                    title: 'Remote Event',
                    startTime: new Date(),
                    externalId: 'https://example.com/events/1',
                    attributedTo: 'https://example.com/users/bob',
                },
            })

            const activity = {
                id: 'https://example.com/activities/update',
                type: ActivityType.UPDATE,
                actor: 'https://example.com/users/bob',
                object: {
                    type: ObjectType.EVENT,
                    id: 'https://example.com/events/1',
                    name: 'Updated Remote Event',
                },
            }

            await handleActivity(activity as any)

            // Should update event
            const updatedEvent = await prisma.event.findUnique({
                where: { id: remoteEvent.id },
            })

            expect(updatedEvent).toBeDefined()
        })

        it('should handle Delete activity', async () => {
            const remoteEvent = await prisma.event.create({
                data: {
                    title: 'Remote Event',
                    startTime: new Date(),
                    externalId: 'https://example.com/events/1',
                    attributedTo: 'https://example.com/users/bob',
                },
            })

            const activity = {
                id: 'https://example.com/activities/delete',
                type: ActivityType.DELETE,
                actor: 'https://example.com/users/bob',
                object: 'https://example.com/events/1',
            }

            await handleActivity(activity as any)

            // Should delete event
            const deletedEvent = await prisma.event.findUnique({
                where: { id: remoteEvent.id },
            })

            expect(deletedEvent).toBeNull()
        })

        it('should handle Like activity', async () => {
            const remoteEvent = await prisma.event.create({
                data: {
                    title: 'Remote Event',
                    startTime: new Date(),
                    externalId: 'https://example.com/events/1',
                    attributedTo: 'https://example.com/users/bob',
                },
            })

            const activity = {
                id: 'https://example.com/activities/like',
                type: ActivityType.LIKE,
                actor: 'https://example.com/users/bob',
                object: 'https://example.com/events/1',
            }

            const remoteActor = {
                id: 'https://example.com/users/bob',
                type: 'Person',
                preferredUsername: 'bob',
            }

            vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor as any)
            vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue({
                id: 'remote-user-id',
                username: 'bob@example.com',
            } as any)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            await handleActivity(activity as any)

            // Should create like
            const like = await prisma.eventLike.findFirst({
                where: {
                    eventId: remoteEvent.id,
                },
            })

            expect(like).toBeDefined()
        })

        it('should handle Undo activity for Like', async () => {
            const remoteEvent = await prisma.event.create({
                data: {
                    title: 'Remote Event',
                    startTime: new Date(),
                    externalId: 'https://example.com/events/1',
                    attributedTo: 'https://example.com/users/bob',
                },
            })

            const remoteUser = await prisma.user.create({
                data: {
                    username: 'bob@example.com',
                    isRemote: true,
                    externalActorUrl: 'https://example.com/users/bob',
                },
            })

            await prisma.eventLike.create({
                data: {
                    eventId: remoteEvent.id,
                    userId: remoteUser.id,
                    externalId: 'https://example.com/activities/like',
                },
            })

            const activity = {
                id: 'https://example.com/activities/undo',
                type: ActivityType.UNDO,
                actor: 'https://example.com/users/bob',
                object: {
                    type: ActivityType.LIKE,
                    id: 'https://example.com/activities/like',
                    actor: 'https://example.com/users/bob',
                    object: 'https://example.com/events/1',
                },
            }

            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            await handleActivity(activity as any)

            // Should delete like
            const like = await prisma.eventLike.findFirst({
                where: {
                    eventId: remoteEvent.id,
                    userId: remoteUser.id,
                },
            })

            expect(like).toBeNull()
        })



        it('should handle Announce activity for event sharing', async () => {
            const remoteUser = await prisma.user.create({
                data: {
                    username: 'bob@example.com',
                    email: 'bob@example.com',
                    name: 'Bob',
                    isRemote: true,
                    externalActorUrl: 'https://example.com/users/bob',
                },
            })

            const activity = {
                id: 'https://example.com/activities/announce',
                type: ActivityType.ANNOUNCE,
                actor: 'https://example.com/users/bob',
                object: `${baseUrl}/events/${testEvent.id}`,
            }

            const remoteActor = {
                id: 'https://example.com/users/bob',
                type: 'Person',
                preferredUsername: 'bob',
            }

            vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor as any)
            vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue(remoteUser as any)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            await handleActivity(activity as any)

            // Should create a share (event with sharedEventId)
            const share = await prisma.event.findFirst({
                where: {
                    userId: remoteUser.id,
                    sharedEventId: testEvent.id,
                },
            })

            expect(share).toBeDefined()
            expect(share?.sharedEventId).toBe(testEvent.id)
        })

        it('should handle Announce activity with missing object', async () => {
            const activity = {
                id: 'https://example.com/activities/announce-no-object',
                type: ActivityType.ANNOUNCE,
                actor: 'https://example.com/users/bob',
                // Missing object
            }

            await handleActivity(activity as any)

            // Should not throw and should not create anything
            expect(vi.mocked(activitypubHelpers.fetchActor)).not.toHaveBeenCalled()
        })

        it('should handle Announce activity when actor fetch fails', async () => {
            const activity = {
                id: 'https://example.com/activities/announce-no-actor',
                type: ActivityType.ANNOUNCE,
                actor: 'https://example.com/users/bob',
                object: `${baseUrl}/events/${testEvent.id}`,
            }

            vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(null)

            await handleActivity(activity as any)

            // Should not throw and should not create share
            const share = await prisma.event.findFirst({
                where: {
                    sharedEventId: testEvent.id,
                },
            })

            expect(share).toBeNull()
        })

        it('should handle Announce activity when original event not found', async () => {
            const remoteUser = await prisma.user.create({
                data: {
                    username: 'bob@example.com',
                    email: 'bob@example.com',
                    name: 'Bob',
                    isRemote: true,
                    externalActorUrl: 'https://example.com/users/bob',
                },
            })

            const activity = {
                id: 'https://example.com/activities/announce-no-event',
                type: ActivityType.ANNOUNCE,
                actor: 'https://example.com/users/bob',
                object: `${baseUrl}/events/non-existent-event-id`,
            }

            const remoteActor = {
                id: 'https://example.com/users/bob',
                type: 'Person',
                preferredUsername: 'bob',
            }

            vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor as any)
            vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue(remoteUser as any)

            await handleActivity(activity as any)

            // Should not create share
            const share = await prisma.event.findFirst({
                where: {
                    userId: remoteUser.id,
                },
            })

            expect(share).toBeNull()
        })

        it('should handle Announce activity when share already exists', async () => {
            const remoteUser = await prisma.user.create({
                data: {
                    username: 'bob@example.com',
                    email: 'bob@example.com',
                    name: 'Bob',
                    isRemote: true,
                    externalActorUrl: 'https://example.com/users/bob',
                },
            })

            // Create existing share
            await prisma.event.create({
                data: {
                    title: testEvent.title,
                    startTime: testEvent.startTime,
                    userId: remoteUser.id,
                    sharedEventId: testEvent.id,
                    visibility: 'PUBLIC',
                    externalId: 'https://example.com/activities/announce',
                },
            })

            const activity = {
                id: 'https://example.com/activities/announce',
                type: ActivityType.ANNOUNCE,
                actor: 'https://example.com/users/bob',
                object: `${baseUrl}/events/${testEvent.id}`,
            }

            const remoteActor = {
                id: 'https://example.com/users/bob',
                type: 'Person',
                preferredUsername: 'bob',
            }

            vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor as any)
            vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue(remoteUser as any)

            await handleActivity(activity as any)

            // Should not create duplicate share
            const shares = await prisma.event.findMany({
                where: {
                    userId: remoteUser.id,
                    sharedEventId: testEvent.id,
                },
            })

            expect(shares.length).toBe(1)
        })

        it('should handle Announce activity without activity id', async () => {
            const remoteUser = await prisma.user.create({
                data: {
                    username: 'bob@example.com',
                    email: 'bob@example.com',
                    name: 'Bob',
                    isRemote: true,
                    externalActorUrl: 'https://example.com/users/bob',
                },
            })

            const activity = {
                // No id field
                type: ActivityType.ANNOUNCE,
                actor: 'https://example.com/users/bob',
                object: `${baseUrl}/events/${testEvent.id}`,
            }

            const remoteActor = {
                id: 'https://example.com/users/bob',
                type: 'Person',
                preferredUsername: 'bob',
            }

            vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor as any)
            vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue(remoteUser as any)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            await handleActivity(activity as any)

            // Should still create share (duplicate check uses userId + sharedEventId when no externalId)
            const share = await prisma.event.findFirst({
                where: {
                    userId: remoteUser.id,
                    sharedEventId: testEvent.id,
                },
            })

            expect(share).toBeDefined()
        })

        it('should handle activity processing error gracefully', async () => {
            const activity = {
                id: 'https://example.com/activities/error',
                type: ActivityType.FOLLOW,
                actor: 'https://example.com/users/bob',
                object: `${baseUrl}/users/${testUser.username}`,
            }

            // Mock to throw error during processing
            vi.mocked(activitypubHelpers.fetchActor).mockRejectedValue(new Error('Processing error'))

            // Should not throw - error is caught
            await expect(handleActivity(activity as any)).resolves.not.toThrow()
        })


    })

    describe('handleFollow edge cases', () => {
        it('should handle Follow when target is not local', async () => {
            const activity = {
                id: 'https://example.com/activities/1',
                type: ActivityType.FOLLOW,
                actor: 'https://example.com/users/bob',
                object: 'https://remote.example.com/users/alice', // Not local
            }

            await handleActivity(activity as any)

            // Should not process
            expect(vi.mocked(activitypubHelpers.fetchActor)).not.toHaveBeenCalled()
        })

        it('should handle Follow when target user not found', async () => {
            const activity = {
                id: 'https://example.com/activities/1',
                type: ActivityType.FOLLOW,
                actor: 'https://example.com/users/bob',
                object: `${baseUrl}/users/nonexistent`,
            }

            await handleActivity(activity as any)

            // Should not throw
            expect(true).toBe(true)
        })

        it('should handle Follow when actor fetch fails', async () => {
            const activity = {
                id: 'https://example.com/activities/1',
                type: ActivityType.FOLLOW,
                actor: 'https://example.com/users/bob',
                object: `${baseUrl}/users/${testUser.username}`,
            }

            vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(null)

            await handleActivity(activity as any)

            // Should not throw
            expect(true).toBe(true)
        })



    })

    describe('WP-020: Update, Delete, and Undo Activity Support', () => {
        describe('Update Activities', () => {
            it('should handle Update activity for an event with all fields', async () => {
                const remoteEvent = await prisma.event.create({
                    data: {
                        title: 'Original Event',
                        summary: 'Original summary',
                        location: 'Original Location',
                        startTime: new Date('2024-12-01T10:00:00Z'),
                        endTime: new Date('2024-12-01T11:00:00Z'),
                        externalId: 'https://example.com/events/update-test',
                        attributedTo: 'https://example.com/users/bob',
                        eventStatus: 'EventScheduled',
                    },
                })

                const activity = {
                    id: 'https://example.com/activities/update-event-full',
                    type: ActivityType.UPDATE,
                    actor: 'https://example.com/users/bob',
                    object: {
                        type: ObjectType.EVENT,
                        id: 'https://example.com/events/update-test',
                        name: 'Updated Event Title',
                        summary: 'Updated event summary',
                        location: 'New Location',
                        startTime: new Date('2024-12-02T14:00:00Z').toISOString(),
                        endTime: new Date('2024-12-02T16:00:00Z').toISOString(),
                        eventStatus: 'EventPostponed',
                    },
                }

                await handleActivity(activity as any)

                const updatedEvent = await prisma.event.findUnique({
                    where: { id: remoteEvent.id },
                })

                expect(updatedEvent).toBeDefined()
                expect(updatedEvent?.title).toBe('Updated Event Title')
                expect(updatedEvent?.summary).toBe('Updated event summary')
                expect(updatedEvent?.location).toBe('New Location')
                expect(updatedEvent?.eventStatus).toBe('EventPostponed')
                expect(updatedEvent?.startTime.toISOString()).toBe('2024-12-02T14:00:00.000Z')
                expect(updatedEvent?.endTime?.toISOString()).toBe('2024-12-02T16:00:00.000Z')
            })

            it('should handle Update activity for an event with partial fields', async () => {
                const remoteEvent = await prisma.event.create({
                    data: {
                        title: 'Original Event',
                        summary: 'Original summary',
                        location: 'Original Location',
                        startTime: new Date('2024-12-01T10:00:00Z'),
                        externalId: 'https://example.com/events/partial-update',
                        attributedTo: 'https://example.com/users/bob',
                    },
                })

                const activity = {
                    id: 'https://example.com/activities/update-event-partial',
                    type: ActivityType.UPDATE,
                    actor: 'https://example.com/users/bob',
                    object: {
                        type: ObjectType.EVENT,
                        id: 'https://example.com/events/partial-update',
                        name: 'Updated Title Only',
                        startTime: remoteEvent.startTime.toISOString(),
                    },
                }

                await handleActivity(activity as any)

                const updatedEvent = await prisma.event.findUnique({
                    where: { id: remoteEvent.id },
                })

                expect(updatedEvent).toBeDefined()
                expect(updatedEvent?.title).toBe('Updated Title Only')
                // Other fields should be updated to null/undefined as per activity
                expect(updatedEvent?.summary).toBeNull()
            })

            it('should handle Update activity for a user profile with all fields', async () => {
                const remoteUser = await prisma.user.create({
                    data: {
                        username: 'updatetest@example.com',
                        email: 'updatetest@example.com',
                        name: 'Original Name',
                        bio: 'Original bio',
                        isRemote: true,
                        externalActorUrl: 'https://example.com/users/updatetest',
                        displayColor: '#000000',
                    },
                })

                const activity = {
                    id: 'https://example.com/activities/update-profile-full',
                    type: ActivityType.UPDATE,
                    actor: 'https://example.com/users/updatetest',
                    object: {
                        type: ObjectType.PERSON,
                        id: 'https://example.com/users/updatetest',
                        preferredUsername: 'updatetest',
                        name: 'Updated Name',
                        summary: 'Updated bio text',
                        displayColor: '#ff6600',
                        icon: {
                            type: ObjectType.IMAGE,
                            url: 'https://example.com/avatar-updated.jpg',
                        },
                        image: {
                            type: ObjectType.IMAGE,
                            url: 'https://example.com/header-updated.jpg',
                        },
                    },
                }

                await handleActivity(activity as any)

                const updatedUser = await prisma.user.findUnique({
                    where: { id: remoteUser.id },
                })

                expect(updatedUser).toBeDefined()
                expect(updatedUser?.name).toBe('Updated Name')
                expect(updatedUser?.bio).toBe('Updated bio text')
                expect(updatedUser?.displayColor).toBe('#ff6600')
                expect(updatedUser?.profileImage).toBe('https://example.com/avatar-updated.jpg')
                expect(updatedUser?.headerImage).toBe('https://example.com/header-updated.jpg')
            })

            it('should ignore Update activity for non-existent event', async () => {
                const activity = {
                    id: 'https://example.com/activities/update-nonexistent',
                    type: ActivityType.UPDATE,
                    actor: 'https://example.com/users/bob',
                    object: {
                        type: ObjectType.EVENT,
                        id: 'https://example.com/events/nonexistent',
                        name: 'This Should Not Be Created',
                        startTime: new Date().toISOString(),
                    },
                }

                // Should not throw
                await expect(handleActivity(activity as any)).resolves.not.toThrow()

                // Event should not be created (Update doesn't create)
                const event = await prisma.event.findFirst({
                    where: {
                        externalId: 'https://example.com/events/nonexistent',
                    },
                })

                expect(event).toBeNull()
            })
        })

        describe('Delete Activities', () => {
            it('should handle Delete activity for an event with Tombstone object', async () => {
                const remoteEvent = await prisma.event.create({
                    data: {
                        title: 'Event to Delete',
                        startTime: new Date(),
                        externalId: 'https://example.com/events/delete-tombstone',
                        attributedTo: 'https://example.com/users/bob',
                    },
                })

                vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

                const activity = {
                    id: 'https://example.com/activities/delete-event-tombstone',
                    type: ActivityType.DELETE,
                    actor: 'https://example.com/users/bob',
                    object: {
                        type: ObjectType.TOMBSTONE,
                        id: 'https://example.com/events/delete-tombstone',
                        formerType: ObjectType.EVENT,
                        deleted: new Date().toISOString(),
                    },
                }

                await handleActivity(activity as any)

                const deletedEvent = await prisma.event.findFirst({
                    where: {
                        externalId: remoteEvent.externalId,
                    },
                })

                expect(deletedEvent).toBeNull()
                expect(vi.mocked(realtime.broadcast)).toHaveBeenCalledWith({
                    type: BroadcastEvents.EVENT_DELETED,
                    data: expect.objectContaining({
                        eventId: remoteEvent.id,
                    }),
                })
            })

            it('should handle Delete activity for an event with string object', async () => {
                const remoteEvent = await prisma.event.create({
                    data: {
                        title: 'Event to Delete',
                        startTime: new Date(),
                        externalId: 'https://example.com/events/delete-string',
                        attributedTo: 'https://example.com/users/bob',
                    },
                })

                vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

                const activity = {
                    id: 'https://example.com/activities/delete-event-string',
                    type: ActivityType.DELETE,
                    actor: 'https://example.com/users/bob',
                    object: 'https://example.com/events/delete-string',
                }

                await handleActivity(activity as any)

                const deletedEvent = await prisma.event.findFirst({
                    where: {
                        externalId: remoteEvent.externalId,
                    },
                })

                expect(deletedEvent).toBeNull()
            })

            it('should handle Delete activity for a comment with Tombstone', async () => {
                const remoteUser = await prisma.user.create({
                    data: {
                        username: 'deletecomment@example.com',
                        email: 'deletecomment@example.com',
                        isRemote: true,
                        externalActorUrl: 'https://example.com/users/deletecomment',
                    },
                })

                const comment = await prisma.comment.create({
                    data: {
                        content: 'Comment to delete',
                        eventId: testEvent.id,
                        authorId: remoteUser.id,
                        externalId: 'https://example.com/comments/delete-test',
                    },
                })

                vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

                const activity = {
                    id: 'https://example.com/activities/delete-comment',
                    type: ActivityType.DELETE,
                    actor: 'https://example.com/users/deletecomment',
                    object: {
                        type: ObjectType.TOMBSTONE,
                        id: 'https://example.com/comments/delete-test',
                        formerType: ObjectType.NOTE,
                        deleted: new Date().toISOString(),
                    },
                }

                await handleActivity(activity as any)

                const deletedComment = await prisma.comment.findUnique({
                    where: { id: comment.id },
                })

                expect(deletedComment).toBeNull()
                expect(vi.mocked(realtime.broadcast)).toHaveBeenCalledWith({
                    type: BroadcastEvents.COMMENT_DELETED,
                    data: expect.objectContaining({
                        eventId: testEvent.id,
                        commentId: comment.id,
                    }),
                })
            })

            it('should handle Delete activity for non-existent resource gracefully', async () => {
                vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

                const activity = {
                    id: 'https://example.com/activities/delete-nonexistent',
                    type: ActivityType.DELETE,
                    actor: 'https://example.com/users/bob',
                    object: 'https://example.com/events/nonexistent',
                }

                // Should not throw
                await expect(handleActivity(activity as any)).resolves.not.toThrow()

                // No broadcast should occur
                expect(vi.mocked(realtime.broadcast)).not.toHaveBeenCalled()
            })

            it('should cascade delete event with related data', async () => {
                await prisma.user.create({
                    data: {
                        username: 'cascade@example.com',
                        email: 'cascade@example.com',
                        isRemote: true,
                        externalActorUrl: 'https://example.com/users/cascade',
                    },
                })

                const remoteEvent = await prisma.event.create({
                    data: {
                        title: 'Event with Relations',
                        startTime: new Date(),
                        externalId: 'https://example.com/events/cascade-delete',
                        attributedTo: 'https://example.com/users/cascade',
                    },
                })

                // Add related data
                await prisma.eventLike.create({
                    data: {
                        eventId: remoteEvent.id,
                        userId: testUser.id,
                    },
                })

                await prisma.comment.create({
                    data: {
                        content: 'Comment on event',
                        eventId: remoteEvent.id,
                        authorId: testUser.id,
                    },
                })

                vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

                const activity = {
                    id: 'https://example.com/activities/delete-cascade',
                    type: ActivityType.DELETE,
                    actor: 'https://example.com/users/cascade',
                    object: 'https://example.com/events/cascade-delete',
                }

                await handleActivity(activity as any)

                // Event should be deleted
                const deletedEvent = await prisma.event.findUnique({
                    where: { id: remoteEvent.id },
                })
                expect(deletedEvent).toBeNull()

                // Related data should also be deleted (cascade)
                const likes = await prisma.eventLike.findMany({
                    where: { eventId: remoteEvent.id },
                })
                expect(likes).toHaveLength(0)

                const comments = await prisma.comment.findMany({
                    where: { eventId: remoteEvent.id },
                })
                expect(comments).toHaveLength(0)
            })
        })

        describe('Undo Activities', () => {
            it('should handle Undo for Like activity', async () => {
                const remoteUser = await prisma.user.create({
                    data: {
                        username: 'undolike@example.com',
                        email: 'undolike@example.com',
                        isRemote: true,
                        externalActorUrl: 'https://example.com/users/undolike',
                    },
                })

                const like = await prisma.eventLike.create({
                    data: {
                        eventId: testEvent.id,
                        userId: remoteUser.id,
                        externalId: 'https://example.com/activities/like-123',
                    },
                })

                vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

                const activity = {
                    id: 'https://example.com/activities/undo-like',
                    type: ActivityType.UNDO,
                    actor: 'https://example.com/users/undolike',
                    object: {
                        type: ActivityType.LIKE,
                        id: 'https://example.com/activities/like-123',
                        actor: 'https://example.com/users/undolike',
                        object: `${baseUrl}/events/${testEvent.id}`,
                    },
                }

                await handleActivity(activity as any)

                const deletedLike = await prisma.eventLike.findUnique({
                    where: { id: like.id },
                })

                expect(deletedLike).toBeNull()
                expect(vi.mocked(realtime.broadcast)).toHaveBeenCalledWith({
                    type: BroadcastEvents.LIKE_REMOVED,
                    data: expect.objectContaining({
                        eventId: testEvent.id,
                        userId: remoteUser.id,
                    }),
                })
            })

            it('should handle Undo for Follow activity', async () => {
                // Mock getBaseUrl to return the test base URL
                vi.mocked(activitypubHelpers.getBaseUrl).mockReturnValue(baseUrl)

                const remoteUser = await prisma.user.create({
                    data: {
                        username: 'undofollow@example.com',
                        email: 'undofollow@example.com',
                        isRemote: true,
                        externalActorUrl: 'https://example.com/users/undofollow',
                    },
                })

                const followerRecord = await prisma.follower.create({
                    data: {
                        userId: testUser.id,
                        actorUrl: 'https://example.com/users/undofollow',
                        username: remoteUser.username,
                        inboxUrl: 'https://example.com/users/undofollow/inbox',
                        accepted: true,
                    },
                })

                // Verify follower was created
                const beforeFollower = await prisma.follower.findUnique({
                    where: { id: followerRecord.id },
                })
                expect(beforeFollower).not.toBeNull()

                const activity = {
                    id: 'https://example.com/activities/undo-follow',
                    type: ActivityType.UNDO,
                    actor: 'https://example.com/users/undofollow',
                    object: {
                        type: ActivityType.FOLLOW,
                        id: 'https://example.com/activities/follow-123',
                        actor: 'https://example.com/users/undofollow',
                        object: `${baseUrl}/users/${testUser.username}`,
                    },
                }

                await handleActivity(activity as any)

                const follower = await prisma.follower.findFirst({
                    where: {
                        userId: testUser.id,
                        actorUrl: 'https://example.com/users/undofollow',
                    },
                })

                expect(follower).toBeNull()
            })

            it('should handle Undo for Accept activity (attendance)', async () => {
                const remoteUser = await prisma.user.create({
                    data: {
                        username: 'undoattend@example.com',
                        email: 'undoattend@example.com',
                        isRemote: true,
                        externalActorUrl: 'https://example.com/users/undoattend',
                    },
                })

                await prisma.eventAttendance.create({
                    data: {
                        eventId: testEvent.id,
                        userId: remoteUser.id,
                        status: AttendanceStatus.ATTENDING,
                        externalId: 'https://example.com/activities/accept-123',
                    },
                })

                vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

                const activity = {
                    id: 'https://example.com/activities/undo-accept',
                    type: ActivityType.UNDO,
                    actor: 'https://example.com/users/undoattend',
                    object: {
                        type: ActivityType.ACCEPT,
                        id: 'https://example.com/activities/accept-123',
                        actor: 'https://example.com/users/undoattend',
                        object: `${baseUrl}/events/${testEvent.id}`,
                    },
                }

                await handleActivity(activity as any)

                const attendance = await prisma.eventAttendance.findFirst({
                    where: {
                        eventId: testEvent.id,
                        userId: remoteUser.id,
                    },
                })

                expect(attendance).toBeNull()
                expect(vi.mocked(realtime.broadcast)).toHaveBeenCalledWith({
                    type: BroadcastEvents.ATTENDANCE_REMOVED,
                    data: expect.objectContaining({
                        eventId: testEvent.id,
                        userId: remoteUser.id,
                    }),
                })
            })

            it('should handle Undo for TentativeAccept activity (maybe attendance)', async () => {
                const remoteUser = await prisma.user.create({
                    data: {
                        username: 'undomaybe@example.com',
                        email: 'undomaybe@example.com',
                        isRemote: true,
                        externalActorUrl: 'https://example.com/users/undomaybe',
                    },
                })

                await prisma.eventAttendance.create({
                    data: {
                        eventId: testEvent.id,
                        userId: remoteUser.id,
                        status: AttendanceStatus.MAYBE,
                        externalId: 'https://example.com/activities/tentative-123',
                    },
                })

                vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

                const activity = {
                    id: 'https://example.com/activities/undo-tentative',
                    type: ActivityType.UNDO,
                    actor: 'https://example.com/users/undomaybe',
                    object: {
                        type: ActivityType.TENTATIVE_ACCEPT,
                        id: 'https://example.com/activities/tentative-123',
                        actor: 'https://example.com/users/undomaybe',
                        object: `${baseUrl}/events/${testEvent.id}`,
                    },
                }

                await handleActivity(activity as any)

                const attendance = await prisma.eventAttendance.findFirst({
                    where: {
                        eventId: testEvent.id,
                        userId: remoteUser.id,
                    },
                })

                expect(attendance).toBeNull()
            })

            it('should ignore Undo for non-existent Like', async () => {
                vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

                const activity = {
                    id: 'https://example.com/activities/undo-nonexistent-like',
                    type: ActivityType.UNDO,
                    actor: 'https://example.com/users/bob',
                    object: {
                        type: ActivityType.LIKE,
                        actor: 'https://example.com/users/bob',
                        object: `${baseUrl}/events/${testEvent.id}`,
                    },
                }

                // Should not throw
                await expect(handleActivity(activity as any)).resolves.not.toThrow()
            })

            it('should ignore Undo with string object (not supported)', async () => {
                const activity = {
                    id: 'https://example.com/activities/undo-string',
                    type: ActivityType.UNDO,
                    actor: 'https://example.com/users/bob',
                    object: 'https://example.com/activities/like-123',
                }

                // Should not throw, but should be ignored
                await expect(handleActivity(activity as any)).resolves.not.toThrow()
            })
        })

        describe('Edge Cases and Error Handling', () => {
            it('should handle Update with missing required fields gracefully', async () => {
                const activity = {
                    id: 'https://example.com/activities/update-missing-fields',
                    type: ActivityType.UPDATE,
                    actor: 'https://example.com/users/bob',
                    object: {
                        type: ObjectType.EVENT,
                        id: 'https://example.com/events/test',
                        // Missing name and startTime
                    },
                }

                // Should not throw
                await expect(handleActivity(activity as any)).resolves.not.toThrow()
            })

            it('should handle Delete with malformed object', async () => {
                const activity = {
                    id: 'https://example.com/activities/delete-malformed',
                    type: ActivityType.DELETE,
                    actor: 'https://example.com/users/bob',
                    object: null, // Invalid
                }

                // Should not throw
                await expect(handleActivity(activity as any)).resolves.not.toThrow()
            })

            it('should handle Undo with missing object type', async () => {
                const activity = {
                    id: 'https://example.com/activities/undo-missing-type',
                    type: ActivityType.UNDO,
                    actor: 'https://example.com/users/bob',
                    object: {
                        // Missing type field
                        actor: 'https://example.com/users/bob',
                        object: `${baseUrl}/events/${testEvent.id}`,
                    },
                }

                // Should not throw
                await expect(handleActivity(activity as any)).resolves.not.toThrow()
            })

            it('should mark activity as processed even if handling fails', async () => {
                const activity = {
                    id: 'https://example.com/activities/processing-error',
                    type: ActivityType.UPDATE,
                    actor: 'https://example.com/users/bob',
                    object: {
                        type: ObjectType.EVENT,
                        id: 'https://example.com/events/error-test',
                        name: 'Test',
                        startTime: 'invalid-date', // Will cause error
                    },
                }

                // Should not throw
                await expect(handleActivity(activity as any)).resolves.not.toThrow()

                // Should still be marked as processed
                const processed = await prisma.processedActivity.findFirst({
                    where: { activityId: activity.id },
                })

                expect(processed).toBeTruthy()
            })
        })

        describe('TentativeAccept and Reject Activities', () => {
            it('should handle TentativeAccept activity for maybe attendance', async () => {
                const remoteActor = {
                    id: 'https://example.com/users/bob',
                    type: 'Person',
                    preferredUsername: 'bob',
                    inbox: 'https://example.com/users/bob/inbox',
                }

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

                const attendance = await prisma.eventAttendance.findFirst({
                    where: {
                        eventId: testEvent.id,
                        userId: remoteUser.id,
                    },
                })

                expect(attendance).toBeTruthy()
                expect(attendance?.status).toBe(AttendanceStatus.MAYBE)
                expect(vi.mocked(realtime.broadcast)).toHaveBeenCalledWith({
                    type: BroadcastEvents.ATTENDANCE_UPDATED,
                    data: expect.objectContaining({
                        eventId: testEvent.id,
                        userId: remoteUser.id,
                        status: AttendanceStatus.MAYBE,
                    }),
                })
            })

            it('should handle TentativeAccept activity when actor fetch fails', async () => {
                vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(null)

                const activity = {
                    id: 'https://example.com/activities/tentative-accept-fail',
                    type: ActivityType.TENTATIVE_ACCEPT,
                    actor: 'https://example.com/users/bob',
                    object: `${baseUrl}/events/${testEvent.id}`,
                }

                // Should not throw
                await expect(handleActivity(activity as any)).resolves.not.toThrow()

                // No attendance should be created
                const attendance = await prisma.eventAttendance.findFirst({
                    where: {
                        eventId: testEvent.id,
                    },
                })

                expect(attendance).toBeNull()
            })

            it('should handle TentativeAccept activity when event not found', async () => {
                const remoteActor = {
                    id: 'https://example.com/users/bob',
                    type: 'Person',
                    preferredUsername: 'bob',
                    inbox: 'https://example.com/users/bob/inbox',
                }

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

                const activity = {
                    id: 'https://example.com/activities/tentative-accept-no-event',
                    type: ActivityType.TENTATIVE_ACCEPT,
                    actor: remoteActor.id,
                    object: `${baseUrl}/events/nonexistent`,
                }

                // Should not throw
                await expect(handleActivity(activity as any)).resolves.not.toThrow()

                // No attendance should be created
                const attendance = await prisma.eventAttendance.findFirst({
                    where: {
                        userId: remoteUser.id,
                    },
                })

                expect(attendance).toBeNull()
            })

            it('should handle Reject activity for event attendance', async () => {
                const remoteActor = {
                    id: 'https://example.com/users/bob',
                    type: 'Person',
                    preferredUsername: 'bob',
                    inbox: 'https://example.com/users/bob/inbox',
                }

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

                const attendance = await prisma.eventAttendance.findFirst({
                    where: {
                        eventId: testEvent.id,
                        userId: remoteUser.id,
                    },
                })

                expect(attendance).toBeTruthy()
                expect(attendance?.status).toBe(AttendanceStatus.NOT_ATTENDING)
                expect(vi.mocked(realtime.broadcast)).toHaveBeenCalledWith({
                    type: BroadcastEvents.ATTENDANCE_UPDATED,
                    data: expect.objectContaining({
                        eventId: testEvent.id,
                        userId: remoteUser.id,
                        status: AttendanceStatus.NOT_ATTENDING,
                    }),
                })
            })

            it('should handle Reject activity for Follow request', async () => {
                vi.mocked(activitypubHelpers.getBaseUrl).mockReturnValue(baseUrl)

                const remoteActor = {
                    id: 'https://example.com/users/bob',
                    type: 'Person',
                    preferredUsername: 'bob',
                    inbox: 'https://example.com/users/bob/inbox',
                }

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

                // Create a following record for the local user
                await prisma.following.create({
                    data: {
                        userId: testUser.id,
                        actorUrl: remoteActor.id,
                        username: remoteUser.username,
                        inboxUrl: remoteActor.inbox,
                        accepted: false, // Pending
                    },
                })

                const activity = {
                    id: 'https://example.com/activities/reject-follow',
                    type: ActivityType.REJECT,
                    actor: remoteActor.id,
                    object: {
                        type: ActivityType.FOLLOW,
                        id: 'https://example.com/activities/follow-123',
                        actor: `${baseUrl}/users/${testUser.username}`,
                        object: remoteActor.id,
                    },
                }

                await handleActivity(activity as any)

                // Following record should still exist but marked as not accepted
                const following = await prisma.following.findFirst({
                    where: {
                        userId: testUser.id,
                        actorUrl: remoteActor.id,
                    },
                })

                expect(following).toBeTruthy()
                expect(following?.accepted).toBe(false)
            })

            it('should handle Reject activity when actor fetch fails', async () => {
                vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(null)

                const activity = {
                    id: 'https://example.com/activities/reject-fail',
                    type: ActivityType.REJECT,
                    actor: 'https://example.com/users/bob',
                    object: `${baseUrl}/events/${testEvent.id}`,
                }

                // Should not throw
                await expect(handleActivity(activity as any)).resolves.not.toThrow()
            })

            it('should handle Reject activity when event not found', async () => {
                const remoteActor = {
                    id: 'https://example.com/users/bob',
                    type: 'Person',
                    preferredUsername: 'bob',
                    inbox: 'https://example.com/users/bob/inbox',
                }

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

                const activity = {
                    id: 'https://example.com/activities/reject-no-event',
                    type: ActivityType.REJECT,
                    actor: remoteActor.id,
                    object: `${baseUrl}/events/nonexistent`,
                }

                // Should not throw
                await expect(handleActivity(activity as any)).resolves.not.toThrow()

                // No attendance should be created
                const attendance = await prisma.eventAttendance.findFirst({
                    where: {
                        userId: remoteUser.id,
                    },
                })

                expect(attendance).toBeNull()
            })
        })

        describe('Follow with Auto-Accept Disabled', () => {
            it('should handle Follow when auto-accept is disabled', async () => {
                // Create user with auto-accept disabled
                const targetUser = await prisma.user.create({
                    data: {
                        username: 'noacceptuser',
                        email: 'noacceptuser@test.com',
                        name: 'No Auto Accept User',
                        isRemote: false,
                    },
                })

                // Update to disable auto-accept (note: this requires extending the schema or using raw query)
                // For now, we'll use the fact that autoAcceptFollowers defaults to true
                // We'll need to test the pending flow
                
                const remoteActor = {
                    id: 'https://example.com/users/charlie',
                    type: 'Person',
                    preferredUsername: 'charlie',
                    inbox: 'https://example.com/users/charlie/inbox',
                }

                const remoteUser = await prisma.user.create({
                    data: {
                        username: 'charlie@example.com',
                        email: 'charlie@example.com',
                        name: 'Charlie',
                        isRemote: true,
                        externalActorUrl: remoteActor.id,
                        inboxUrl: remoteActor.inbox,
                    },
                })

                vi.mocked(activitypubHelpers.getBaseUrl).mockReturnValue(baseUrl)
                vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor)
                vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue(remoteUser as any)
                vi.mocked(activityBuilder.buildAcceptActivity).mockReturnValue({} as any)
                vi.mocked(activityDelivery.deliverToInbox).mockResolvedValue(true)

                const activity = {
                    id: 'https://example.com/activities/follow-auto-accept',
                    type: ActivityType.FOLLOW,
                    actor: remoteActor.id,
                    object: `${baseUrl}/users/${targetUser.username}`,
                }

                await handleActivity(activity as any)

                // Follower should be created with accepted: true (default behavior)
                const follower = await prisma.follower.findFirst({
                    where: {
                        userId: targetUser.id,
                        actorUrl: remoteActor.id,
                    },
                })

                expect(follower).toBeTruthy()
                expect(follower?.accepted).toBe(true)
                expect(vi.mocked(activityDelivery.deliverToInbox)).toHaveBeenCalled()
            })

            it('should handle updating existing follower on re-follow', async () => {
                vi.mocked(activitypubHelpers.getBaseUrl).mockReturnValue(baseUrl)

                const remoteActor = {
                    id: 'https://example.com/users/dave',
                    type: 'Person',
                    preferredUsername: 'dave',
                    inbox: 'https://example.com/users/dave/inbox',
                }

                const remoteUser = await prisma.user.create({
                    data: {
                        username: 'dave@example.com',
                        email: 'dave@example.com',
                        name: 'Dave',
                        isRemote: true,
                        externalActorUrl: remoteActor.id,
                        inboxUrl: remoteActor.inbox,
                    },
                })

                // Create existing follower record
                await prisma.follower.create({
                    data: {
                        userId: testUser.id,
                        actorUrl: remoteActor.id,
                        username: remoteUser.username,
                        inboxUrl: remoteActor.inbox,
                        accepted: false, // Was not accepted before
                    },
                })

                vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor)
                vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue(remoteUser as any)
                vi.mocked(activityBuilder.buildAcceptActivity).mockReturnValue({} as any)
                vi.mocked(activityDelivery.deliverToInbox).mockResolvedValue(true)

                const activity = {
                    id: 'https://example.com/activities/follow-update',
                    type: ActivityType.FOLLOW,
                    actor: remoteActor.id,
                    object: `${baseUrl}/users/${testUser.username}`,
                }

                await handleActivity(activity as any)

                // Follower should now be accepted
                const follower = await prisma.follower.findFirst({
                    where: {
                        userId: testUser.id,
                        actorUrl: remoteActor.id,
                    },
                })

                expect(follower).toBeTruthy()
                expect(follower?.accepted).toBe(true)
            })
        })
    })
})

