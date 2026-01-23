/**
 * Security Tests for Federation Handlers
 * Verifies XSS sanitization in ActivityPub processing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { config } from 'dotenv'
config()
import { handleActivity } from '../federation.js'
import { ActivityType, ObjectType } from '../constants/activitypub.js'
import { prisma } from '../lib/prisma.js'
import * as activitypubHelpers from '../lib/activitypubHelpers.js'
import * as realtime from '../realtime.js'

// Mock dependencies
vi.mock('../lib/activitypubHelpers.js')
vi.mock('../services/ActivityBuilder.js')
vi.mock('../services/ActivityDelivery.js')
vi.mock('../realtime.js')

describe('Federation Security (XSS Prevention)', () => {
	const baseUrl = process.env.BASE_URL || 'http://localhost:3000'
    let remoteActor: any
    let remoteUser: any

	beforeEach(async () => {
        // Clean up
		await prisma.processedActivity.deleteMany({})
		await prisma.eventAttendance.deleteMany({})
		await prisma.eventLike.deleteMany({})
		await prisma.comment.deleteMany({})
		await prisma.follower.deleteMany({})
		await prisma.following.deleteMany({})
		await prisma.event.deleteMany({})
		await prisma.user.deleteMany({})

        remoteActor = {
            id: 'https://example.com/users/attacker',
            type: 'Person',
            preferredUsername: 'attacker',
            inbox: 'https://example.com/users/attacker/inbox',
        }

        remoteUser = await prisma.user.create({
            data: {
                username: 'attacker@example.com',
                email: 'attacker@example.com',
                name: 'Attacker',
                isRemote: true,
                externalActorUrl: remoteActor.id,
                inboxUrl: remoteActor.inbox,
            },
        })

        vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor)
        vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue(remoteUser as any)
        vi.mocked(realtime.broadcast).mockResolvedValue(undefined)
	})

    it('should strip script tags from Event title (sanitizeText)', async () => {
        const activity = {
            id: 'https://example.com/activities/create-xss-1',
            type: ActivityType.CREATE,
            actor: remoteActor.id,
            object: {
                type: ObjectType.EVENT,
                id: 'https://example.com/events/xss-1',
                name: 'Malicious Event <script>alert(1)</script>',
                startTime: new Date().toISOString(),
                summary: 'Safe summary',
            },
        }

        await handleActivity(activity as any)

        const event = await prisma.event.findFirst({
            where: { externalId: activity.object.id },
        })

        expect(event).toBeDefined()
        expect(event?.title).toBe('Malicious Event ') // Script tag removed completely
    })

    it('should sanitize HTML in Event summary (sanitizeHtml)', async () => {
        const activity = {
            id: 'https://example.com/activities/create-xss-2',
            type: ActivityType.CREATE,
            actor: remoteActor.id,
            object: {
                type: ObjectType.EVENT,
                id: 'https://example.com/events/xss-2',
                name: 'Safe Title',
                startTime: new Date().toISOString(),
                summary: 'Start <script>alert("xss")</script> <b>Bold</b> End',
            },
        }

        await handleActivity(activity as any)

        const event = await prisma.event.findFirst({
            where: { externalId: activity.object.id },
        })

        expect(event).toBeDefined()
        expect(event?.summary).toBe('Start  <b>Bold</b> End') // Script removed, B preserved
    })

    it('should sanitize HTML in Event content (sanitizeHtml)', async () => {
        const activity = {
            id: 'https://example.com/activities/create-xss-3',
            type: ActivityType.CREATE,
            actor: remoteActor.id,
            object: {
                type: ObjectType.EVENT,
                id: 'https://example.com/events/xss-3',
                name: 'Safe Title',
                startTime: new Date().toISOString(),
                content: '<p>Safe paragraph</p><img src=x onerror=alert(1)>',
            },
        }

        await handleActivity(activity as any)

        const event = await prisma.event.findFirst({
            where: { externalId: activity.object.id },
        })

        expect(event).toBeDefined()
        // img tag is NOT allowed in our config, so it should be stripped
        expect(event?.summary).toBe('<p>Safe paragraph</p>')
    })

    it('should strip HTML from Location name (sanitizeText)', async () => {
         const activity = {
            id: 'https://example.com/activities/create-xss-4',
            type: ActivityType.CREATE,
            actor: remoteActor.id,
            object: {
                type: ObjectType.EVENT,
                id: 'https://example.com/events/xss-4',
                name: 'Safe Title',
                startTime: new Date().toISOString(),
                location: {
                    type: 'Place',
                    name: 'Malicious Location <iframe></iframe>',
                }
            },
        }

        await handleActivity(activity as any)

        const event = await prisma.event.findFirst({
            where: { externalId: activity.object.id },
        })

        expect(event).toBeDefined()
        expect(event?.location).toBe('Malicious Location ')
    })

    it('should sanitize Comment content (sanitizeHtml)', async () => {
         // Create event to comment on
         const event = await prisma.event.create({
             data: {
                 title: 'Test Event',
                 startTime: new Date(),
                 externalId: 'https://example.com/events/test',
             }
         })

         const activity = {
            id: 'https://example.com/activities/create-comment-xss',
            type: ActivityType.CREATE,
            actor: remoteActor.id,
            object: {
                type: ObjectType.NOTE,
                id: 'https://example.com/comments/xss',
                content: '<a href="javascript:alert(1)">Click me</a>',
                inReplyTo: event.externalId,
            },
        }

        await handleActivity(activity as any)

        const comment = await prisma.comment.findFirst({
            where: { externalId: activity.object.id },
        })

        expect(comment).toBeDefined()
        // javascript: protocol should be stripped or tag removed
        expect(comment?.content).not.toContain('javascript:')
    })

    it('should sanitize Profile updates (sanitizeText/Html)', async () => {
         const activity = {
            id: 'https://example.com/activities/update-profile-xss',
            type: ActivityType.UPDATE,
            actor: remoteActor.id,
            object: {
                type: ObjectType.PERSON,
                id: remoteActor.id,
                preferredUsername: 'attacker',
                name: '<b>Bold Name</b>', // Text
                summary: '<script>alert(1)</script>Safe Bio', // Html
            },
        }

        await handleActivity(activity as any)

        const user = await prisma.user.findUnique({
            where: { id: remoteUser.id },
        })

        expect(user?.name).toBe('Bold Name') // Tags stripped
        expect(user?.bio).toBe('Safe Bio') // Script stripped
    })
})
