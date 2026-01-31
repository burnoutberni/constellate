/**
 * Tests for Federation Sanitization
 * Verifies that incoming activities are properly sanitized to prevent XSS
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
	const baseUrl = process.env.BASE_URL || 'http://localhost:3000'

	beforeEach(async () => {
		// Clean up
		await prisma.processedActivity.deleteMany({})
		await prisma.event.deleteMany({})
		await prisma.comment.deleteMany({})
		await prisma.user.deleteMany({})

		// Reset mocks
		vi.clearAllMocks()
	})

	it('should sanitize Event title and summary on Create', async () => {
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
			id: 'https://example.com/activities/create-xss',
			type: ActivityType.CREATE,
			actor: remoteActor.id,
			object: {
				type: ObjectType.EVENT,
				id: 'https://example.com/events/xss-event',
				name: 'Safe Title <script>alert(1)</script>',
				summary: '<p>Safe Summary <script>alert(1)</script></p>',
				location: 'Safe Location <img src=x onerror=alert(1)>',
				startTime: new Date().toISOString(),
				endTime: new Date(Date.now() + 3600000).toISOString(),
			},
		}

		await handleActivity(activity as any)

		const event = await prisma.event.findFirst({
			where: { externalId: activity.object.id },
		})

		expect(event).toBeTruthy()
		// Title should strip ALL HTML
		expect(event?.title).toBe('Safe Title ')
		// Summary should allow safe HTML but strip script
		expect(event?.summary).toBe('<p>Safe Summary </p>')
		// Location should strip ALL HTML
		expect(event?.location).toBe('Safe Location ')
	})

	it('should sanitize Note content on Create', async () => {
		const remoteActor = {
			id: 'https://example.com/users/hacker',
			type: 'Person',
			preferredUsername: 'hacker',
		}

		const remoteUser = await prisma.user.create({
			data: {
				username: 'hacker@example.com',
				isRemote: true,
				externalActorUrl: remoteActor.id,
			},
		})

		// Create a target event
		const targetEvent = await prisma.event.create({
			data: {
				title: 'Target Event',
				startTime: new Date(),
				externalId: 'https://example.com/events/target',
				attributedTo: 'https://example.com/users/victim',
			},
		})

		vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor as any)
		vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue(remoteUser as any)

		const activity = {
			id: 'https://example.com/activities/create-note-xss',
			type: ActivityType.CREATE,
			actor: remoteActor.id,
			object: {
				type: ObjectType.NOTE,
				id: 'https://example.com/comments/xss',
				content: '<p>Click me <a href="javascript:alert(1)">here</a></p>',
				inReplyTo: targetEvent.externalId,
			},
		}

		await handleActivity(activity as any)

		const comment = await prisma.comment.findFirst({
			where: { externalId: activity.object.id },
		})

		expect(comment).toBeTruthy()
		// Content should strip javascript: link
		expect(comment?.content).toBe('<p>Click me <a>here</a></p>')
	})

	it('should sanitize Event updates', async () => {
		const remoteEvent = await prisma.event.create({
			data: {
				title: 'Original Title',
				startTime: new Date(),
				externalId: 'https://example.com/events/update-xss',
				attributedTo: 'https://example.com/users/hacker',
			},
		})

		const activity = {
			id: 'https://example.com/activities/update-event-xss',
			type: ActivityType.UPDATE,
			actor: 'https://example.com/users/hacker',
			object: {
				type: ObjectType.EVENT,
				id: remoteEvent.externalId,
				name: 'Updated Title <script>alert(1)</script>',
				summary: '<p>Updated Summary <iframe src="javascript:alert(1)"></iframe></p>',
			},
		}

		await handleActivity(activity as any)

		const updatedEvent = await prisma.event.findUnique({
			where: { id: remoteEvent.id },
		})

		expect(updatedEvent?.title).toBe('Updated Title ')
		expect(updatedEvent?.summary).toBe('<p>Updated Summary </p>')
	})

	it('should sanitize Profile updates', async () => {
		const remoteUser = await prisma.user.create({
			data: {
				username: 'hacker@example.com',
				isRemote: true,
				externalActorUrl: 'https://example.com/users/hacker',
				name: 'Original Name',
			},
		})

		const activity = {
			id: 'https://example.com/activities/update-profile-xss',
			type: ActivityType.UPDATE,
			actor: 'https://example.com/users/hacker',
			object: {
				type: ObjectType.PERSON,
				id: 'https://example.com/users/hacker',
				name: 'Hacker <script>alert(1)</script>',
				summary: '<b>Hacker Bio</b> <img src=x onerror=alert(1)>',
			},
		}

		await handleActivity(activity as any)

		const updatedUser = await prisma.user.findUnique({
			where: { id: remoteUser.id },
		})

		expect(updatedUser?.name).toBe('Hacker ')
		expect(updatedUser?.bio).toBe('<b>Hacker Bio</b> ')
	})
})
