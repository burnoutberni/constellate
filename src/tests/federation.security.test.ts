
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

describe('Security: ActivityPub Sanitization', () => {
	const baseUrl = process.env.BASE_URL || 'http://localhost:3000'

	beforeEach(async () => {
		// Clean up
		await prisma.processedActivity.deleteMany({})
		await prisma.event.deleteMany({})
		await prisma.user.deleteMany({})
		await prisma.comment.deleteMany({})
		vi.clearAllMocks()
	})

	it('should sanitize HTML in incoming event creation', async () => {
		const remoteActor = {
			id: 'https://example.com/users/hacker',
			type: 'Person',
			preferredUsername: 'hacker',
			inbox: 'https://example.com/users/hacker/inbox',
		}

		const remoteUser = await prisma.user.create({
			data: {
				username: 'hacker@example.com',
				email: 'hacker@example.com',
				name: 'Hacker',
				isRemote: true,
				externalActorUrl: remoteActor.id,
				inboxUrl: remoteActor.inbox,
			},
		})

		vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor)
		vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue(remoteUser as any)
		vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

		const activity = {
			id: 'https://example.com/activities/create-xss-1',
			type: ActivityType.CREATE,
			actor: remoteActor.id,
			object: {
				type: ObjectType.EVENT,
				id: 'https://example.com/events/xss-event-1',
				name: 'Safe Title <script>alert(1)</script>',
				summary: 'Summary with <img src=x onerror=alert(1)>',
				content: '<p>Content with <a href="javascript:alert(1)">bad link</a></p>',
				startTime: new Date().toISOString(),
				endTime: new Date(Date.now() + 3600000).toISOString(),
			},
		}

		await handleActivity(activity as any)

		const event = await prisma.event.findFirst({
			where: { externalId: activity.object.id },
		})

		expect(event).toBeTruthy()
		// Current behavior (vulnerable): HTML is preserved
		// Expected behavior (secured): HTML is stripped or sanitized
        // For now, I expect it to FAIL if I assert it is sanitized, confirming the vulnerability.
		expect(event?.title).toBe('Safe Title ')
        // Note: sanitizeText strips ALL tags, so "Safe Title <script>alert(1)</script>" becomes "Safe Title " (content of script tag is also removed by dompurify usually if configured, but let's see)
        // Actually dompurify default behavior removes script tags and their content.
        // If sanitizeText uses empty allowed tags, it strips all tags.
	})

    it('should sanitize HTML in incoming comments', async () => {
        const remoteActor = {
			id: 'https://example.com/users/hacker',
			type: 'Person',
			preferredUsername: 'hacker',
			inbox: 'https://example.com/users/hacker/inbox',
		}

        const remoteUser = await prisma.user.create({
			data: {
				username: 'hacker@example.com',
				email: 'hacker@example.com',
				name: 'Hacker',
				isRemote: true,
				externalActorUrl: remoteActor.id,
				inboxUrl: remoteActor.inbox,
			},
		})

        const event = await prisma.event.create({
			data: {
				title: 'Test Event',
				startTime: new Date(),
				externalId: 'https://example.com/events/1',
			},
		})

        vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor)
		vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue(remoteUser as any)

        const activity = {
				id: 'https://example.com/activities/create-comment-xss',
				type: ActivityType.CREATE,
				actor: remoteActor.id,
				object: {
					type: ObjectType.NOTE,
					id: 'https://example.com/comments/xss-1',
					content: 'Comment with <script>alert("xss")</script>',
					inReplyTo: event.externalId,
				},
			}

        await handleActivity(activity as any)

        const comment = await prisma.comment.findFirst({
            where: { externalId: activity.object.id }
        })

        expect(comment).toBeTruthy()
        expect(comment?.content).toBe('Comment with ')
    })
})
