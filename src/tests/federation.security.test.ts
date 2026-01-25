
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

describe('Federation Security (Stored XSS)', () => {
	const baseUrl = process.env.BASE_URL || 'http://localhost:3000'

	beforeEach(async () => {
		// Clean up
		await prisma.processedActivity.deleteMany({})
		await prisma.event.deleteMany({})
		await prisma.comment.deleteMany({})
		await prisma.user.deleteMany({})
		vi.clearAllMocks()
	})

	it('should sanitize HTML in events to prevent Stored XSS', async () => {
		const maliciousScript = '<script>alert("xss")</script>'
		const maliciousTitle = `Malicious Event ${maliciousScript}`
		const maliciousSummary = `Summary with ${maliciousScript}`

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

		const activity = {
			id: 'https://example.com/activities/create-malicious-event',
			type: ActivityType.CREATE,
			actor: remoteActor.id,
			object: {
				type: ObjectType.EVENT,
				id: 'https://example.com/events/malicious-1',
				name: maliciousTitle,
				summary: maliciousSummary,
				startTime: new Date().toISOString(),
			},
		}

		await handleActivity(activity as any)

		const event = await prisma.event.findFirst({
			where: { externalId: activity.object.id },
		})

		expect(event).toBeTruthy()
		// Expect sanitized content
		expect(event?.title).toBe('Malicious Event ')
		expect(event?.summary).toBe('Summary with ')
		expect(event?.title).not.toContain('<script>')
		expect(event?.summary).not.toContain('<script>')
	})

	it('should sanitize HTML in comments to prevent Stored XSS', async () => {
		const maliciousScript = '<img src=x onerror=alert(1)>'
		const maliciousContent = `Comment with ${maliciousScript}`

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

		// Create a local event to comment on
		const localUser = await prisma.user.create({
			data: { username: 'victim', email: 'victim@test.com', isRemote: false },
		})
		const event = await prisma.event.create({
			data: {
				title: 'Safe Event',
				startTime: new Date(),
				userId: localUser.id,
				attributedTo: `${baseUrl}/users/victim`,
			},
		})

		vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor)
		vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue(remoteUser as any)
		vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

		const activity = {
			id: 'https://example.com/activities/create-malicious-comment',
			type: ActivityType.CREATE,
			actor: remoteActor.id,
			object: {
				type: ObjectType.NOTE,
				id: 'https://example.com/comments/malicious-1',
				content: maliciousContent,
				inReplyTo: `${baseUrl}/events/${event.id}`,
			},
		}

		await handleActivity(activity as any)

		const comment = await prisma.comment.findFirst({
			where: { externalId: activity.object.id },
		})

		expect(comment).toBeTruthy()
		expect(comment?.content).toBe('Comment with ')
		expect(comment?.content).not.toContain('<img')
	})
})
