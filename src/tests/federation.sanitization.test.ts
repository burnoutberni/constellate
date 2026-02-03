/**
 * Tests for Federation Sanitization
 * Verifies that incoming content is properly sanitized to prevent XSS
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

describe('Federation Sanitization', () => {
    let testUser: any
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000'

    beforeEach(async () => {
        // Clean up processed activities and related data
        await prisma.processedActivity.deleteMany({})
        await prisma.comment.deleteMany({})
        await prisma.event.deleteMany({})
        await prisma.user.deleteMany({})

        // Reset mocks
        vi.clearAllMocks()
        vi.mocked(realtime.broadcast).mockResolvedValue(undefined)
    })

    it('should sanitize Create Event with script in summary and content', async () => {
        const remoteActor = {
            id: 'https://example.com/users/attacker',
            type: 'Person',
            preferredUsername: 'attacker',
            inbox: 'https://example.com/users/attacker/inbox',
        }

        const remoteUser = await prisma.user.create({
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

        const activity = {
            id: 'https://example.com/activities/create-xss-event',
            type: ActivityType.CREATE,
            actor: remoteActor.id,
            object: {
                type: ObjectType.EVENT,
                id: 'https://example.com/events/xss-event',
                name: 'XSS <script>alert(1)</script> Event',
                summary: '<p>Safe</p><script>alert("XSS")</script>',
                content: '<a href="http://evil.com" target="_self">Click me</a>',
                startTime: new Date().toISOString(),
            },
        }

        await handleActivity(activity as any)

        const event = await prisma.event.findFirst({
            where: { externalId: activity.object.id },
        })

        expect(event).toBeTruthy()
        // Name should be plain text and sanitized
        expect(event?.title).toBe('XSS  Event') // Scripts content also stripped by default in sanitizeText?
        // Wait, sanitizeText uses DOMPurify which strips script content by default.
        // My previous test showed: 'Hello World alert(1)' was EXPECTED but 'Hello World ' was RECEIVED.
        // So script content IS stripped.

        // Summary should be HTML but sanitized
        expect(event?.summary).toBe('<p>Safe</p>')

        // Content (mapped to summary in upsertRemoteEventFromObject if summary is missing, but here both exist)
        // Wait, looking at code:
        // summary: eventSummary || eventContent || null,
        // So only one is stored in summary field. Here summary is present.

        // Let's test eventContent usage when summary is missing in another test.
    })

    it('should sanitize Create Note (Comment) with script', async () => {
         const remoteActor = {
            id: 'https://example.com/users/attacker',
            type: 'Person',
            preferredUsername: 'attacker',
            inbox: 'https://example.com/users/attacker/inbox',
        }

        const remoteUser = await prisma.user.create({
            data: {
                username: 'attacker@example.com',
                email: 'attacker@example.com',
                name: 'Attacker',
                isRemote: true,
                externalActorUrl: remoteActor.id,
                inboxUrl: remoteActor.inbox,
            },
        })

        const testEvent = await prisma.event.create({
            data: {
                title: 'Test Event',
                startTime: new Date(),
                externalId: 'https://example.com/events/safe-event',
                userId: remoteUser.id,
            }
        })

        vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor)
        vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue(remoteUser as any)

        const activity = {
            id: 'https://example.com/activities/create-xss-note',
            type: ActivityType.CREATE,
            actor: remoteActor.id,
            object: {
                type: ObjectType.NOTE,
                id: 'https://example.com/comments/xss-note',
                content: 'Nice event <img src=x onerror=alert(1)>',
                inReplyTo: testEvent.externalId,
            },
        }

        await handleActivity(activity as any)

        const comment = await prisma.comment.findFirst({
            where: { externalId: activity.object.id },
        })

        expect(comment).toBeTruthy()
        expect(comment?.content).toBe('Nice event <img src="x">')
        // onerror attribute should be stripped
    })

    it('should enforce secure links in Create Note', async () => {
         const remoteActor = {
            id: 'https://example.com/users/linker',
            type: 'Person',
            preferredUsername: 'linker',
            inbox: 'https://example.com/users/linker/inbox',
        }

        const remoteUser = await prisma.user.create({
            data: {
                username: 'linker@example.com',
                email: 'linker@example.com',
                name: 'Linker',
                isRemote: true,
                externalActorUrl: remoteActor.id,
                inboxUrl: remoteActor.inbox,
            },
        })

        const testEvent = await prisma.event.create({
            data: {
                title: 'Test Event',
                startTime: new Date(),
                externalId: 'https://example.com/events/link-event',
                userId: remoteUser.id,
            }
        })

        vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor)
        vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue(remoteUser as any)

        const activity = {
            id: 'https://example.com/activities/create-link-note',
            type: ActivityType.CREATE,
            actor: remoteActor.id,
            object: {
                type: ObjectType.NOTE,
                id: 'https://example.com/comments/link-note',
                content: '<a href="http://evil.com">Malicious Link</a>',
                inReplyTo: testEvent.externalId,
            },
        }

        await handleActivity(activity as any)

        const comment = await prisma.comment.findFirst({
            where: { externalId: activity.object.id },
        })

        expect(comment).toBeTruthy()
        expect(comment?.content).toContain('target="_blank"')
        expect(comment?.content).toContain('rel="noopener noreferrer"')
    })

    it('should sanitize Update Person with script in bio', async () => {
        const remoteUser = await prisma.user.create({
            data: {
                username: 'updatexss@example.com',
                email: 'updatexss@example.com',
                name: 'Original Name',
                bio: 'Original bio',
                isRemote: true,
                externalActorUrl: 'https://example.com/users/updatexss',
            },
        })

        const activity = {
            id: 'https://example.com/activities/update-profile-xss',
            type: ActivityType.UPDATE,
            actor: 'https://example.com/users/updatexss',
            object: {
                type: ObjectType.PERSON,
                id: 'https://example.com/users/updatexss',
                preferredUsername: 'updatexss',
                name: 'XSS <script>alert(1)</script> Name',
                summary: '<b>Bold</b><script>alert("bio")</script>',
            },
        }

        await handleActivity(activity as any)

        const updatedUser = await prisma.user.findUnique({
            where: { id: remoteUser.id },
        })

        expect(updatedUser?.name).toBe('XSS  Name') // script and content stripped
        expect(updatedUser?.bio).toBe('<b>Bold</b>') // script stripped, bold kept
    })
})
