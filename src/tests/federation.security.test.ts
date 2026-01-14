/**
 * Security Tests for Federation Handlers
 * Verifies that incoming ActivityPub content is sanitized to prevent XSS
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
vi.mock('../realtime.js')

describe('Federation Security (XSS Prevention)', () => {
	const baseUrl = process.env.BASE_URL || 'http://localhost:3000'

	beforeEach(async () => {
		// Clean up
		await prisma.processedActivity.deleteMany({})
		await prisma.event.deleteMany({})
		await prisma.comment.deleteMany({})
		await prisma.user.deleteMany({})
		vi.clearAllMocks()
	})

	it('should sanitize Event fields in Create activity', async () => {
		const xssPayload = '<script>alert("xss")</script>'
		const safeText = 'Safe Text'

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
			id: 'https://example.com/activities/create-xss-event',
			type: ActivityType.CREATE,
			actor: remoteActor.id,
			object: {
				type: ObjectType.EVENT,
				id: 'https://example.com/events/xss-event',
				name: `${safeText}${xssPayload}`,
				summary: `${xssPayload}${safeText}`,
				content: `${safeText}${xssPayload}${safeText}`,
				location: `${xssPayload}`,
				startTime: new Date().toISOString(),
			},
		}

		await handleActivity(activity as any)

		const event = await prisma.event.findFirst({
			where: { externalId: activity.object.id },
		})

		expect(event).toBeTruthy()
		// If sanitized, the payload should be removed
		expect(event?.title).toBe(safeText)
		expect(event?.summary).toBe(safeText) // summary falls back to content if both present? No, extractEventProperties uses one or the other usually?
        // Actually extractEventProperties does: summary: eventSummary || eventContent || null
        // In my test object I provided both. extractEventProperties: eventSummary = getString(eventObj.summary)
        // so it should use summary.
		expect(event?.location).toBe('')
	})

	it('should sanitize Comment content in Create activity', async () => {
		const xssPayload = '<img src=x onerror=alert(1)>'
		const safeText = 'Hello world'

		// Create a local event to comment on
		const event = await prisma.event.create({
			data: {
				title: 'Test Event',
				startTime: new Date(),
				externalId: 'https://example.com/events/1',
			},
		})

		const remoteActor = {
			id: 'https://example.com/users/attacker',
			type: 'Person',
			preferredUsername: 'attacker',
		}

		const remoteUser = await prisma.user.create({
			data: {
				username: 'attacker@example.com',
				email: 'attacker@example.com',
				isRemote: true,
				externalActorUrl: remoteActor.id,
			},
		})

		vi.mocked(activitypubHelpers.fetchActor).mockResolvedValue(remoteActor)
		vi.mocked(activitypubHelpers.cacheRemoteUser).mockResolvedValue(remoteUser as any)
		vi.mocked(realtime.broadcast).mockResolvedValue(undefined)

		const activity = {
			id: 'https://example.com/activities/create-xss-comment',
			type: ActivityType.CREATE,
			actor: remoteActor.id,
			object: {
				type: ObjectType.NOTE,
				id: 'https://example.com/comments/xss',
				content: `${safeText} ${xssPayload}`,
				inReplyTo: event.externalId,
			},
		}

		await handleActivity(activity as any)

		const comment = await prisma.comment.findFirst({
			where: { externalId: activity.object.id },
		})

		expect(comment).toBeTruthy()
		expect(comment?.content).toBe(`${safeText} `)
	})

    // Note: User profile updates rely on cacheRemoteUser in activitypubHelpers.
    // Since we mock cacheRemoteUser in these tests, we can't test its internal sanitization logic here easily
    // without unmocking it or writing a separate test for activitypubHelpers.
    // However, handleUpdatePerson in federation.ts calls prisma directly.

	it('should sanitize Profile fields in Update activity', async () => {
		const xssPayload = '<script>alert(1)</script>'
		const safeText = 'Updated Name'

		const remoteUser = await prisma.user.create({
			data: {
				username: 'victim@example.com',
				isRemote: true,
				externalActorUrl: 'https://example.com/users/victim',
				name: 'Old Name',
			},
		})

		const activity = {
			id: 'https://example.com/activities/update-profile-xss',
			type: ActivityType.UPDATE,
			actor: remoteUser.externalActorUrl,
			object: {
				type: ObjectType.PERSON,
				id: remoteUser.externalActorUrl,
				preferredUsername: 'victim',
				name: `${safeText}${xssPayload}`,
				summary: `Bio with ${xssPayload}`,
			},
		}

		await handleActivity(activity as any)

		const updatedUser = await prisma.user.findUnique({
			where: { id: remoteUser.id },
		})

		expect(updatedUser?.name).toBe(safeText)
		expect(updatedUser?.bio).toBe('Bio with ')
	})
})
