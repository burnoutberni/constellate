import { describe, it, expect, beforeEach, vi } from 'vitest'
import { config } from 'dotenv'
config()
import { handleActivity } from '../federation.js'
import { ActivityType, ObjectType } from '../constants/activitypub.js'
import { prisma } from '../lib/prisma.js'
import * as activitypubHelpers from '../lib/activitypubHelpers.js'
import * as realtime from '../realtime.js'
import * as instanceHelpers from '../lib/instanceHelpers.js'

// Mock dependencies
vi.mock('../lib/activitypubHelpers.js')
vi.mock('../services/ActivityBuilder.js')
vi.mock('../services/ActivityDelivery.js')
vi.mock('../realtime.js')
vi.mock('../lib/instanceHelpers.js')

describe('Federation Security (XSS Prevention)', () => {
	const baseUrl = process.env.BASE_URL || 'http://localhost:3000'

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

		// Reset mocks
		vi.clearAllMocks()
	})

	it('should sanitize HTML in Event summary', async () => {
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
		vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

		const xssPayload = '<script>alert("XSS")</script>'
		const safeContent = 'This is safe content'

		const activity = {
			id: 'https://example.com/activities/create-xss-event',
			type: ActivityType.CREATE,
			actor: remoteActor.id,
			object: {
				type: ObjectType.EVENT,
				id: 'https://example.com/events/xss-event',
				name: 'XSS Event',
				summary: `${safeContent}${xssPayload}`,
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
		// Without sanitization, this will contain the script tag
		// We expect this to fail initially if sanitization is missing
        // Or if it passes, it means we have a vulnerability to fix.
        // I'll assert that it SHOULD NOT contain script tags.
		expect(event?.summary).not.toContain('<script>')
		expect(event?.summary).toContain(safeContent)
	})

    it('should sanitize HTML in Comment content', async () => {
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

        // Create an event to comment on
        const testEvent = await prisma.event.create({
            data: {
                title: 'Test Event',
                startTime: new Date(),
                userId: remoteUser.id,
            }
        })

		vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor)
		vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue(remoteUser as any)
		vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

        const xssPayload = '<img src=x onerror=alert(1)>'
        const safeContent = 'Comment content'

		const activity = {
			id: 'https://example.com/activities/create-xss-comment',
			type: ActivityType.CREATE,
			actor: remoteActor.id,
			object: {
				type: ObjectType.NOTE,
				id: 'https://example.com/comments/xss-comment',
				content: `${safeContent}${xssPayload}`,
                inReplyTo: testEvent.id // Local ID or external ID works due to logic
			},
		}

		await handleActivity(activity as any)

		const comment = await prisma.comment.findFirst({
			where: {
				externalId: activity.object.id,
			},
		})

		expect(comment).toBeTruthy()
        // Expect sanitization to remove onerror or img entirely if img not allowed
		expect(comment?.content).not.toContain('onerror')
        expect(comment?.content).toContain(safeContent)
    })
})
