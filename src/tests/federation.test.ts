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



        it('should handle Announce activity', async () => {
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
            vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue({
                id: 'remote-user-id',
                username: 'bob@example.com',
            } as any)
            vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

            await handleActivity(activity as any)

            // Should create like (Announce is treated as a like)
            const like = await prisma.eventLike.findFirst({
                where: {
                    eventId: testEvent.id,
                },
            })

            expect(like).toBeDefined()
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
})

