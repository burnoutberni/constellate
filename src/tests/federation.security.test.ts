/**
 * Security Tests for Federation Handlers
 * Verifies that incoming ActivityPub data is sanitized to prevent XSS
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

		// Create test user
		testUser = await prisma.user.create({
			data: {
				username: 'alice',
				email: 'alice@test.com',
				name: 'Alice Test',
				isRemote: false,
			},
		})

		// Reset mocks
		vi.clearAllMocks()
	})

	it('should sanitize XSS payload in Create Event activity', async () => {
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

		const xssPayload = '<script>alert("xss")</script>Dangerous Event'
		const xssSummary = '<img src=x onerror=alert(1)>Summary'

		const activity = {
			id: 'https://example.com/activities/create-xss-event',
			type: ActivityType.CREATE,
			actor: remoteActor.id,
			object: {
				type: ObjectType.EVENT,
				id: 'https://example.com/events/xss-event',
				name: xssPayload,
				summary: xssSummary,
				startTime: new Date().toISOString(),
				endTime: new Date(Date.now() + 3600000).toISOString(),
				location: '<b>Bold Location</b>',
			},
		}

		await handleActivity(activity as any)

		// Verify event was created and sanitized
		const event = await prisma.event.findFirst({
			where: {
				externalId: activity.object.id,
			},
		})

		expect(event).toBeTruthy()
		// Expect tags to be stripped
		expect(event?.title).not.toContain('<script>')
		expect(event?.title).not.toContain('alert("xss")') // DOMPurify might strip the whole script tag content depending on config, but definitely the tag
		expect(event?.summary).not.toContain('<img')
		expect(event?.summary).not.toContain('onerror')
		expect(event?.location).not.toContain('<b>')
	})

	it('should sanitize XSS payload in Create Note (comment) activity', async () => {
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
		const event = await prisma.event.create({
			data: {
				title: 'Safe Event',
				startTime: new Date(),
				userId: testUser.id,
				attributedTo: `${baseUrl}/users/${testUser.username}`,
			},
		})

		vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor)
		vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue(remoteUser as any)
		vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

		const xssContent = '<a href="javascript:alert(1)">Click me</a>'

		const activity = {
			id: 'https://example.com/activities/create-xss-comment',
			type: ActivityType.CREATE,
			actor: remoteActor.id,
			object: {
				type: ObjectType.NOTE,
				id: 'https://example.com/comments/xss-comment',
				content: xssContent,
				inReplyTo: `${baseUrl}/events/${event.id}`,
			},
		}

		await handleActivity(activity as any)

		// Verify comment was created and sanitized
		const comment = await prisma.comment.findFirst({
			where: {
				externalId: activity.object.id,
			},
		})

		expect(comment).toBeTruthy()
		expect(comment?.content).not.toContain('javascript:')
		expect(comment?.content).not.toContain('<a href')
	})

	it('should sanitize XSS payload in Update Person (profile) activity', async () => {
		const remoteUser = await prisma.user.create({
			data: {
				username: 'remoteuser@example.com',
				email: 'remote@example.com',
				name: 'Original Name',
				bio: 'Original bio',
				isRemote: true,
				externalActorUrl: 'https://example.com/users/remoteuser',
			},
		})

		const xssName = '<script>alert("name")</script>Updated Name'
		const xssBio = '<iframe src="javascript:alert(1)"></iframe>Updated Bio'

		const activity = {
			id: 'https://example.com/activities/update-profile-xss',
			type: ActivityType.UPDATE,
			actor: 'https://example.com/users/remoteuser',
			object: {
				type: ObjectType.PERSON,
				id: 'https://example.com/users/remoteuser',
				preferredUsername: 'remoteuser',
				name: xssName,
				summary: xssBio,
			},
		}

		await handleActivity(activity as any)

		const updatedUser = await prisma.user.findUnique({
			where: { id: remoteUser.id },
		})

		expect(updatedUser?.name).not.toContain('<script>')
		expect(updatedUser?.bio).not.toContain('<iframe')
	})
})
