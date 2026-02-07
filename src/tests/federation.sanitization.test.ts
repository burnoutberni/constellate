
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
	let testEvent: any
	const baseUrl = process.env.BASE_URL || 'http://localhost:3000'

	beforeEach(async () => {
		// Clean up processed activities
		await prisma.processedActivity.deleteMany({})
		await prisma.comment.deleteMany({})
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

	it('should sanitize malicious script from comments', async () => {
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

		const maliciousContent = 'Hello <script>alert("xss")</script> World <b>bold</b>'

		const activity = {
			id: 'https://example.com/activities/create-malicious-comment',
			type: ActivityType.CREATE,
			actor: remoteActor.id,
			object: {
				type: ObjectType.NOTE,
				id: 'https://example.com/comments/malicious',
				content: maliciousContent,
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
		// Script tag should be removed
		expect(comment?.content).not.toContain('<script>')
		expect(comment?.content).not.toContain('alert("xss")')
		// Safe HTML should be preserved
		expect(comment?.content).toContain('<b>bold</b>')
		expect(comment?.content).toContain('Hello')
	})

	it('should sanitize malicious script from event title and summary', async () => {
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

		const maliciousTitle = 'Event <script>alert(1)</script> Title'
		const maliciousSummary = 'Summary with <iframe src="javascript:alert(1)"></iframe> and <i>italics</i>'

		const activity = {
			id: 'https://example.com/activities/create-malicious-event',
			type: ActivityType.CREATE,
			actor: remoteActor.id,
			object: {
				type: ObjectType.EVENT,
				id: 'https://example.com/events/malicious',
				name: maliciousTitle,
				summary: maliciousSummary,
				startTime: new Date().toISOString(),
				attributedTo: remoteActor.id,
			},
		}

		await handleActivity(activity as any)

		const event = await prisma.event.findFirst({
			where: {
				externalId: activity.object.id,
			},
		})

		expect(event).toBeTruthy()
		// Title should be plain text (all tags stripped)
		expect(event?.title).not.toContain('<script>')
		expect(event?.title).toBe('Event  Title') // Note: DOMPurify might leave spaces? Verify behavior.

		// Summary should be sanitized HTML (script/iframe stripped, safe tags kept)
		expect(event?.summary).not.toContain('<iframe')
		expect(event?.summary).not.toContain('javascript:')
		expect(event?.summary).toContain('<i>italics</i>')
	})

    it('should sanitize links in summary to have target=_blank', async () => {
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

		const summaryWithLink = 'Check this <a href="https://malicious.com">link</a>'

		const activity = {
			id: 'https://example.com/activities/create-link-event',
			type: ActivityType.CREATE,
			actor: remoteActor.id,
			object: {
				type: ObjectType.EVENT,
				id: 'https://example.com/events/link',
				name: 'Link Event',
				summary: summaryWithLink,
				startTime: new Date().toISOString(),
			},
		}

		await handleActivity(activity as any)

		const event = await prisma.event.findFirst({
			where: {
				externalId: activity.object.id,
			},
		})

		expect(event).toBeTruthy()
		expect(event?.summary).toContain('target="_blank"')
		expect(event?.summary).toContain('rel="noopener noreferrer"')
    })
})
