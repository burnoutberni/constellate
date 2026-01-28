/**
 * Security Tests for Federation Handlers
 * Verifies that incoming data is properly sanitized to prevent XSS
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
	let testUser: any
	const baseUrl = process.env.BASE_URL || 'http://localhost:3000'

	beforeEach(async () => {
		// Clean up
		await prisma.processedActivity.deleteMany({})
		await prisma.eventAttendance.deleteMany({})
		await prisma.eventLike.deleteMany({})
		await prisma.comment.deleteMany({})
		await prisma.event.deleteMany({})
		await prisma.user.deleteMany({})

		// Reset mocks
		vi.clearAllMocks()
	})

	const XSS_PAYLOAD = '<script>alert("xss")</script>'
	const MIXED_PAYLOAD = '<p>Safe</p><script>alert("xss")</script><b>Bold</b>'
	const EVENT_ID = 'https://example.com/events/xss-test'

	// Helper to mock remote user
	const mockRemoteUser = async () => {
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

		return { remoteActor, remoteUser }
	}

	it('should sanitize Event title (strip HTML)', async () => {
		const { remoteActor } = await mockRemoteUser()

		const activity = {
			id: 'https://example.com/activities/create-xss-1',
			type: ActivityType.CREATE,
			actor: remoteActor.id,
			object: {
				type: ObjectType.EVENT,
				id: EVENT_ID,
				name: `Event ${XSS_PAYLOAD}`, // Should be stripped
				startTime: new Date().toISOString(),
			},
		}

		await handleActivity(activity as any)

		const event = await prisma.event.findFirst({
			where: { externalId: EVENT_ID },
		})

		// sanitizeText should strip tags. DOMPurify default also removes script content.
		// So it should be just "Event " or "Event alert("xss")" depending on config.
		// Assuming standard behavior of removing script tags entirely.
		expect(event?.title).not.toContain('<script>')
	})

	it('should sanitize Event summary (allow safe HTML, strip scripts)', async () => {
		const { remoteActor } = await mockRemoteUser()

		const activity = {
			id: 'https://example.com/activities/create-xss-2',
			type: ActivityType.CREATE,
			actor: remoteActor.id,
			object: {
				type: ObjectType.EVENT,
				id: EVENT_ID + '-summary',
				name: 'Safe Title',
				summary: MIXED_PAYLOAD, // Should preserve <p> and <b> but remove <script>
				startTime: new Date().toISOString(),
			},
		}

		await handleActivity(activity as any)

		const event = await prisma.event.findFirst({
			where: { externalId: EVENT_ID + '-summary' },
		})

		expect(event?.summary).toContain('<p>Safe</p>')
		expect(event?.summary).toContain('<b>Bold</b>')
		expect(event?.summary).not.toContain('<script>')
	})

	it('should sanitize Comment content', async () => {
		const { remoteActor } = await mockRemoteUser()

		// Create an event first
		const event = await prisma.event.create({
			data: {
				title: 'Test Event',
				startTime: new Date(),
				externalId: 'https://example.com/events/safe',
				attributedTo: remoteActor.id,
			},
		})

		const activity = {
			id: 'https://example.com/activities/create-comment-xss',
			type: ActivityType.CREATE,
			actor: remoteActor.id,
			object: {
				type: ObjectType.NOTE,
				id: 'https://example.com/comments/xss',
				content: `<a href="javascript:alert(1)">Click me</a>${XSS_PAYLOAD}`,
				inReplyTo: event.externalId,
			},
		}

		await handleActivity(activity as any)

		const comment = await prisma.comment.findFirst({
			where: { externalId: activity.object.id },
		})

		// Should strip javascript: href and script tag
		expect(comment?.content).not.toContain('javascript:')
		expect(comment?.content).not.toContain('<script>')
		expect(comment?.content).toContain('Click me') // content of <a> remains
	})

	it('should sanitize User profile fields on Update', async () => {
		const { remoteActor, remoteUser } = await mockRemoteUser()

		const activity = {
			id: 'https://example.com/activities/update-profile-xss',
			type: ActivityType.UPDATE,
			actor: remoteActor.id,
			object: {
				type: ObjectType.PERSON,
				id: remoteActor.id,
				name: `Hacker ${XSS_PAYLOAD}`,
				summary: `Bio with ${XSS_PAYLOAD}`,
			},
		}

		await handleActivity(activity as any)

		const updatedUser = await prisma.user.findUnique({
			where: { id: remoteUser.id },
		})

		// name should be plain text
		expect(updatedUser?.name).not.toContain('<script>')

		// bio should be safe HTML
		expect(updatedUser?.bio).not.toContain('<script>')
		expect(updatedUser?.bio).toContain('Bio with')
	})
})
