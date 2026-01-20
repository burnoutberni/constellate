import { describe, it, expect, beforeEach, vi } from 'vitest'
import { config } from 'dotenv'
config()
import { handleActivity } from '../federation.js'
import { ActivityType, ObjectType } from '../constants/activitypub.js'
import { prisma } from '../lib/prisma.js'
import * as activitypubHelpers from '../lib/activitypubHelpers.js'
import * as realtime from '../realtime.js'

vi.mock('../lib/activitypubHelpers.js')
vi.mock('../realtime.js')

describe('Federation Security Tests', () => {
    // const baseUrl = process.env.BASE_URL || 'http://localhost:3000'

    beforeEach(async () => {
        await prisma.processedActivity.deleteMany({})
        await prisma.event.deleteMany({})
        await prisma.comment.deleteMany({})
        await prisma.user.deleteMany({})
        vi.clearAllMocks()
    })

    it('should sanitize XSS from Event content and summary', async () => {
        const remoteActor = {
            id: 'https://example.com/users/malicious',
            type: 'Person',
            preferredUsername: 'malicious',
            inbox: 'https://example.com/users/malicious/inbox',
        }

        const remoteUser = await prisma.user.create({
            data: {
                username: 'malicious@example.com',
                email: 'malicious@example.com',
                name: 'Malicious User',
                isRemote: true,
                externalActorUrl: remoteActor.id,
                inboxUrl: remoteActor.inbox,
            },
        })

        vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor)
        vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue(remoteUser as any)
        vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

        const maliciousContent = '<p>Safe content</p><script>alert("XSS")</script><img src=x onerror=alert(1)>'

        const activity = {
            id: 'https://example.com/activities/create-xss-event',
            type: ActivityType.CREATE,
            actor: remoteActor.id,
            object: {
                type: ObjectType.EVENT,
                id: 'https://example.com/events/xss-event',
                name: 'XSS Event <script>alert(1)</script>',
                summary: maliciousContent,
                content: maliciousContent,
                startTime: new Date().toISOString(),
            },
        }

        await handleActivity(activity as any)

        const event = await prisma.event.findFirst({
            where: { externalId: activity.object.id },
        })

        expect(event).toBeTruthy()

        // Verify Title Sanitization (should be plain text)
        expect(event?.title).not.toContain('<script>')
        expect(event?.title).not.toContain('alert(1)') // Assuming script content is removed

        // Verify Content Sanitization (should allow safe tags but remove unsafe)
        expect(event?.summary).toContain('<p>Safe content</p>')
        expect(event?.summary).not.toContain('<script>')
        expect(event?.summary).not.toContain('onerror')
    })

    it('should sanitize XSS from Comment content', async () => {
        const remoteActor = {
            id: 'https://example.com/users/malicious',
            type: 'Person',
            preferredUsername: 'malicious',
            inbox: 'https://example.com/users/malicious/inbox',
        }

        const remoteUser = await prisma.user.create({
            data: {
                username: 'malicious@example.com',
                email: 'malicious@example.com',
                name: 'Malicious User',
                isRemote: true,
                externalActorUrl: remoteActor.id,
                inboxUrl: remoteActor.inbox,
            },
        })

        // Create a parent event
        const event = await prisma.event.create({
            data: {
                title: 'Test Event',
                startTime: new Date(),
                externalId: 'https://example.com/events/test',
                attributedTo: 'https://example.com/users/someone',
            },
        })

        vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor)
        vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue(remoteUser as any)
        vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

        const maliciousContent = 'Nice event! <a href="javascript:alert(1)">Click me</a>'

        const activity = {
            id: 'https://example.com/activities/create-xss-comment',
            type: ActivityType.CREATE,
            actor: remoteActor.id,
            object: {
                type: ObjectType.NOTE,
                id: 'https://example.com/comments/xss',
                content: maliciousContent,
                inReplyTo: event.externalId,
            },
        }

        await handleActivity(activity as any)

        const comment = await prisma.comment.findFirst({
            where: { externalId: activity.object.id },
        })

        expect(comment).toBeTruthy()
        expect(comment?.content).not.toContain('javascript:')
        expect(comment?.content).toContain('Nice event!')
    })
})
