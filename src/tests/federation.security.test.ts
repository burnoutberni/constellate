
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

describe('Federation Security Tests', () => {
	const baseUrl = process.env.BASE_URL || 'http://localhost:3000'

	beforeEach(async () => {
		// Clean up
		await prisma.processedActivity.deleteMany({})
		await prisma.event.deleteMany({})
		await prisma.user.deleteMany({})
		await prisma.comment.deleteMany({})

		vi.clearAllMocks()
	})

	it('should sanitize HTML in incoming Event Create activities', async () => {
		const remoteActor = {
			id: 'https://example.com/users/evil',
			type: 'Person',
			preferredUsername: 'evil',
			inbox: 'https://example.com/users/evil/inbox',
		}

		const remoteUser = await prisma.user.create({
			data: {
				username: 'evil@example.com',
				email: 'evil@example.com',
				name: 'Evil User',
				isRemote: true,
				externalActorUrl: remoteActor.id,
				inboxUrl: remoteActor.inbox,
			},
		})

		vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor)
		vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue(remoteUser as any)
		vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

		const activity = {
			id: 'https://example.com/activities/create-xss',
			type: ActivityType.CREATE,
			actor: remoteActor.id,
			object: {
				type: ObjectType.EVENT,
				id: 'https://example.com/events/xss-1',
				name: 'Normal Title <script>alert(1)</script>',
				summary: '<b>Bold</b> <img src=x onerror=alert(1)>',
				location: 'Safe Place <iframe src="javascript:alert(1)"></iframe>',
				startTime: new Date().toISOString(),
				endTime: new Date(Date.now() + 3600000).toISOString(),
			},
		}

		await handleActivity(activity as any)

		const event = await prisma.event.findFirst({
			where: {
				externalId: activity.object.id,
			},
		})

		expect(event).toBeTruthy()
		// Expectation: HTML tags are stripped. DOMPurify removes script content entirely.
		expect(event?.title).toBe('Normal Title ')
		expect(event?.summary).toBe('Bold ') // sanitizeText strips ALL tags, so "Bold" remains, img removed but space might remain depending on how it was constructed
		expect(event?.location).toBe('Safe Place ')
	})

	it('should sanitize HTML in incoming Comment Create activities', async () => {
		const remoteActor = {
			id: 'https://example.com/users/evil',
			type: 'Person',
			preferredUsername: 'evil',
			inbox: 'https://example.com/users/evil/inbox',
		}

		const remoteUser = await prisma.user.create({
			data: {
				username: 'evil@example.com',
				email: 'evil@example.com',
				name: 'Evil User',
				isRemote: true,
				externalActorUrl: remoteActor.id,
				inboxUrl: remoteActor.inbox,
			},
		})

		// Create a local event to comment on
		const event = await prisma.event.create({
			data: {
				title: 'Test Event',
				startTime: new Date(),
				externalId: 'https://example.com/events/test-1',
			},
		})

		vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor)
		vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue(remoteUser as any)
		vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

		const activity = {
			id: 'https://example.com/activities/create-comment-xss',
			type: ActivityType.CREATE,
			actor: remoteActor.id,
			object: {
				type: ObjectType.NOTE,
				id: 'https://example.com/comments/xss-1',
				content: 'Nice event! <script>alert("xss")</script>',
				inReplyTo: event.externalId,
			},
		}

		await handleActivity(activity as any)

		const comment = await prisma.comment.findFirst({
			where: {
				externalId: activity.object.id,
			},
		})

		expect(comment).toBeTruthy()
		expect(comment?.content).toBe('Nice event! ')
	})
})
